import { getCurrentUser, upsertProfile, addCollege as supabaseAddCollege, getUserProfile, searchCollegeCatalog, searchHighSchools, addHighSchool, addCollegeToCatalog } from './supabase-config.js';
import config from './config.js';

let currentStep = 1;
const totalSteps = 6;
let selectedColleges = [];
let selectedInterests = [];
let currentUser = null;
let userRole = 'student';
let selectedPlan = 'trial';

// ─── Persistence Helpers ────────────────────────────────────────────
function saveOnboardingState() {
    const state = {
        currentStep,
        selectedColleges,
        selectedInterests,
        userRole,
        selectedPlan,
        fullName: document.getElementById('fullName')?.value || '',
        studentName: document.getElementById('studentName')?.value || '',
        schoolName: document.getElementById('schoolName')?.value || '',
        gradYear: document.getElementById('gradYear')?.value || '',
        uwGPA: document.getElementById('uwGPA')?.value || '',
        satScore: document.getElementById('satScore')?.value || '',
        actScore: document.getElementById('actScore')?.value || '',
        intensityLevel: document.getElementById('intensityLevel')?.value || 'Balanced',
        submissionLeeway: document.getElementById('submissionLeeway')?.value || '3',
        topGoal: document.getElementById('topGoal')?.value || '',
    };
    sessionStorage.setItem('waypoint_onboarding', JSON.stringify(state));
}

function restoreOnboardingState() {
    const saved = sessionStorage.getItem('waypoint_onboarding');
    if (!saved) return false;

    try {
        const state = JSON.parse(saved);

        selectedColleges = state.selectedColleges || [];
        selectedInterests = state.selectedInterests || [];
        userRole = state.userRole || 'student';
        selectedPlan = state.selectedPlan || 'trial';

        // Restore form values
        if (state.fullName) document.getElementById('fullName').value = state.fullName;
        if (state.studentName) document.getElementById('studentName').value = state.studentName;
        if (state.schoolName) document.getElementById('schoolName').value = state.schoolName;
        if (state.gradYear) document.getElementById('gradYear').value = state.gradYear;
        if (state.uwGPA) document.getElementById('uwGPA').value = state.uwGPA;
        if (state.satScore) document.getElementById('satScore').value = state.satScore;
        if (state.actScore) document.getElementById('actScore').value = state.actScore;
        if (state.intensityLevel) document.getElementById('intensityLevel').value = state.intensityLevel;
        if (state.submissionLeeway) document.getElementById('submissionLeeway').value = state.submissionLeeway;
        if (state.topGoal) document.getElementById('topGoal').value = state.topGoal;

        // Restore UI state
        selectRole(userRole);
        updateOnboardingLabels(userRole);
        renderColleges();
        renderInterests();
        selectPlan(selectedPlan);

        // Restore step
        if (state.currentStep > 1 && state.currentStep <= totalSteps) {
            // Don't restore to AI plan step (6) since it needs regeneration
            currentStep = state.currentStep >= 6 ? 5 : state.currentStep;
            showStep(currentStep);
        }

        return true;
    } catch (e) {
        console.warn('Failed to restore onboarding state:', e);
        return false;
    }
}

