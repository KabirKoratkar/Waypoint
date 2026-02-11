import { getCurrentUser, upsertProfile, addCollege as supabaseAddCollege, getUserProfile, searchCollegeCatalog } from './supabase-config.js';
import config from './config.js';

let currentStep = 1;
const totalSteps = 5;
let selectedColleges = [];
let currentUser = null;
let userRole = 'student';

async function init() {
    showLoading('Securing your session...');

    // 1. Wait a moment for Supabase to process hash from URL (email confirmation links)
    if (window.location.hash || window.location.search.includes('access_token')) {
        console.log('Detected auth token in URL, waiting for session...');
        // Small delay to allow Supabase client to catch the hash
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

    // 2. Check if already onboarded (Profile complete)
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
    showStep(1);

    // Setup Autocomplete for both Colleges and Majors
    setupCollegeSearch();
    setupMajorSearch();
}

function setupMajorSearch() {
    const input = document.getElementById('intendedMajor');
    const container = document.getElementById('majorSearchResults');

    if (!input || !container) return;

    const majors = [
        { name: 'Computer Science', abbrev: ['cs', 'comp sci'] },
        { name: 'Mechanical Engineering', abbrev: ['me', 'mech e'] },
        { name: 'Electrical Engineering', abbrev: ['ee', 'elec e'] },
        { name: 'Bioengineering', abbrev: ['bioe', 'bio e'] },
        { name: 'Chemical Engineering', abbrev: ['cheme', 'chem e'] },
        { name: 'Aerospace Engineering', abbrev: ['aero'] },
        { name: 'Biology', abbrev: ['bio'] },
        { name: 'Chemistry', abbrev: ['chem'] },
        { name: 'Physics', abbrev: ['phys'] },
        { name: 'Mathematics', abbrev: ['math'] },
        { name: 'Economics', abbrev: ['econ'] },
        { name: 'Psychology', abbrev: ['psych'] },
        { name: 'Political Science', abbrev: ['poli sci', 'polsci'] },
        { name: 'International Relations', abbrev: ['ir'] },
        { name: 'Business Administration', abbrev: ['biz', 'business'] },
        { name: 'Finance', abbrev: ['fin'] },
        { name: 'Marketing', abbrev: ['mktg'] },
        { name: 'Public Policy', abbrev: ['pub pol'] },
        { name: 'Nursing', abbrev: [] },
        { name: 'Architecture', abbrev: ['arch'] },
        { name: 'Graphic Design', abbrev: ['design'] },
        { name: 'Pre-Med', abbrev: [] },
        { name: 'Pre-Law', abbrev: [] },
        { name: 'English', abbrev: [] },
        { name: 'History', abbrev: [] },
        { name: 'Philosophy', abbrev: ['phil'] }
    ];

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 1) {
            container.style.display = 'none';
            return;
        }

        const filtered = majors.filter(m =>
            m.name.toLowerCase().includes(query) ||
            m.abbrev.some(a => a.includes(query))
        ).slice(0, 8);

        renderMajorDropdown(filtered, container);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.style.display = 'none';
        }
    });
}

function renderMajorDropdown(results, container) {
    if (results.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = results.map(m => `
        <div class="search-item" 
             style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--gray-50); font-size: 14px;" 
             onclick="selectMajor('${m.name}')">
            <strong>${m.name}</strong>
        </div>
    `).join('');
    container.style.display = 'block';
}

window.selectMajor = (name) => {
    const input = document.getElementById('intendedMajor');
    const container = document.getElementById('majorSearchResults');
    if (input) input.value = name;
    if (container) container.style.display = 'none';
};

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
        highlightedIndex = currentResults.length > 0 ? 0 : -1; // Default to first result
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
                const visibleItems = container.querySelectorAll('.search-item');
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
                    + Add "${query}" Anyway (AI will research)
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

        // Add "Add manually" option
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
};

function showStep(step) {
    // Hide all steps
    for (let i = 1; i <= totalSteps; i++) {
        const stepEl = document.getElementById(`step${i}`);
        const indicatorEl = document.getElementById(`indicator${i}`);
        if (stepEl) stepEl.style.display = 'none';
        if (indicatorEl) indicatorEl.classList.remove('active');
    }

    // Show current step
    const currentStepEl = document.getElementById(`step${step}`);
    const currentIndicatorEl = document.getElementById(`indicator${step}`);
    if (currentStepEl) currentStepEl.style.display = 'block';
    if (currentIndicatorEl) currentIndicatorEl.classList.add('active');

    // Update buttons
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    if (step === 5) {
        updateDeadlineOptions();
    }

    if (backBtn) backBtn.style.display = step > 1 ? 'block' : 'none';
    if (nextBtn) nextBtn.style.display = step < totalSteps ? 'block' : 'none';
    if (finishBtn) finishBtn.style.display = step === totalSteps ? 'block' : 'none';
}

