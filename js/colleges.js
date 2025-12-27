import { getCurrentUser, getUserColleges, addCollege, updateCollege } from './supabase-config.js';
import { updateNavbarUser } from './ui.js';
import config from './config.js';

let currentUser = null;
let colleges = [];

// Export functions to global scope for HTML onclick
window.openAddCollegeModal = openAddCollegeModal;
window.getAIStrategy = getAIStrategy;
window.updateStatus = updateStatus;

document.addEventListener('DOMContentLoaded', async function () {
    console.log('Colleges page loaded, initializing...');

    // Attach event listeners IMMEDIATELY to be responsive
    const addCollegeBtn = document.getElementById('addCollegeBtn');
    if (addCollegeBtn) {
        console.log('Attaching click listener to addCollegeBtn');
        addCollegeBtn.addEventListener('click', openAddCollegeModal);
    } else {
        console.warn('addCollegeBtn not found in DOM!');
    }

    currentUser = await getCurrentUser();
    if (!currentUser) {
        console.warn('No current user, redirecting to login...');
        window.location.href = new URL('login.html', window.location.href).href;
        return;
    }

    updateNavbarUser(currentUser);
    await loadAndRenderColleges();
});

async function loadAndRenderColleges() {
    colleges = await getUserColleges(currentUser.id);
    const tbody = document.querySelector('.college-table tbody');

    // Update summary counts
    updateSummary();

    if (colleges.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: var(--space-xl);">No colleges added yet. Use the "Add College" button or ask the AI Counselor!</td></tr>';
        return;
    }

    tbody.innerHTML = colleges.map(c => `
        <tr data-id="${c.id}">
            <td>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                    <strong>${c.name}</strong>
                    <button class="btn btn-sm btn-ghost" onclick="getAIStrategy('${c.name}')" title="Get AI Strategy">✨</button>
                </div>
            </td>
            <td><span class="badge">${c.application_platform || 'TBD'}</span></td>
            <td>${c.essays_required?.length || 0} essays</td>
            <td><span class="badge ${getTestPolicyClass(c.test_policy)}">${c.test_policy || 'Unknown'}</span></td>
            <td>${c.lors_required || 0}</td>
            <td>${c.deadline ? new Date(c.deadline).toLocaleDateString() : 'TBD'}</td>
            <td>
                <select class="input btn-sm" onchange="updateStatus('${c.id}', this.value)" style="width: auto;">
                    <option value="Not Started" ${c.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                    <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${c.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
            </td>
        </tr>
    `).join('');
}

function updateSummary() {
    const total = colleges.length;
    const reach = colleges.filter(c => c.type === 'Reach').length;
    const target = colleges.filter(c => c.type === 'Target').length;
    const safety = colleges.filter(c => c.type === 'Safety').length;

    const cards = document.querySelectorAll('.grid-4 .card div:first-child');
    if (cards.length >= 4) {
        cards[0].textContent = total;
        cards[1].textContent = reach || colleges.filter(c => c.name.includes('Stanford') || c.name.includes('MIT')).length; // Fallback heuristic
        cards[2].textContent = target;
        cards[3].textContent = safety;
    }
}

async function updateStatus(id, status) {
    const updated = await updateCollege(id, { status });
    if (updated) {
        showNotification('Status updated!', 'success');
    }
}

async function openAddCollegeModal() {
    const btn = document.getElementById('addCollegeBtn');
    const originalText = btn ? btn.innerHTML : '+ Add College';

    const collegeName = prompt('Enter college name (e.g., Stanford University):');
    if (!collegeName) return;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Adding...';
        }

        showNotification(`Adding ${collegeName}...`, 'info');
        console.log(`Adding college: ${collegeName}`);

        const newCollege = await addCollege(currentUser.id, collegeName);

        if (newCollege) {
            console.log('College added successfully:', newCollege);
            showNotification(`${collegeName} added successfully!`, 'success');
            await loadAndRenderColleges();
        } else {
            throw new Error('Failed to add college - no response from server');
        }
    } catch (error) {
        console.error('Error adding college:', error);
        showNotification(`Error adding ${collegeName}: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

async function getAIStrategy(collegeName) {
    showNotification(`Getting AI strategy for ${collegeName}...`, 'info');

    try {
        const response = await fetch(`${config.apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Give me a concise 3-point strategy for applying to ${collegeName}. Focus on what they prioritize (e.g., essays, scores, or ECs).`,
                userId: currentUser.id,
                conversationHistory: []
            })
        });

        if (!response.ok) throw new Error('AI Server error');

        const data = await response.json();
        showAIModal(`${collegeName} Strategy`, data.response);
    } catch (error) {
        console.error('AI Strategy Error:', error);
        showNotification('Could not get AI strategy. Is the server running?', 'error');
    }
}

function showAIModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
        z-index: 2000; backdrop-filter: blur(5px);
    `;

    modal.innerHTML = `
        <div class="card" style="max-width: 500px; width: 90%; padding: var(--space-xl);">
            <h2 style="margin-bottom: var(--space-lg); font-size: var(--text-xl);">${title}</h2>
            <div style="line-height: 1.6; color: var(--gray-700); margin-bottom: var(--space-xl);">
                ${content.replace(/\n/g, '<br>')}
            </div>
            <button class="btn btn-primary w-full" onclick="this.closest('.modal-overlay').remove()">Got it!</button>
        </div>
    `;

    document.body.appendChild(modal);
}

function getTestPolicyClass(policy) {
    if (!policy) return '';
    if (policy.includes('Optional')) return 'badge-warning';
    if (policy.includes('Blind')) return 'badge-success';
    return 'badge-info';
}