// ─── Init ────────────────────────────────────────────────────────────
async function init() {
    showLoading('Securing your session...');

    // Wait a moment for Supabase to process hash from URL (email confirmation links)
    if (window.location.hash || window.location.search.includes('access_token')) {
        console.log('Detected auth token in URL, waiting for session...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    currentUser = await getCurrentUser();

    // If no user found immediately, wait a moment and try one more time
    if (!currentUser) {
        console.log('No session found, waiting briefly...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        currentUser = await getCurrentUser();
    }

    if (!currentUser) {
        console.log('Final check: No session found, redirecting to login');
        window.location.assign('login.html');
        return;
    }

    // Strict Email Confirmation Check (unless mock user)
    const isMockUser = currentUser.id && currentUser.id.startsWith('dev-user-');
    if (!isMockUser && !currentUser.email_confirmed_at) {
        window.location.assign(`confirm-email.html?email=${encodeURIComponent(currentUser.email)}`);
        return;
    }

    // Check if already onboarded (Profile complete)
    try {
        const profile = await getUserProfile(currentUser.id);
        if (profile && profile.graduation_year) {
            console.log('Profile already complete, skipping onboarding...');
            window.location.assign('dashboard.html');
            return;
        }
    } catch (err) {
        console.log('No profile yet or error fetching, proceeding to onboarding steps');
    }

    hideLoading();

    // Try to restore saved state
    const restored = restoreOnboardingState();
    if (!restored) {
        showStep(1);
    }

    // Setup autocomplete for Colleges, High Schools, and Interests
    setupCollegeSearch();
    setupHighSchoolSearch();
    setupInterestInput();
}

// ─── High School Search ──────────────────────────────────────────────
function setupHighSchoolSearch() {
    const input = document.getElementById('schoolName');
    const container = document.getElementById('highSchoolSearchResults');

    if (!input || !container) return;

    let debounceTimer;

    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (query.length < 2) {
            container.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(async () => {
            const results = await searchHighSchools(query);
            renderHighSchoolDropdown(results, query, container);
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.style.display = 'none';
        }
    });
}

function renderHighSchoolDropdown(results, query, container) {
    if (results.length === 0) {
        container.innerHTML = `
            <div style="padding: 12px;" class="search-item">
                <div style="font-size: 13px; color: var(--gray-500); margin-bottom: 8px;">No high schools found matching "${query}"</div>
                <button onclick="selectHighSchool('${query.replace(/'/g, "\\'")}')"
                        class="btn btn-ghost btn-sm"
                        style="width: 100%; border: 1px dashed var(--gray-300); color: var(--primary-blue);">
                    + Add "${query}" as your high school
                </button>
            </div>
        `;
    } else {
        let html = results.map(hs => `
            <div class="search-item"
                 style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--gray-50);"
                 onclick="selectHighSchool('${hs.name.replace(/'/g, "\\'")}')">
                <div style="font-weight: 700; font-size: 14px; color: var(--gray-800);">${hs.name}</div>
                <div style="font-size: 11px; color: var(--gray-500);">${hs.city ? hs.city + ', ' : ''}${hs.state || ''}</div>
            </div>
        `).join('');

        // Add "Add manually" option
        html += `
            <div class="search-item" style="padding: 8px; background: var(--gray-50); text-align: center;">
                <button onclick="selectHighSchool('${query.replace(/'/g, "\\'")}')"
                        style="background: none; border: none; color: var(--gray-400); font-size: 10px; cursor: pointer; text-decoration: underline;">
                    Don't see it? Add "${query}" manually
                </button>
            </div>
        `;
        container.innerHTML = html;
    }
    container.style.display = 'block';
}

window.selectHighSchool = (name) => {
    const input = document.getElementById('schoolName');
    const container = document.getElementById('highSchoolSearchResults');
    if (input) input.value = name;
    if (container) container.style.display = 'none';

    // Save to DB if it's new
    addHighSchool(name).catch(e => console.warn('Could not add high school to DB:', e));
    saveOnboardingState();
};

// ─── Interest Management ─────────────────────────────────────────────
function setupInterestInput() {
    const input = document.getElementById('interestInput');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim();
            if (val && !selectedInterests.includes(val)) {
                selectedInterests.push(val);
                renderInterests();
                saveOnboardingState();
            }
            input.value = '';
        }
    });
}

window.toggleInterest = (name) => {
    const idx = selectedInterests.indexOf(name);
    if (idx > -1) {
        selectedInterests.splice(idx, 1);
    } else {
        selectedInterests.push(name);
    }
    renderInterests();
    saveOnboardingState();
};

window.removeInterest = (name) => {
    selectedInterests = selectedInterests.filter(i => i !== name);
    renderInterests();
    saveOnboardingState();
};

