
import {
    getCurrentUser,
    updateProfile,
    addCollege,
    getUserProfile
} from './supabase-config.js';
import config from './config.js';

const AI_SERVER_URL = config.apiUrl;

const ONBOARDING_SYSTEM_PROMPT = `
You are a warm, professional, and knowledgeable college admissions counselor at Waypoint named Alex. 
This is your first-time meeting with a student. Your style is conversational, empathetic, and organized.

Your objective is to help the student set up their profile by gathering:
1. Their Full Name
2. Their Graduation Year (must be a number between 2025 and 2030)
3. Their intended major or general academic interests
4. Their academic stats (unweighted GPA and optional SAT/ACT scores)
5. A list of 3 colleges they are currently considering

Guidelines:
- Start with a personalized welcome. Mention that you're here to take the stress out of the process.
- Ask questions one by one. Don't overwhelm them.
- If they mention a major or college, give a brief, insightful comment (e.g., "Stanford's CS program is world-class, but very competitive!").
- Keep the tone supportive.
- Once you have gathered ALL the information, summarize it warmly, tell them you've set up their roadmap, and finish your message with exactly: "[COMPLETED_ONBOARDING]"
`;

let currentUser = null;
let conversationHistory = []; // Past messages (excluding latest user message)
let isProcessing = false;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.assign('login.html');
        return;
    }

    // Check if profile exists and is complete
    const profile = await getUserProfile(currentUser.id);
    if (profile && profile.graduation_year) {
        console.log('User already has a grad year set.');
    }

    initChat();
});

async function initChat() {
    appendTyping();
    try {
        const response = await fetch(`${AI_SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Hello! I'm a new student ready to start onboarding. Introduce yourself.",
                userId: currentUser.id,
                conversationHistory: [],
                systemPrompt: ONBOARDING_SYSTEM_PROMPT,
                saveToHistory: false
            })
        });
        const data = await response.json();
        removeTyping();
        const aiMsg = data.content || "Hi! I'm Alex, your Waypoint counselor. I'm so excited to help you on your college journey. To get started, what's your name?";
        appendAIMessage(aiMsg);
        conversationHistory.push({ role: 'assistant', content: aiMsg });
    } catch (e) {
        removeTyping();
        appendAIMessage("Hi! I'm Alex, your Waypoint counselor. Let's start with your name — what should I call you?");
    }
    setupInput();
}

function setupInput() {
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('sendBtn');

    btn.onclick = () => handleSend();
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
}

async function handleSend() {
    if (isProcessing) return;
    
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendUserMessage(text);

    isProcessing = true;
    appendTyping();

    try {
        const response = await fetch(`${AI_SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                userId: currentUser.id,
                conversationHistory: conversationHistory,
                systemPrompt: ONBOARDING_SYSTEM_PROMPT,
                saveToHistory: false // We don't want to pollute their regular history with onboarding chat
            })
        });
        const data = await response.json();
        removeTyping();
        
        let aiMsg = data.content || "Got it! Tell me more.";
        
        conversationHistory.push({ role: 'user', content: text });
        
        if (aiMsg.includes('[COMPLETED_ONBOARDING]')) {
            aiMsg = aiMsg.replace('[COMPLETED_ONBOARDING]', '').trim();
            appendAIMessage(aiMsg);
            conversationHistory.push({ role: 'assistant', content: aiMsg });
            await extractAndFinish();
        } else {
            appendAIMessage(aiMsg);
            conversationHistory.push({ role: 'assistant', content: aiMsg });
        }
    } catch (e) {
        console.error('Chat error:', e);
        removeTyping();
        appendAIMessage("I'm sorry, I'm having a little trouble connecting. Could you try saying that again?");
    } finally {
        isProcessing = false;
        updateStepperProgress();
    }
}

function updateStepperProgress() {
    const dots = document.querySelectorAll('.step-dot');
    const itemsFound = ['name', 'grad', 'major', 'stat', 'college'].filter(key => {
        return conversationHistory.some(m => m.content.toLowerCase().includes(key));
    }).length;
    
    dots.forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i < itemsFound) dot.classList.add('done');
        if (i === itemsFound) dot.classList.add('active');
    });
}

