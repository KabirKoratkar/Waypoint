import {
    getCurrentUser,
    getUserTasks,
    getUserEssays,
    getUserColleges,
    getUserProfile,
    getUserConversations,
    saveMessage
} from './supabase-config.js';
import { updateNavbarUser, showLoading, hideLoading } from './ui.js';
import { formatAIMessage } from './utils.js';
import config from './config.js';

const AI_SERVER_URL = config.apiUrl;

let currentUser = null;
let userProfile = null;
let conversationHistory = [];
let isLoading = false;

// ─── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    showLoading('Waking up your counselor...');

    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.assign('login.html');
        return;
    }

    userProfile = await getUserProfile(currentUser.id);
    if (!userProfile || !userProfile.graduation_year) {
        console.log('Incomplete profile, redirecting to onboarding...');
        window.location.assign('onboarding.html');
        return;
    }

    window.currentUserProfile = userProfile;
    updateNavbarUser(currentUser, userProfile);
    updateGreeting(userProfile);

    // Load all data in parallel with timeout to prevent hang
    const initPromise = (async () => {
        try {
            const { tasks, essays, colleges } = await fetchData(currentUser.id);
            renderStats(tasks, essays, colleges);
            await initConversation(userProfile, tasks, essays, colleges);
        } catch (err) {
            console.error('Initialization error:', err);
            appendAIMessage('I\'m ready to help, but I had trouble loading your personal context. Let\'s start something new!');
            renderStats([], [], []);
        }
    })();

    // Force hide loading after 6s regardless of network
    await Promise.race([
        initPromise,
        new Promise(res => setTimeout(res, 6000))
    ]);

    hideLoading();
    setupChat();
});

// ─── Greeting Bar ───────────────────────────────────────────────────────────
function updateGreeting(profile) {
    const greetingEl = document.getElementById('greeting');
    const dateEl = document.getElementById('currentDate');

    const hour = new Date().getHours();
    let salutation = 'Good morning';
    if (hour >= 12 && hour < 17) salutation = 'Good afternoon';
    if (hour >= 17) salutation = 'Good evening';

    let name = 'there';
    if (profile?.full_name) name = profile.full_name.split(' ')[0];
    else if (currentUser?.user_metadata?.full_name) name = currentUser.user_metadata.full_name.split(' ')[0];
    else if (currentUser?.email) name = currentUser.email.split('@')[0];

    if (greetingEl) greetingEl.textContent = `${salutation}, ${name}! 🌟`;
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

// ─── Data Fetch ─────────────────────────────────────────────────────────────
async function fetchData(userId) {
    const [tasks, essays, colleges] = await Promise.all([
        getUserTasks(userId),
        getUserEssays(userId),
        getUserColleges(userId)
    ]);
    return { tasks, essays, colleges };
}

// ─── Stats Panel ────────────────────────────────────────────────────────────
function renderStats(tasks, essays, colleges) {
    const pendingTasks = tasks.filter(t => !t.completed);
    const pendingEssays = essays.filter(e => !e.is_completed);

    // Stat pills (top bar)
    const pillsEl = document.getElementById('statPills');
    if (pillsEl) {
        pillsEl.innerHTML = `
            <div class="stat-pill">
                <span class="pill-val">${pendingTasks.length}</span> tasks left
            </div>
            <div class="stat-pill pill-purple">
                <span class="pill-val">${pendingEssays.length}</span> essays in progress
            </div>
            <div class="stat-pill pill-green">
                <span class="pill-val">${colleges.length}</span> colleges
            </div>
        `;
    }

    // Panel cards
    const statTasks = document.getElementById('statTasks');
    const statEssays = document.getElementById('statEssays');
    const statDeadline = document.getElementById('statDeadline');
    const statDeadlineSub = document.getElementById('statDeadlineSub');

    if (statTasks) statTasks.textContent = pendingTasks.length;
    if (statEssays) statEssays.textContent = pendingEssays.length;

    // Next deadline
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = colleges
        .filter(c => c.deadline && new Date(c.deadline) >= today)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (upcoming.length > 0) {
        const next = upcoming[0];
        const daysLeft = Math.ceil((new Date(next.deadline) - today) / (1000 * 60 * 60 * 24));
        if (statDeadline) statDeadline.textContent = `${daysLeft}d`;
        if (statDeadlineSub) statDeadlineSub.textContent = `until ${next.name} deadline`;
    } else {
        if (statDeadline) statDeadline.textContent = '—';
        if (statDeadlineSub) statDeadlineSub.textContent = 'Add colleges to track deadlines';
    }
}

// ─── Chat Setup ─────────────────────────────────────────────────────────────
function setupChat() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const chips = document.querySelectorAll('.ask-chip');

    sendBtn.addEventListener('click', () => handleSend());

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Auto-grow textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });

    newChatBtn.addEventListener('click', () => {
        conversationHistory = [];
        const messages = document.getElementById('chatMessages');
        if (messages) messages.innerHTML = '';
        appendSystemMessage('New session started. How can I help you?');
    });

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (input) {
                input.value = chip.dataset.query;
                handleSend();
            }
        });
    });
}