function renderInterests() {
    // Render tags
    const tagsContainer = document.getElementById('interestTags');
    if (tagsContainer) {
        tagsContainer.innerHTML = selectedInterests.map(interest => `
            <span class="interest-tag">
                ${interest}
                <span class="remove-interest" onclick="removeInterest('${interest.replace(/'/g, "\\'")}')">&times;</span>
            </span>
        `).join('');
    }

    // Update pill states
    document.querySelectorAll('.interest-pill').forEach(pill => {
        const name = pill.textContent.replace(/^[^\w]+/, '').trim();
        if (selectedInterests.includes(name)) {
            pill.classList.add('selected');
        } else {
            pill.classList.remove('selected');
        }
    });
}

// ─── Role Selection ──────────────────────────────────────────────────
window.selectRole = (role) => {
    userRole = role;
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });
    saveOnboardingState();
};

// ─── Plan Selection ──────────────────────────────────────────────────
window.selectPlan = (plan) => {
    selectedPlan = plan;
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.toggle('active', card.dataset.plan === plan);
    });
    saveOnboardingState();
};

// ─── College Search ──────────────────────────────────────────────────
let highlightedIndex = -1;
let currentResults = [];

function setupCollegeSearch() {
    const input = document.getElementById('collegeInput');
    const container = document.getElementById('onboardingSearchResults');

    if (!input || !container) return;

    input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            container.style.display = 'none';
            highlightedIndex = -1;
            return;
        }

        currentResults = await searchCollegeCatalog(query);
        highlightedIndex = currentResults.length > 0 ? 0 : -1;
        renderSearchDropdown(currentResults, container);
    });

    input.addEventListener('keydown', (e) => {
        const items = container.querySelectorAll('.search-item');
        if (container.style.display === 'block' && items.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = (highlightedIndex + 1) % items.length;
                updateHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
                updateHighlight(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < currentResults.length) {
                    const selected = currentResults[highlightedIndex];
                    if (selected) selectOnboardingCollege(selected.name);
                    else addCollegeToList();
                } else {
                    addCollegeToList();
                }
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            addCollegeToList();
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.style.display = 'none';
        }
    });
}

function updateHighlight(items) {
    items.forEach((item, index) => {
        if (index === highlightedIndex) {
            item.style.background = 'var(--gray-100)';
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.style.background = 'transparent';
        }
    });
}

function renderSearchDropdown(results, container) {
    const query = document.getElementById('collegeInput').value.trim();

    if (results.length === 0) {
        container.innerHTML = `
            <div style="padding: 12px;" class="search-item">
                <div style="font-size: 13px; color: var(--gray-500); margin-bottom: 8px;">No colleges found matching "${query}"</div>
                <button onclick="selectOnboardingCollege('${query.replace(/'/g, "\\'")}')"
                        class="btn btn-ghost btn-sm"
                        style="width: 100%; border: 1px dashed var(--gray-300); color: var(--primary-blue);">
                    + Add "${query}" (AI will research)
                </button>
            </div>
        `;
    } else {
        let html = results.map((c, idx) => `
            <div class="search-item"
                 style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--gray-50);"
                 onclick="selectOnboardingCollege('${c.name.replace(/'/g, "\\'")}')"
                 onmouseover="highlightedIndex = ${idx}; updateHighlight(this.parentElement.querySelectorAll('.search-item'))">
                <div style="font-weight: 700; font-size: 14px; color: var(--gray-800);">${c.name}</div>
                <div style="font-size: 11px; color: var(--gray-500);">${c.location || 'University'}</div>
            </div>
        `).join('');

        html += `
            <div class="search-item" style="padding: 8px; background: var(--gray-50); text-align: center;">
                <button onclick="selectOnboardingCollege('${query.replace(/'/g, "\\'")}')"
                        style="background: none; border: none; color: var(--gray-400); font-size: 10px; cursor: pointer; text-decoration: underline;">
                    Don't see it? Add "${query}" manually
                </button>
            </div>
        `;
        container.innerHTML = html;
        updateHighlight(container.querySelectorAll('.search-item'));
    }
    container.style.display = 'block';
}

