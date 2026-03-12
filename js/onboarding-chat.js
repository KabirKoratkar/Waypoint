
import {
    getCurrentUser,
    updateProfile,
    addCollege,
    getUserProfile
} from './supabase-config.js';
import config from './config.js';

const AI_SERVER_URL = config.apiUrl;

const STEPS = [
    {
        key: 'name',
        prompt: "Welcome to Waypoint! I'm your admissions counselor. Let's start with your name — what should I call you?",
        field: 'full_name'
    },
    {
        key: 'grad_year',
        prompt: "Nice to meet you! What year do you graduate high school?",
        field: 'graduation_year',
        options: ['2025', '2026', '2027', '2028']
    },
    {
        key: 'major',
        prompt: "Awesome. What's your intended major or general field of interest?",
        field: 'intended_major'
    },
    {
        key: 'stats',
        prompt: "Got it. To give you the best advice, could you share your GPA and any test scores (SAT/ACT) if you have them? If not, just say 'skip'.",
        field: 'stats_str'
    },
    {
        key: 'colleges',
        prompt: "Last thing! Which top 3 colleges are you currently thinking about?",
        field: 'top_colleges'
    }
];

let currentUser = null;
let currentStepIdx = 0;
let profileData = {};

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.assign('login.html');
        return;
    }

    // Check if profile exists
    const profile = await getUserProfile(currentUser.id);
    if (profile && profile.graduation_year) {
        // Already onboarded? Go to dashboard
        // window.location.assign('dashboard.html');
    }

    initChat();
});

function initChat() {
    appendAIMessage(STEPS[0].prompt);
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
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendUserMessage(text);

    // Process answer
    const currentStep = STEPS[currentStepIdx];
    profileData[currentStep.key] = text;

    // Move to next step
    currentStepIdx++;
    updateStepper();

    if (currentStepIdx < STEPS.length) {
        appendTyping();
        setTimeout(() => {
            removeTyping();
            appendAIMessage(STEPS[currentStepIdx].prompt);
        }, 1200);
    } else {
        await finishOnboarding();
    }
}

async function finishOnboarding() {
    appendTyping();
    setTimeout(async () => {
        removeTyping();
        appendAIMessage("Perfect. I'm processing all of that and building your personalized roadmap...");

        const updates = {
            full_name: profileData.name || '',
            graduation_year: profileData.grad_year || '',
            intended_major: profileData.major || ''
        };

        // Simple parsing for stats if they provided some
        if (profileData.stats && profileData.stats.toLowerCase() !== 'skip') {
            const gpaMatch = profileData.stats.match(/(\d\.\d+)/);
            if (gpaMatch) updates.unweighted_gpa = parseFloat(gpaMatch[1]);

            const satMatch = profileData.stats.match(/(\d{3,4})/);
            if (satMatch) updates.sat_score = parseInt(satMatch[1]);
        }

        await updateProfile(currentUser.id, updates);

        // 2. Add Colleges
        if (profileData.colleges) {
            const collegeNames = profileData.colleges.split(/, | and | & /);
            for (const name of collegeNames) {
                if (name.trim()) {
                    await addCollege({
                        user_id: currentUser.id,
                        name: name.trim(),
                        type: 'Target'
                    });
                }
            }
        }

        // 3. Generate Roadmap (Plan)
        try {
            const response = await fetch(`${AI_SERVER_URL}/api/onboarding/plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    colleges: profileData.colleges ? profileData.colleges.split(',') : [],
                    profile: updates
                })
            });

        if (response.ok) {
            const data = await response.json();
            renderRoadmap(data.plan);
        } else {
            appendAIMessage("Your profile is set up! Let's head to the dashboard to see your next steps.");
            showFinishButton();
        }
    } catch (e) {
        console.error('Plan generation failed:', e);
        appendAIMessage("I've set up your profile! Let's jump into the dashboard to get started.");
        showFinishButton();
    }
}, 1000);
}

function renderRoadmap(plan) {
    const container = document.getElementById('chatMessages');
    
    const card = document.createElement('div');
    card.className = 'roadmap-card';
    card.innerHTML = `
        <h4 style="margin-top:0;">✨ Your Admissions Roadmap</h4>
        <p style="font-size: 14px; color: var(--gray-700); margin-bottom: 20px;">${plan.summary}</p>
        <div id="roadmapTasks"></div>
        <button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="window.location.assign('dashboard.html')">GO TO DASHBOARD</button>
    `;
    
    container.appendChild(card);
    
    const tasksDiv = card.querySelector('#roadmapTasks');
    plan.tasks.forEach(task => {
        const t = document.createElement('div');
        t.className = 'roadmap-task';
        t.innerHTML = `
            <div>
                <strong style="display:block; font-size:14px;">${task.title}</strong>
                <span style="font-size:12px; color:var(--gray-500);">${task.description}</span>
            </div>
        `;
        tasksDiv.appendChild(t);
    });
    
    container.scrollTop = container.scrollHeight;
}

function showFinishButton() {
    const container = document.getElementById('chatMessages');
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.marginTop = '20px';
    btn.textContent = "GO TO DASHBOARD";
    btn.onclick = () => window.location.assign('dashboard.html');
    container.appendChild(btn);
    container.scrollTop = container.scrollHeight;
}

function updateStepper() {
    const dots = document.querySelectorAll('.step-dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i < currentStepIdx) dot.classList.add('done');
        if (i === currentStepIdx) dot.classList.add('active');
    });
}

function appendAIMessage(text) {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML = `
        <div class="msg-bubble ai">${text}</div>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function appendTyping() {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.id = 'typingIndicator';
    row.innerHTML = `
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

function removeTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

function appendUserMessage(text) {
    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `
        <div class="msg-bubble user">${text}</div>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}