async function handleSend() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    input.style.height = 'auto';

    appendUserMessage(text);

    // Save to DB
    try {
        await saveMessage(currentUser.id, 'user', text);
    } catch (e) {
        console.error('Failed to save user message:', e);
    }

    // Hide ask chips after first user message
    const chipsRow = document.getElementById('askChips');
    if (chipsRow) chipsRow.style.display = 'none';

    await sendToAI(text);
}

// ─── Proactive Opening ──────────────────────────────────────────────────────
async function initConversation(profile, tasks, essays, colleges) {
    // Check if there's existing conversation history
    const history = await getUserConversations(profile.id);

    if (history && history.length > 0) {
        // Restore last N messages
        const recent = history.slice(-10);
        recent.forEach(msg => {
            if (msg.role === 'user') appendUserMessage(msg.content, msg.created_at);
            else appendAIMessage(msg.content, msg.created_at);
        });

        // Rebuild conversation history for context
        conversationHistory = recent.map(m => ({ role: m.role, content: m.content }));

        // Hide chips after history loaded
        const chipsRow = document.getElementById('askChips');
        if (chipsRow) chipsRow.style.display = 'none';

    } else {
        // First visit — fire proactive counselor greeting
        await fireProactiveGreeting(profile, tasks, essays, colleges);
    }
}

