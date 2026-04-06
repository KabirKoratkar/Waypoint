
import {
    getCurrentUser,
    upsertProfile,
    addCollege,
    getUserProfile
} from './supabase-config.js';
import config from './config.js';

// Import Supabase client for activities insert
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

const AI_SERVER_URL = config.apiUrl;

const ONBOARDING_SYSTEM_PROMPT = `
MISSION: You MUST lead the conversation. Dig deeper than surface-level answers.
Gather the following:
1. Full Name
2. Are they a FRESHMAN or TRANSFER student? (In case they are a transfer, what year will they start their application process?)
3. Graduation Year (2025-2030)
4. Intended Major & Career Aspirations (Dig deeper: Ask "What draws you to that field?" or "What's the dream career?")
5. Extracurriculars & Interests (Dig deeper: Ask for 2-3 specific things they do.)
6. Academic Stats (GPA and Optional SAT/ACT)
7. Top 3 Colleges they are interested in

CONVERSATIONAL RULES:
- BE PROACTIVE. Every single response you give MUST end with a clear, leading question.
- ASK ONLY ONE THING AT A TIME.
- If they mention a major or interest, give a quick, expert "counselor tip".
- Keep it encouraging. Use their name once you have it.
- Once you have all info, summarize their profile (including transfer status/start year) enthusiastically and end your message with exactly: "[COMPLETED_ONBOARDING]"
`;

let currentUser = null;
let conversationHistory = []; 
let isProcessing = false;
let isVoiceEnabled = false;
let currentAudio = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.assign('login.html');
        return;
    }

    // CRITICAL: Create a minimal profile row immediately so the user is never
    // stuck in the redirect loop, even if the extraction step crashes later.
    fetch(`${AI_SERVER_URL}/api/profile/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            email: currentUser.email,
            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Student'
        })
    }).then(r => r.json())
      .then(d => console.log('[ONBOARDING] Seed profile created:', d.success))
      .catch(e => console.warn('[ONBOARDING] Seed profile failed (non-fatal):', e));

    setupVoiceToggle();
    initChat();
});

function setupVoiceToggle() {
    const toggle = document.getElementById('voiceToggle');
    if (!toggle) return;

    toggle.onclick = () => {
        isVoiceEnabled = !isVoiceEnabled;
        const icon = toggle.querySelector('i');
        const span = toggle.querySelector('span');
        
        if (isVoiceEnabled) {
            icon.className = 'ph ph-speaker-high';
            span.textContent = 'Voice On';
            toggle.classList.add('btn-primary');
            toggle.classList.remove('btn-secondary');
        } else {
            icon.className = 'ph ph-speaker-none';
            span.textContent = 'Voice Off';
            toggle.classList.remove('btn-primary');
            toggle.classList.add('btn-secondary');
            if (currentAudio) currentAudio.pause();
        }
    };
}

async function playTTS(text) {
    if (!isVoiceEnabled || !text) return;

    try {
        const response = await fetch(`${AI_SERVER_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            if (currentAudio) currentAudio.pause();
            currentAudio = new Audio(url);
            currentAudio.play();
        }
    } catch (e) {
        console.error('TTS playback failed', e);
    }
}