window.selectOnboardingCollege = (name) => {
    const input = document.getElementById('collegeInput');
    const container = document.getElementById('onboardingSearchResults');
    if (input) input.value = name;
    if (container) container.style.display = 'none';
    addCollegeToList();

    // Also add to global catalog if it's a new college
    addCollegeToCatalog(name).catch(e => console.warn('Could not add to catalog:', e));
};

// ─── Step Navigation ─────────────────────────────────────────────────
function showStep(step) {
    for (let i = 1; i <= totalSteps; i++) {
        const stepEl = document.getElementById(`step${i}`);
        const indicatorEl = document.getElementById(`indicator${i}`);
        if (stepEl) stepEl.style.display = 'none';
        if (indicatorEl) indicatorEl.classList.remove('active');
    }

    const currentStepEl = document.getElementById(`step${step}`);
    const currentIndicatorEl = document.getElementById(`indicator${step}`);
    if (currentStepEl) currentStepEl.style.display = 'block';
    if (currentIndicatorEl) currentIndicatorEl.classList.add('active');

    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    if (backBtn) backBtn.style.display = step > 1 ? 'block' : 'none';
    if (nextBtn) nextBtn.style.display = step < totalSteps ? 'block' : 'none';
    if (finishBtn) finishBtn.style.display = step === totalSteps ? 'block' : 'none';
}

function nextStep() {
    if (currentStep === 1) {
        updateOnboardingLabels(userRole);
    }

    if (currentStep === 2) {
        const fullName = document.getElementById('fullName').value;
        const gradYear = document.getElementById('gradYear').value;

        if (!fullName) {
            if (window.showNotification) window.showNotification('Please enter your full name', 'error');
            else alert('Please enter your full name');
            return;
        }

        if (!gradYear) {
            if (window.showNotification) window.showNotification('Please select your graduation year', 'error');
            else alert('Please select your graduation year');
            return;
        }
    }

    if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
        saveOnboardingState();

        // If we just moved to step 5 (AI plan), trigger plan generation
        if (currentStep === 5) {
            generateAIPlan();
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
        saveOnboardingState();
    }
}

function updateOnboardingLabels(role) {
    const isParent = role === 'parent';

    const labelFullName = document.getElementById('labelFullName');
    const studentDetailSection = document.getElementById('studentDetailSection');
    const labelSchoolName = document.getElementById('labelSchoolName');
    const labelGradYear = document.getElementById('labelGradYear');
    const labelInterests = document.getElementById('labelInterests');
    const labelAcademicStats = document.getElementById('labelAcademicStats');

    if (labelFullName) labelFullName.textContent = isParent ? "Your Parent/Guardian Name" : "Your Full Name";
    if (studentDetailSection) studentDetailSection.style.display = isParent ? "block" : "none";
    if (labelSchoolName) labelSchoolName.textContent = isParent ? "Student's High School" : "High School";
    if (labelGradYear) labelGradYear.textContent = isParent ? "Student's Graduation Year" : "Graduation Year";
    if (labelInterests) labelInterests.textContent = isParent ? "Student's Interests" : "Interests";
    if (labelAcademicStats) labelAcademicStats.textContent = isParent ? "Student's Academic Stats" : "Academic Stats (Optional but Recommended)";

    const labelCollegeList = document.getElementById('labelCollegeList');
    const labelCollegeSubtitle = document.getElementById('labelCollegeSubtitle');
    if (labelCollegeList) labelCollegeList.textContent = isParent ? "Build Your Student's College List" : "Add Your College List";
    if (labelCollegeSubtitle) labelCollegeSubtitle.textContent = isParent ? "Start with a few colleges your student is interested in." : "Start with a few colleges you're interested in. You can add more later.";

    const labelStrategy = document.getElementById('labelStrategy');
    const labelStrategySubtitle = document.getElementById('labelStrategySubtitle');
    const labelGoal = document.getElementById('labelGoal');
    if (labelStrategy) labelStrategy.textContent = isParent ? "Your Student's Application Strategy" : "Your Application Strategy";
    if (labelStrategySubtitle) labelStrategySubtitle.textContent = isParent ? "How would you like to help your student tackle their journey?" : "How do you want to tackle your application journey?";
    if (labelGoal) labelGoal.textContent = isParent ? "Your #1 Goal for Your Student" : "Your #1 Goal This Year";

    const labelPlanLoading = document.getElementById('labelPlanLoading');
    if (labelPlanLoading) labelPlanLoading.textContent = isParent ? "AI is crafting a personalized schedule for your student..." : "AI is crafting your personalized application schedule...";
}

