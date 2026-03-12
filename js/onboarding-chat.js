
import {
    getCurrentUser,
    updateProfile,
    addCollege,
    getUserProfile
} from './supabase-config.js';
import config from './config.js';

const AI_SERVER_URL = config.apiUrl;

const ONBOARDING_SYSTEM_PROMPT = `
You are Alex, a warm, professional, and highly proactive college admissions counselor at Waypoint. 
This is your first meeting with a student, and your goal is to build their profile while making them feel supported and excited.

MISSION: You MUST lead the conversation. Do not wait for the student to volunteer information. Use leading questions to gather:
1. Full Name (e.g., "To start our journey, what's your full name?")
2. Graduation Year (2025-2030) (e.g., "Great to meet you, [Name]! What year will you be walking across that graduation stage?")
3. Intended Major or interest (e.g., "Got it. Thinking about the future, do you have a specific major in mind, or are you exploring different fields like STEM, Arts, or Humanities?")
4. Academic Stats (GPA and Optional SAT/ACT)
5. Top 3 Colleges they are interested in

CONVERSATIONAL RULES:
- BE PROACTIVE. Every single response you give MUST end with a clear, leading question to move to the next piece of info.
- ASK ONLY ONE THING AT A TIME.
- If they mention a goal, give a quick "counselor tip" (e.g., "UC Berkeley is fantastic for Engineering!").
- Keep it encouraging. Use their name once you have it.
- Once you have all 5 items, summarize their profile enthusiastically and end your message with exactly: "[COMPLETED_ONBOARDING]"
`;

let currentUser = null;
let conversationHistory = []; 
let isProcessing = false;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.assign('login.html');
        return;
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
    // Simple turn-based progress for the UI dots
    const progress = Math.min(Math.floor(conversationHistory.length / 2), 5);
    
    dots.forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i < progress) dot.classList.add('done');
        if (i === progress) dot.classList.add('active');
    });
}

async function extractAndFinish() {
    appendTyping();
    appendAIMessage("I'm putting all those details into your roadmap now...");

    const extractionPrompt = `Extract the student's profile from our chat into JSON:
{
  "full_name": "string",
  "graduation_year": number,
  "intended_major": "string",
  "unweighted_gpa": number or null,
  "sat_score": number or null,
  "top_colleges": ["string", "string", "string"]
}
Only return JSON.`;

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
        const jsonStr = data.response.match(/\{[\s\S]*\}/)?.[0];
        const profileData = JSON.parse(jsonStr);

        const updates = {
            id: currentUser.id,
            full_name: profileData.full_name || 'Student',
            graduation_year: profileData.graduation_year || 2026,
            intended_major: profileData.intended_major || '',
            unweighted_gpa: profileData.unweighted_gpa || null,
            sat_score: profileData.sat_score || null
        };

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
        window.location.assign('dashboard.html');
    };
}

function showFinishButton() {
    const container = document.getElementById('chatMessages');
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'width: 100%; margin-top: 20px; height: 50px; border-radius: 99px;';
    btn.textContent = "CONTINUE TO DASHBOARD";
    btn.onclick = () => window.location.assign('dashboard.html');
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
