// Enhanced AI Counselor with Real Backend Integration
// Connects to AI server and uses function calling

import {
    getCurrentUser,
    getUserConversations,
    saveMessage,
    getUserProfile,
    isPremiumUser
} from './supabase-config.js';
import { updateNavbarUser } from './ui.js';
import config from './config.js';

const AI_SERVER_URL = config.apiUrl;

let conversationHistory = [];
let currentUser = null;
let currentModel = 'gpt'; // 'gpt' or 'claude'

document.addEventListener('DOMContentLoaded', async function () {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.href = new URL('login.html', window.location.href).href;
        return;
    }

    const profile = await getUserProfile(currentUser.id);
    updateNavbarUser(currentUser, profile);
    await loadConversationHistory(profile);

    // Systems Intelligence HUD Logs
    if (window.addIntelLog) {
        window.addIntelLog("Network: Establishing Secure Proxy tunnel...", "process");
        try {
            const health = await fetch(`${AI_SERVER_URL}/api/health`).catch(() => null);
            if (health && health.ok) {
                window.addIntelLog("Network: Core Systems online (Supabase Native)", "success");
            } else {
                window.addIntelLog("Network: Edge Timeout - falling back to local relay", "warning");
            }
        } catch (e) {
            window.addIntelLog("Network: Offline relay mode active", "warning");
        }
    }

    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const sendBtn = document.getElementById('sendBtn');
    const suggestions = document.querySelectorAll('.suggestion-chip');

    // Model Toggle Logic
    const modelButtons = document.querySelectorAll('#modelToggle button');
    modelButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            modelButtons.forEach(b => {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('btn-ghost');
            });
            this.classList.remove('btn-ghost');
            this.classList.add('btn-primary', 'active');
            currentModel = this.dataset.model;
            showNotification(`Switched to ${currentModel === 'claude' ? 'Claude 3.5 Sonnet' : 'GPT-4o'}`, 'info');
        });
    });

    // Send logic
    sendBtn.addEventListener('click', async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';
        addMessageToUI('user', text);
        await sendMessageToAI(text);
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    suggestions.forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.query;
            sendBtn.click();
        });
    });
});

async function loadConversationHistory(profile) {
    const messages = await getUserConversations(profile.id);
    if (!messages || messages.length === 0) return;

    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    messages.forEach(msg => {
        addMessageToUI(msg.role, msg.content);
        conversationHistory.push({ role: msg.role, content: msg.content });
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessageToUI(role, content) {
    const chatMessages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.innerHTML = `<div class="message-content">${content}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessageToAI(message) {
    if (window.addIntelLog) window.addIntelLog(`Inbound: ${message.substring(0, 20)}...`, "process");

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message assistant loading';
    loadingDiv.innerHTML = '<div class="spinner spinner-sm"></div>';
    document.getElementById('chatMessages').appendChild(loadingDiv);

    try {
        const endpoint = currentModel === 'claude' ? '/api/chat/claude' : '/api/chat';
        const response = await fetch(`${AI_SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                userId: currentUser.id,
                conversationHistory
            })
        });

        const data = await response.json();
        loadingDiv.remove();

        if (data.error) {
            addMessageToUI('assistant', `Sorry, I encountered an error: ${data.error}`);
        } else {
            addMessageToUI('assistant', data.response);
            conversationHistory.push({ role: 'user', content: message });
            conversationHistory.push({ role: 'assistant', content: data.response });

            if (data.functionCalled && window.addIntelLog) {
                window.addIntelLog(`Exec: tool_${data.functionCalled} success`, "success");
            }
        }
    } catch (e) {
        loadingDiv.remove();
        addMessageToUI('assistant', "I'm having trouble connecting to the intelligence server right now.");
    }
}

function showNotification(msg, type) {
    console.log(`[Notification] ${type}: ${msg}`);
}