function updateDeadlineOptions() {
    const labels = document.querySelectorAll('.deadline-label');
    const hasColleges = selectedColleges.length > 0;
    const hasUC = selectedColleges.some(c => c.toLowerCase().includes('university of california') || c.toLowerCase().includes('uc '));
    // Most schools are Common App, so we check if there are any schools at all for CA
    const hasCommonApp = hasColleges && !selectedColleges.every(c => c.toLowerCase().includes('university of california') || c.toLowerCase().includes('uc '));

    labels.forEach(label => {
        const type = label.dataset.type;
        if (type === 'UC') {
            label.style.display = hasUC ? 'flex' : 'none';
        } else if (type === 'CA') {
            label.style.display = hasCommonApp ? 'flex' : 'none';
        } else {
            // ED, EA, RD are usually relevant if any college is selected
            label.style.display = hasColleges ? 'flex' : 'none';
        }
    });

    const deadlineOptions = document.getElementById('deadlineOptions');
    const placeholder = document.getElementById('noCollegesPlaceholder');

    if (!hasColleges) {
        if (!placeholder) {
            const p = document.createElement('div');
            p.id = 'noCollegesPlaceholder';
            p.style.padding = 'var(--space-xl)';
            p.style.textAlign = 'center';
            p.style.background = 'var(--gray-50)';
            p.style.borderRadius = 'var(--radius-lg)';
            p.style.border = '1px dashed var(--gray-300)';
            p.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: var(--space-sm);">📋</div>
                <p style="color: var(--gray-600); font-size: var(--text-sm); margin: 0;">Add some colleges in the previous step to see relevant deadline and essay options.</p>
            `;
            deadlineOptions.parentNode.insertBefore(p, deadlineOptions);
        }
        deadlineOptions.style.display = 'none';
    } else {
        if (placeholder) placeholder.remove();
        deadlineOptions.style.display = 'flex';
    }
}

function nextStep() {
    if (currentStep === 1) {
        // Step 1 is now Role Selection
        const selectedRole = document.querySelector('input[name="userRole"]:checked')?.value;
        userRole = selectedRole || 'student';
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

        // If we just moved to step 5, trigger plan generation
        if (currentStep === 5) {
            generateAIPlan();
        }
    }
}

function updateOnboardingLabels(role) {
    const isParent = role === 'parent';

    // Step 2 Labels
    const labelFullName = document.getElementById('labelFullName');
    const studentDetailSection = document.getElementById('studentDetailSection');
    const labelSchoolName = document.getElementById('labelSchoolName');
    const labelGradYear = document.getElementById('labelGradYear');
    const labelMajor = document.getElementById('labelMajor');
    const labelAcademicStats = document.getElementById('labelAcademicStats');

    if (labelFullName) labelFullName.textContent = isParent ? "Your Parent/Guardian Name" : "Your Full Name";
    if (studentDetailSection) studentDetailSection.style.display = isParent ? "block" : "none";
    if (labelSchoolName) labelSchoolName.textContent = isParent ? "Student's High School" : "High School";
    if (labelGradYear) labelGradYear.textContent = isParent ? "Student's Graduation Year" : "Graduation Year";
    if (labelMajor) labelMajor.textContent = isParent ? "Student's Intended Major" : "Intended Major";
    if (labelAcademicStats) labelAcademicStats.textContent = isParent ? "Student's Academic Stats" : "Academic Stats (Optional but Recommended)";

    // Step 3 Labels
    const labelCollegeList = document.getElementById('labelCollegeList');
    const labelCollegeSubtitle = document.getElementById('labelCollegeSubtitle');
    if (labelCollegeList) labelCollegeList.textContent = isParent ? "Build Your Student's College List" : "Add Your College List";
    if (labelCollegeSubtitle) labelCollegeSubtitle.textContent = isParent ? "Start with a few colleges your student is interested in." : "Start with a few colleges you're interested in. You can add more later.";

    // Step 4 Labels
    const labelStrategy = document.getElementById('labelStrategy');
    const labelStrategySubtitle = document.getElementById('labelStrategySubtitle');
    const labelGoal = document.getElementById('labelGoal');
    if (labelStrategy) labelStrategy.textContent = isParent ? "Your Student's Application Strategy" : "Your Application Strategy";
    if (labelStrategySubtitle) labelStrategySubtitle.textContent = isParent ? "How would you like to help your student tackle their journey?" : "How do you want to tackle your application journey?";
    if (labelGoal) labelGoal.textContent = isParent ? "Your #1 Goal for Your Student" : "Your #1 Goal This Year";

    // Step 5 Labels
    const labelPlanLoading = document.getElementById('labelPlanLoading');
    if (labelPlanLoading) labelPlanLoading.textContent = isParent ? "AI is crafting a personalized schedule for your student..." : "AI is crafting your personalized application schedule...";
}

async function generateAIPlan() {
    const planLoading = document.getElementById('planLoading');
    const planDisplay = document.getElementById('planDisplay');
    const planSummary = document.getElementById('planSummary');
    const tasksContainer = document.getElementById('tasksContainer');

    const finishBtn = document.getElementById('finishBtn');
    if (!planLoading || !planDisplay) return;

    try {
        if (finishBtn) {
            finishBtn.disabled = true;
            finishBtn.style.opacity = '0.5';
            finishBtn.innerHTML = 'Generating your plan...';
        }
        const gradYear = document.getElementById('gradYear').value;
        const major = document.getElementById('intendedMajor').value;
        const fullName = document.getElementById('fullName').value;
        const leeway = document.getElementById('submissionLeeway').value;

        const response = await fetch(`${config.apiUrl}/api/onboarding/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                colleges: selectedColleges,
                profile: {
                    graduation_year: gradYear,
                    intended_major: major,
                    full_name: fullName,
                    submission_leeway: leeway
                }
            })
        });

        if (!response.ok) throw new Error('Failed to generate plan');

        const data = await response.json();
        const plan = data.plan;

        // Populate UI
        planSummary.textContent = plan.summary;
        tasksContainer.innerHTML = '';

        plan.tasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'task-card';
            taskEl.style.padding = 'var(--space-md)';
            taskEl.style.marginBottom = 'var(--space-sm)';

            // Priority color
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

        if (finishBtn) {
            finishBtn.disabled = false;
            finishBtn.style.opacity = '1';
            finishBtn.innerHTML = 'Finish Setup & Enter Dashboard →';
        }


    } catch (error) {
        console.error('Plan Generation Error:', error);
        planLoading.innerHTML = `<p style="color: var(--error);">Failed to generate your plan: ${error.message}. But don't worry, you can still finish setup!</p>`;


        if (finishBtn) {
            finishBtn.disabled = false;
            finishBtn.style.opacity = '1';
            finishBtn.innerHTML = 'Finish Setup Anyway →';
        }

    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

function addCollegeToList() {
    const input = document.getElementById('collegeInput');
    const collegeName = input.value.trim();

    if (!collegeName) {
        if (window.showNotification) window.showNotification('Please enter a college name', 'error');
        return;
    }

    selectedColleges.push(collegeName);
    renderColleges();

    input.value = '';
    if (window.showNotification) window.showNotification(`Added ${collegeName}`, 'success');
}

function removeCollege(collegeName) {
    selectedColleges = selectedColleges.filter(c => c !== collegeName);
    renderColleges();
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

    // Add click listeners to remove buttons
    collegeList.querySelectorAll('.remove-college').forEach(btn => {
        btn.onclick = () => removeCollege(btn.dataset.college);
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    await init();

    const form = document.getElementById('onboardingForm');
    const collegeInput = document.getElementById('collegeInput');

    // Export functions to window for HTML onclick
    window.nextStep = nextStep;
    window.prevStep = prevStep;
    window.addCollege = addCollegeToList; // Rename for the button

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
            const major = document.getElementById('intendedMajor').value;
            const fullName = document.getElementById('fullName').value;
            const schoolName = document.getElementById('schoolName').value;
            const uwGPA = document.getElementById('uwGPA').value;
            const satScore = document.getElementById('satScore').value;
            const actScore = document.getElementById('actScore').value;

            if (window.showNotification) window.showNotification('Saving your profile...', 'info');

            try {
                // Collect strategy and goals
                const intensityLevel = document.getElementById('intensityLevel').value;
                const submissionLeeway = parseInt(document.getElementById('submissionLeeway').value);
                const appFocus = document.querySelector('input[name="appFocus"]:checked')?.value || 'General';
                const topGoal = document.getElementById('topGoal').value.trim();

                const profileData = {
                    id: currentUser.id,
                    graduation_year: parseInt(gradYear),
                    intended_major: major,
                    full_name: fullName,
                    school_name: schoolName,
                    unweighted_gpa: uwGPA ? parseFloat(uwGPA) : null,
                    sat_score: satScore ? parseInt(satScore) : null,
                    act_score: actScore ? parseInt(actScore) : null,
                    intensity_level: intensityLevel,
                    submission_leeway: submissionLeeway,
                    app_focus: appFocus,
                    top_goal: topGoal
                };

                // Add email only if it's a new profile or if needed for first-time creation
                if (currentUser.email) {
                    profileData.email = currentUser.email;
                }

                console.log('Creating profile...', profileData);
                await upsertProfile(profileData);
                console.log('Profile created successfully');

                // 2. Add Colleges
                const addPromises = selectedColleges.map(name => supabaseAddCollege(currentUser.id, name));
                await Promise.all(addPromises);

                if (window.showNotification) window.showNotification('Setup complete! Welcome to Waypoint', 'success');

                // 3. Verify profile exists before redirecting
                const verifyProfile = await getUserProfile(currentUser.id);
                if (!verifyProfile) {
                    throw new Error('Profile was not saved correctly.');
                }

                window.location.assign('dashboard.html');
            } catch (error) {
                console.error('Onboarding Error:', error);
                if (window.showNotification) window.showNotification('Error: ' + error.message, 'error');
            }
        });
    }
});