// ─── AI Plan Generation (Faster: model switch to gpt-4o-mini) ────────
async function generateAIPlan() {
    const planLoading = document.getElementById('planLoading');
    const planDisplay = document.getElementById('planDisplay');
    const planSummary = document.getElementById('planSummary');
    const tasksContainer = document.getElementById('tasksContainer');
    const nextBtn = document.getElementById('nextBtn');

    if (!planLoading || !planDisplay) return;

    try {
        // Disable next button while generating
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.5';
            nextBtn.innerHTML = 'Generating plan...';
        }

        const gradYear = document.getElementById('gradYear').value;
        const fullName = document.getElementById('fullName').value;
        const leeway = document.getElementById('submissionLeeway').value;
        const schoolName = document.getElementById('schoolName').value;

        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(`${config.apiUrl}/api/onboarding/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                userId: currentUser.id,
                colleges: selectedColleges,
                profile: {
                    graduation_year: gradYear,
                    interests: selectedInterests,
                    full_name: fullName,
                    submission_leeway: leeway,
                    school_name: schoolName
                }
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Failed to generate plan');

        const data = await response.json();
        const plan = data.plan;

        planSummary.textContent = plan.summary;
        tasksContainer.innerHTML = '';

        plan.tasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'task-card';
            taskEl.style.padding = 'var(--space-md)';
            taskEl.style.marginBottom = 'var(--space-sm)';

            let borderColor = 'var(--primary-blue)';
            if (task.priority === 'High') borderColor = 'var(--error)';
            if (task.priority === 'Medium') borderColor = 'var(--warning)';

            taskEl.style.borderLeft = `4px solid ${borderColor}`;

            taskEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <h5 style="margin: 0; font-size: var(--text-base); font-weight: 700;">${task.title}</h5>
                    <span class="badge" style="font-size: 10px;">${task.category}</span>
                </div>
                <p style="margin: 0 0 8px; font-size: var(--text-xs); color: var(--gray-600);">${task.description}</p>
                <div style="font-size: 10px; font-weight: 600; color: var(--gray-500);">📅 Due: ${new Date(task.dueDate).toLocaleDateString()}</div>
            `;
            tasksContainer.appendChild(taskEl);
        });

        planLoading.style.display = 'none';
        planDisplay.style.display = 'block';

        // Re-enable next button to proceed to payment step
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
            nextBtn.innerHTML = 'Continue';
        }

    } catch (error) {
        console.error('Plan Generation Error:', error);
        const isTimeout = error.name === 'AbortError';
        planLoading.innerHTML = `<p style="color: var(--error);">${isTimeout ? 'Plan generation timed out.' : 'Failed to generate your plan: ' + error.message} But don't worry, you can still continue!</p>`;

        // Re-enable next button even on error
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
            nextBtn.innerHTML = 'Continue';
        }
    }
}

// ─── College List Management ─────────────────────────────────────────
function addCollegeToList() {
    const input = document.getElementById('collegeInput');
    const collegeName = input.value.trim();

    if (!collegeName) {
        if (window.showNotification) window.showNotification('Please enter a college name', 'error');
        return;
    }

    if (selectedColleges.includes(collegeName)) {
        if (window.showNotification) window.showNotification('College already added', 'info');
        input.value = '';
        return;
    }

    selectedColleges.push(collegeName);
    renderColleges();
    saveOnboardingState();

    input.value = '';
    if (window.showNotification) window.showNotification(`Added ${collegeName}`, 'success');
}

function removeCollege(collegeName) {
    selectedColleges = selectedColleges.filter(c => c !== collegeName);
    renderColleges();
    saveOnboardingState();
    if (window.showNotification) window.showNotification(`Removed ${collegeName}`, 'info');
}