async function initChat() {
    appendTyping();
    try {
        const response = await fetch(`${AI_SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Hello! I'm a new student ready to start onboarding. Introduce yourself and ask for my name.",
                userId: currentUser.id,
                conversationHistory: [],
                systemPrompt: ONBOARDING_SYSTEM_PROMPT,
                saveToHistory: false
            })
        });
        const data = await response.json();
        removeTyping();
        const aiMsg = data.response || "Hi! I'm Alex, your Waypoint counselor. I'm so excited to help you navigate your journey to college. To get us started, what's your full name?";
        appendAIMessage(aiMsg);
        conversationHistory.push({ role: 'assistant', content: aiMsg });
        playTTS(aiMsg);
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
                saveToHistory: false
            })
        });
        const data = await response.json();
        removeTyping();
        
        let aiMsg = data.response || "That's great! Tell me a bit more about your academic goals.";
        
        conversationHistory.push({ role: 'user', content: text });
        
        if (aiMsg.includes('[COMPLETED_ONBOARDING]')) {
            aiMsg = aiMsg.replace('[COMPLETED_ONBOARDING]', '').trim();
            appendAIMessage(aiMsg);
            conversationHistory.push({ role: 'assistant', content: aiMsg });
            playTTS(aiMsg);
            await extractAndFinish();
        } else {
            appendAIMessage(aiMsg);
            conversationHistory.push({ role: 'assistant', content: aiMsg });
            playTTS(aiMsg);
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
    // Slower progress bar because we're digging deeper
    const progress = Math.min(Math.floor(conversationHistory.length / 3), 5);
    
    dots.forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i < progress) dot.classList.add('done');
        if (i === progress) dot.classList.add('active');
    });
}

async function extractAndFinish() {
    appendTyping();
    appendAIMessage("I'm setting up your profile and roadmap now...");

    const extractionPrompt = `Extract the student's profile into JSON. If a piece of info is missing, use null.
JSON structure:
{
  "full_name": "string",
  "graduation_year": number,
  "is_transfer": boolean,
  "target_start_year": number or string,
  "intended_major": "string",
  "interests": ["string", "string"],
  "extracurriculars": [
    {"title": "string", "organization": "string", "description": "string", "years_active": [number]}
  ],
  "unweighted_gpa": number or null,
  "sat_score": number or null,
  "top_colleges": ["string", "string", "string"]
}
`;

    // Helper to save profile — always called, even in fallback
    const saveProfile = async (profileData = {}) => {
        const updates = {
            userId: currentUser.id,
            email: currentUser.email,
            full_name: profileData.full_name || currentUser.user_metadata?.full_name || 'Student',
            graduation_year: profileData.graduation_year || null,
            intended_major: profileData.intended_major || '',
            interests: profileData.interests || [],
            unweighted_gpa: profileData.unweighted_gpa || null,
            sat_score: profileData.sat_score || null
        };
        // Only include transfer fields if they exist (columns may not be in DB yet)
        if (profileData.is_transfer !== undefined) updates.is_transfer = profileData.is_transfer;
        if (profileData.target_start_year) updates.target_start_year = profileData.target_start_year;

        console.log('[ONBOARDING] Saving profile:', updates);
        try {
            const res = await fetch(`${AI_SERVER_URL}/api/profile/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const d = await res.json();
            console.log('[ONBOARDING] Profile save result:', d);
            return d.success;
        } catch (e) {
            console.error('[ONBOARDING] Profile save error:', e);
            return false;
        }
    };

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
        
        // Strip markdown code fences if AI wrapped the JSON in ```json ... ```
        const rawText = data.response || '';
        const stripped = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        const jsonStr = stripped.match(/\{[\s\S]*\}/)?.[0];
        
        let profileData = {};
        try {
            profileData = jsonStr ? JSON.parse(jsonStr) : {};
        } catch (parseErr) {
            console.warn('[ONBOARDING] JSON parse failed, using empty profile:', parseErr);
        }

        // 1. Save Profile
        await saveProfile(profileData);

        // 2. Add Colleges
        if (profileData.top_colleges && Array.isArray(profileData.top_colleges)) {
            for (const col of profileData.top_colleges) {
                if (col && col.toLowerCase() !== 'null') {
                    await addCollege({ user_id: currentUser.id, name: col, type: 'Target' });
                }
            }
        }

        // 3. Add Activities
        if (profileData.extracurriculars && Array.isArray(profileData.extracurriculars)) {
            const activities = profileData.extracurriculars.map(ec => ({
                user_id: currentUser.id,
                title: ec.title,
                organization: ec.organization,
                description: ec.description,
                years_active: ec.years_active || []
            }));
            if (activities.length > 0) {
                await supabase.from('activities').insert(activities).catch(e => console.warn('Activities insert error:', e));
            }
        }

        // 4. Generate Strategy Plan
        const planRes = await fetch(`${AI_SERVER_URL}/api/onboarding/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                colleges: profileData.top_colleges || [],
                profile: { full_name: profileData.full_name, graduation_year: profileData.graduation_year, intended_major: profileData.intended_major }
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
        console.error('[ONBOARDING] Finalization failed:', e);
        // ALWAYS save a minimal profile before giving up
        await saveProfile({});
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
        b.textContent = "Saving your profile...";
        b.disabled = true;
        sessionStorage.setItem('just_onboarded', 'true');
        setTimeout(() => {
            window.location.assign('dashboard.html?onboarded=true');
        }, 1200);
    };
}

function showFinishButton() {
    const container = document.getElementById('chatMessages');
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'width: 100%; margin-top: 20px; height: 50px; border-radius: 99px;';
    btn.textContent = "CONTINUE TO DASHBOARD";
    btn.onclick = () => {
        sessionStorage.setItem('just_onboarded', 'true');
        window.location.assign('dashboard.html?onboarded=true');
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