async function fireProactiveGreeting(profile, tasks, essays, colleges) {
    const typingEl = appendTyping();

    const pendingTasks = tasks.filter(t => !t.completed);
    const pendingEssays = essays.filter(e => !e.is_completed);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = colleges
        .filter(c => c.deadline && new Date(c.deadline) >= today)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const daysUntil = upcoming.length > 0
        ? Math.ceil((new Date(upcoming[0].deadline) - today) / (1000 * 60 * 60 * 24))
        : null;

    const name = profile?.full_name?.split(' ')[0] || 'there';
    const intensity = profile?.intensity_level || 'Balanced';
    const strategy = profile?.application_strategy || 'balanced';

    const contextStr = [
        `Student name: ${name}`,
        `Graduation year: ${profile?.graduation_year || 'unknown'}`,
        `Strategy/intensity: ${intensity}`,
        `Colleges applied to/tracking: ${colleges.length} (${colleges.map(c => c.name).slice(0, 5).join(', ')}${colleges.length > 5 ? '...' : ''})`,
        `Pending tasks: ${pendingTasks.length}`,
        `Essays in progress: ${pendingEssays.length}`,
        daysUntil !== null ? `Next deadline: ${upcoming[0].name} in ${daysUntil} days` : 'No upcoming deadlines on record',
    ].join('. ');

    try {
        const response = await fetch(`${AI_SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `You are an elite, proactive college admissions counselor. The student just opened their dashboard. Using their profile data, give them a personalized, direct opening message (2-4 sentences max). Start with a warm but concise greeting, then immediately tell them the most important thing they should focus on right now and why. Sound like a real advisor — not a chatbot. Don't list tasks. Don't ask what they need. Just tell them what matters most based on their data. Profile: ${contextStr}`,
                userId: currentUser.id,
                conversationHistory: [],
                saveToHistory: false
            })
        });

        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

        if (response.ok) {
            const data = await response.json();
            const greeting = data.response || getOfflineGreeting(name, pendingTasks, upcoming, daysUntil);
            appendAIMessage(greeting);
            conversationHistory.push({ role: 'assistant', content: greeting });
        } else {
            appendAIMessage(getOfflineGreeting(name, pendingTasks, upcoming, daysUntil));
        }
    } catch (e) {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
        appendAIMessage(getOfflineGreeting(name, pendingTasks, upcoming, daysUntil));
    }
}

function getOfflineGreeting(name, pendingTasks, upcoming, daysUntil) {
    if (upcoming.length > 0 && daysUntil <= 14) {
        return `Hey ${name} — you've got ${upcoming[0].name}'s deadline in just ${daysUntil} days. That's your single biggest priority right now. Tell me where things stand and we'll figure out exactly what needs to happen before then.`;
    }
    if (pendingTasks.length > 0) {
        return `Hey ${name}! You've got ${pendingTasks.length} open tasks on your list. Let's make sure the right ones get done first. What's on your mind — or want me to assess where you should focus?`;
    }
    return `Hey ${name}! I'm your Waypoint counselor. Tell me what you're working on and I'll help you figure out the best next move for your applications.`;
}

// ─── AI Communication ────────────────────────────────────────────────────────
async function sendToAI(message) {
    isLoading = true;
    document.getElementById('sendBtn').disabled = true;

    const typingEl = appendTyping();

    try {
        const response = await fetch(`${AI_SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                userId: currentUser.id,
                conversationHistory
            })
        });

        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

        if (response.ok) {
            const data = await response.json();
            const reply = data.response || 'Sorry, I had trouble with that. Try again?';
            appendAIMessage(reply);

            // Persist locally for session and globally for DB
            conversationHistory.push({ role: 'user', content: message });
            conversationHistory.push({ role: 'assistant', content: reply });

            try {
                await saveMessage(currentUser.id, 'assistant', reply);
            } catch (e) {
                console.error('Failed to save AI reply:', e);
            }
        } else {
            appendAIMessage('I\'m having trouble reaching the server right now. Try again in a moment.');
        }
    } catch (e) {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
        appendAIMessage('Connection issue — check your internet and try again.');
    } finally {
        isLoading = false;
        document.getElementById('sendBtn').disabled = false;
    }
}

// ─── Message Rendering ───────────────────────────────────────────────────────
function appendAIMessage(text, timestamp = null) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const time = timestamp ? new Date(timestamp) : new Date();
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML = `
        <div class="msg-avatar ai-av">🎓</div>
        <div>
            <div class="msg-bubble ai">${formatAIMessage(text)}</div>
            <span class="msg-time">${timeStr}</span>
        </div>
    `;
    container.appendChild(row);
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
    return row;
}

function appendUserMessage(text, timestamp = null) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const time = timestamp ? new Date(timestamp) : new Date();
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const initials = getUserInitials();
    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `
        <div class="msg-avatar user-av">${initials}</div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;">
            <div class="msg-bubble user">${escapeHtml(text)}</div>
            <span class="msg-time">${timeStr}</span>
        </div>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return row;
}

function appendTyping() {
    const container = document.getElementById('chatMessages');
    if (!container) return null;

    const row = document.createElement('div');
    row.className = 'msg-row';
    row.id = 'typingIndicator';
    row.innerHTML = `
        <div class="msg-avatar ai-av">🎓</div>
        <div class="msg-bubble ai">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return row;
}

function appendSystemMessage(text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.style.cssText = 'text-align:center;color:var(--gray-400);font-size:12px;padding:8px 0;';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getUserInitials() {
    const name = userProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email || 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name[0].toUpperCase();
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