function renderColleges() {
    const collegeList = document.getElementById('collegeList');
    if (!collegeList) return;

    collegeList.innerHTML = '';
    selectedColleges.forEach(college => {
        const tag = document.createElement('div');
        tag.className = 'college-tag';
        tag.innerHTML = `
            ${college}
            <span class="remove-college" data-college="${college}" style="cursor:pointer; margin-left: 8px;">×</span>
        `;
        collegeList.appendChild(tag);
    });

    collegeList.querySelectorAll('.remove-college').forEach(btn => {
        btn.onclick = () => removeCollege(btn.dataset.college);
    });
}

// ─── DOMContentLoaded ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    await init();

    const form = document.getElementById('onboardingForm');
    const collegeInput = document.getElementById('collegeInput');

    // Export functions to window for HTML onclick
    window.nextStep = nextStep;
    window.prevStep = prevStep;
    window.addCollege = addCollegeToList;
    window.updateHighlight = updateHighlight;
    window.highlightedIndex = highlightedIndex;

    // Allow adding college with Enter key
    if (collegeInput) {
        collegeInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCollegeToList();
            }
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const gradYear = document.getElementById('gradYear').value;
            const fullName = document.getElementById('fullName').value;
            const schoolName = document.getElementById('schoolName').value;
            const uwGPA = document.getElementById('uwGPA').value;
            const satScore = document.getElementById('satScore').value;
            const actScore = document.getElementById('actScore').value;
            const studentName = document.getElementById('studentName')?.value;

            if (window.showNotification) window.showNotification('Saving your profile...', 'info');

            try {
                const intensityLevel = document.getElementById('intensityLevel').value;
                const submissionLeeway = parseInt(document.getElementById('submissionLeeway').value);
                const topGoal = document.getElementById('topGoal').value.trim();

                const profileData = {
                    id: currentUser.id,
                    graduation_year: parseInt(gradYear),
                    interests: selectedInterests,
                    full_name: fullName,
                    school_name: schoolName,
                    unweighted_gpa: uwGPA ? parseFloat(uwGPA) : null,
                    sat_score: satScore ? parseInt(satScore) : null,
                    act_score: actScore ? parseInt(actScore) : null,
                    intensity_level: intensityLevel,
                    submission_leeway: submissionLeeway,
                    top_goal: topGoal,
                    user_role: userRole,
                };

                // If parent, save student name too
                if (userRole === 'parent' && studentName) {
                    profileData.student_name = studentName;
                }

                // Add email
                if (currentUser.email) {
                    profileData.email = currentUser.email;
                }

                console.log('Creating profile...', profileData);
                await upsertProfile(profileData);
                console.log('Profile created successfully');

                // Add Colleges
                const addPromises = selectedColleges.map(name => supabaseAddCollege(currentUser.id, name));
                await Promise.all(addPromises);

                // Handle plan selection
                if (selectedPlan === 'pro') {
                    // Redirect to Stripe checkout
                    try {
                        const checkoutResponse = await fetch(`${config.apiUrl}/api/payments/create-checkout`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: currentUser.id, email: currentUser.email })
                        });
                        if (checkoutResponse.ok) {
                            const { url } = await checkoutResponse.json();
                            if (url) {
                                sessionStorage.removeItem('waypoint_onboarding');
                                window.location.assign(url);
                                return;
                            }
                        }
                    } catch (err) {
                        console.error('Checkout error:', err);
                        // Continue to dashboard if checkout fails
                    }
                }

                if (window.showNotification) window.showNotification('Setup complete! Welcome to Waypoint', 'success');

                // Verify profile exists before redirecting
                const verifyProfile = await getUserProfile(currentUser.id);
                if (!verifyProfile) {
                    throw new Error('Profile was not saved correctly.');
                }

                // Clear saved onboarding state
                sessionStorage.removeItem('waypoint_onboarding');

                window.location.assign('dashboard.html');
            } catch (error) {
                console.error('Onboarding Error:', error);
                if (window.showNotification) window.showNotification('Error: ' + error.message, 'error');
            }
        });
    }
});
