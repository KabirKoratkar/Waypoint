import { getCurrentUser, getUserProfile, upsertProfile, supabase, addCollege, getTrialInfo } from './supabase-config.js';
import { updateNavbarUser } from './ui.js';
import config from './config.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async function () {
    currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.assign('login.html');
        return;
    }

    try {
        const profile = await getUserProfile(currentUser.id);
        updateNavbarUser(currentUser, profile);
        await loadSettings(profile);
    } catch (e) {
        console.error('Error loading settings:', e);
    } finally {
        setupEventListeners();
        checkPaymentStatus();
    }
});

async function loadSettings(profile = null) {
    if (!profile) profile = await getUserProfile(currentUser.id);
    if (!profile) return;

    // Planner Settings
    if (profile.submission_leeway !== undefined) {
        document.getElementById('subLeeway').value = profile.submission_leeway;
    }
    if (profile.intensity_level) {
        document.getElementById('writingIntensity').value = profile.intensity_level;
    }
    if (profile.work_weekends !== undefined) {
        document.getElementById('workWeekends').checked = profile.work_weekends;
    }

    // Theme Setting
    // Theme Setting
    const localTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentAttribute = document.documentElement.getAttribute('data-theme');

    // logic: if explicitly 'dark' in storage OR attribute, OR nosave+system=dark
    const isDark = (localTheme === 'dark') || (currentAttribute === 'dark') || (!localTheme && systemDark);

    document.getElementById('darkModeToggle').checked = isDark;

    // Profile Settings
    document.getElementById('profName').value = profile.full_name || '';
    document.getElementById('profHighSchool').value = profile.high_school_name || '';
    document.getElementById('profGradYear').value = profile.graduation_year || '';
    document.getElementById('profMajor').value = profile.intended_major || '';
    document.getElementById('profUwGpa').value = profile.unweighted_gpa || '';
    document.getElementById('profWGpa').value = profile.weighted_gpa || '';

    // Membership Status
    const membershipTier = document.getElementById('membershipTier');
    const membershipDesc = document.getElementById('membershipDescription');
    const membershipIcon = document.getElementById('membershipIcon');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const proHero = document.getElementById('proHero');

    const trialInfo = getTrialInfo(profile);
    const proGlow = document.getElementById('proGlow');

    if (profile.is_beta) {
        membershipTier.textContent = 'Beta Tester (VIP)';
        membershipDesc.textContent = 'Early access enabled. All premium features are free.';
        membershipIcon.textContent = '🚀';
        membershipIcon.style.background = 'var(--accent-purple)';
        membershipIcon.style.color = 'white';
        upgradeBtn.style.display = 'none';
        document.getElementById('subscriptionStatus').style.border = '1px solid var(--accent-purple)';
        if (proHero) proHero.style.display = 'none';
        if (proGlow) proGlow.style.display = 'block';
    } else if (profile.is_premium) {
        membershipTier.innerHTML = 'Pro Member <span style="font-size: 10px; background: var(--warning); color: var(--gray-800); padding: 2px 6px; border-radius: 4px; margin-left: 5px;">ACTIVE</span>';
        
        const sinceDate = profile.premium_since ? new Date(profile.premium_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently';
        membershipDesc.textContent = `Member since ${sinceDate}`;
        
        membershipIcon.textContent = '💎';
        membershipIcon.style.background = 'var(--warning)';
        upgradeBtn.textContent = 'Manage Billing';
        upgradeBtn.className = 'btn btn-sm btn-outline';
        if (proHero) proHero.style.display = 'none';
        if (proGlow) proGlow.style.display = 'block';
    } else if (trialInfo.inTrial) {
        membershipTier.textContent = `Free Trial`;
        membershipDesc.textContent = `${trialInfo.daysRemaining} days remaining in your pro trial.`;
        membershipIcon.textContent = '⏳';
        membershipIcon.style.background = 'var(--primary-blue)';
        membershipIcon.style.color = 'white';
        upgradeBtn.textContent = 'Upgrade to Pro';
        if (proHero) proHero.style.display = 'block';
        if (proGlow) proGlow.style.display = 'none';
    } else {
        membershipTier.textContent = 'Trial Expired';
        membershipDesc.textContent = 'Upgrade to Pro to keep your edge.';
        membershipIcon.textContent = '🔒';
        membershipIcon.style.background = 'var(--gray-300)';
        upgradeBtn.textContent = 'Upgrade Now';
        if (proHero) proHero.style.display = 'block';
        if (proGlow) proGlow.style.display = 'none';
    }
}

function setupEventListeners() {
    // Tab Switching
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const target = tab.dataset.tab;
            if (!target) return;

            const targetPane = document.getElementById(`${target}Tab`);
            if (!targetPane) {
                console.error(`Tab pane not found: ${target}Tab`);
                return;
            }

            // Update buttons
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            targetPane.classList.add('active');
        });
    });

    // Save Profile
    document.getElementById('saveProfile').addEventListener('click', async () => {
        const name = document.getElementById('profName').value;
        const major = document.getElementById('profMajor').value;
        const hsName = document.getElementById('profHighSchool').value;
        const gradYear = parseInt(document.getElementById('profGradYear').value) || null;
        const uwGpa = parseFloat(document.getElementById('profUwGpa').value) || null;
        const wGpa = parseFloat(document.getElementById('profWGpa').value) || null;

        try {
            await upsertProfile({
                id: currentUser.id,
                email: currentUser.email,
                full_name: name,
                intended_major: major,
                high_school_name: hsName,
                graduation_year: gradYear,
                unweighted_gpa: uwGpa,
                weighted_gpa: wGpa
            });
            showNotification('Profile updated successfully!', 'success');
        } catch (e) {
            showNotification('Error saving profile: ' + e.message, 'error');
        }
    });

    // Save & Re-sync Strategy
    document.getElementById('saveAndSync').addEventListener('click', async () => {
        const subLeeway = parseInt(document.getElementById('subLeeway').value);
        const intensity = document.getElementById('writingIntensity').value;
        const workWeekends = document.getElementById('workWeekends').checked;

        const syncBtn = document.getElementById('saveAndSync');
        const originalText = syncBtn.innerHTML;

        try {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<span class="loading-spinner"></span> Syncing...';

            // 1. Save preferences
            await upsertProfile({
                id: currentUser.id,
                email: currentUser.email,
                submission_leeway: subLeeway,
                intensity_level: intensity,
                work_weekends: workWeekends
            });

            // 2. Here we would ideally call an AI endpoint to re-adjust dates
            // For MVP, we'll notify them that future AI planning will follow these rules
            showNotification('Planner preferences saved! Your application strategy is updated.', 'success');

            setTimeout(() => {
                window.location.href = 'calendar.html';
            }, 1000);

        } catch (e) {
            showNotification('Error syncing strategy: ' + e.message, 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalText;
        }
    });

    // Demo data seeding removed


    // Theme Toggle
    document.getElementById('darkModeToggle').addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('dev_user');
        window.location.assign('index.html');
    });

    // Upgrade to Pro
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', handleUpgrade);
    }

    const mainUpgradeBtn = document.getElementById('mainUpgradeBtn');
    if (mainUpgradeBtn) {
        mainUpgradeBtn.addEventListener('click', handleUpgrade);
    }

    // Theme Watcher (Sync with other tabs)
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) toggle.checked = (e.newValue === 'dark');
        }
    });
}