async function extractAndFinish() {
    appendTyping();
    appendAIMessage("Give me just a second to set up your roadmap...");

    const extractionPrompt = `Based on our conversation, extract the student's data into JSON:
{
  "full_name": "string",
  "graduation_year": number,
  "intended_major": "string",
  "unweighted_gpa": number or null,
  "sat_score": number or null,
  "top_colleges": ["string", "string", "string"]
}
ONLY return JSON. If missing, use null or empty array.`;

    try {
        const response = await fetch(`${AI_SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: extractionPrompt,
                userId: currentUser.id,
                conversationHistory: conversationHistory,
                saveToHistory: false
            })
        });
        const data = await response.json();
        const jsonStr = data.content.match(/\{[\s\S]*\}/)?.[0];
        const profileData = JSON.parse(jsonStr);

        console.log('Extracted Profile:', profileData);

        const updates = {
            id: currentUser.id,
            full_name: profileData.full_name || currentUser.user_metadata?.full_name || 'Student',
            graduation_year: profileData.graduation_year ? parseInt(profileData.graduation_year) : 2026,
            intended_major: profileData.intended_major || '',
            unweighted_gpa: profileData.unweighted_gpa || null,
            sat_score: profileData.sat_score || null
        };

        // Important: Update profile and WAIT for it
        await updateProfile(currentUser.id, updates);

        if (profileData.top_colleges && Array.isArray(profileData.top_colleges)) {
            for (const col of profileData.top_colleges) {
                if (col && col.toLowerCase() !== 'null') {
                    await addCollege({ user_id: currentUser.id, name: col, type: 'Target' });
                }
            }
        }

        const planRes = await fetch(`${AI_SERVER_URL}/api/onboarding/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                colleges: profileData.top_colleges || [],
                profile: updates
            })
        });

        removeTyping();
        if (planRes.ok) {
            const planData = await planRes.json();
            renderRoadmap(planData.plan);
        } else {
            showFinishButton();
        }

    } catch (e) {
        console.error('Finalization failed:', e);
        removeTyping();
        showFinishButton();
    }
}

function renderRoadmap(plan) {
    const container = document.getElementById('chatMessages');
    const card = document.createElement('div');
    card.className = 'roadmap-card';
    card.innerHTML = `
        <h3 style="margin-top:0; font-family: var(--font-display);">✨ Your Waypoint Roadmap</h3>
        <p style="font-size: 14px; color: var(--gray-700); margin-bottom: 20px;">${plan.summary}</p>
        <div id="roadmapTasks"></div>
        <button class="btn btn-primary" style="width:100%; margin-top:20px; height: 50px; border-radius: 99px;" id="finalDashboardBtn">CONTINUE TO DASHBOARD</button>
    `;
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;

    const tasksDiv = card.querySelector('#roadmapTasks');
    plan.tasks.forEach(task => {
        const t = document.createElement('div');
        t.className = 'roadmap-task';
        t.style.textAlign = 'left';
        t.innerHTML = `<div><strong style="color: var(--primary-blue)">${task.title}</strong><br><span style="font-size:12px;opacity:0.8">${task.description}</span></div>`;
        tasksDiv.appendChild(t);
    });

    document.getElementById('finalDashboardBtn').onclick = () => {
        const b = document.getElementById('finalDashboardBtn');
        b.textContent = "Taking you home...";
        b.disabled = true;
        setTimeout(() => window.location.assign('dashboard.html'), 1200);
    };
}

function showFinishButton() {
    const container = document.getElementById('chatMessages');
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'width: 100%; margin-top: 20px; height: 50px; border-radius: 99px;';
    btn.textContent = "CONTINUE TO DASHBOARD";
    btn.onclick = () => {
        btn.textContent = "Saving...";
        setTimeout(() => window.location.assign('dashboard.html'), 1200);
    };
    container.appendChild(btn);
    container.scrollTop = container.scrollHeight;
}

function appendAIMessage(text) {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML = `<div class="msg-bubble ai">${text}</div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function appendUserMessage(text) {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `<div class="msg-bubble user">${text}</div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function appendTyping() {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.id = 'typingIndicator';
    row.innerHTML = `<div class="msg-bubble ai"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}