async function handleUpgrade() {
    const upgradeBtn = document.getElementById('upgradeBtn');
    const originalText = upgradeBtn.textContent;

    // Fetch latest profile to be sure
    const profile = await getUserProfile(currentUser.id);
    const isPremium = profile?.is_premium;

    try {
        upgradeBtn.disabled = true;
        upgradeBtn.innerHTML = `<span class="loading-spinner"></span> ${isPremium ? 'Opening portal...' : 'Securely connecting...'}`;

        const endpoint = isPremium ? 'create-portal-session' : 'create-checkout-session';

        const response = await fetch(`${config.apiUrl}/api/payments/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                email: currentUser.email
            })
        });

        const data = await response.json();

        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Failed to connect to billing provider');
        }
    } catch (error) {
        console.error('Upgrade/Portal error:', error);
        showNotification('Billing error: ' + error.message, 'error');
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = originalText;
    }
}

async function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus === 'success') {
        showNotification('🎉 Welcome to Waypoint Pro! Your account has been upgraded.', 'success');

        // Wait a bit for the webhook to potentially finish and then refresh data
        setTimeout(async () => {
            const profile = await getUserProfile(currentUser.id);
            await loadSettings(profile);
            updateNavbarUser(currentUser, profile);
        }, 1500);

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancel') {
        showNotification('Payment cancelled. Let us know if you had any trouble!', 'info');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}



function showNotification(message, type = 'info') {
    if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        alert(message);
    }
}
