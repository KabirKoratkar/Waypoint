import { signUp, signIn, signInWithGoogle } from './supabase-config.js';

// DEV MODE: Set to true for local testing without Supabase email confirmation
const DEV_MODE = false;

// Create a mock user session for development
function createDevSession(email, fullName) {
    const mockUser = {
        id: 'dev-user-' + Date.now(),
        email: email,
        full_name: fullName,
        created_at: new Date().toISOString()
    };
    localStorage.setItem('dev_user', JSON.stringify(mockUser));
    return mockUser;
}

document.addEventListener('DOMContentLoaded', function () {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const googleBtn = document.querySelector('.google-btn');

    // Google Sign In
    if (googleBtn) {
        googleBtn.addEventListener('click', async function () {
            console.log('Google Sign-In clicked');
            showNotification('Connecting to Google...', 'info');

            try {
                // If on signup page, redirect to onboarding after Google auth
                const nextPath = window.location.pathname.includes('signup.html')
                    ? 'onboarding.html'
                    : 'dashboard.html';

                const result = await signInWithGoogle(nextPath);
                console.log('OAuth Start Result:', result);
            } catch (err) {
                console.error('OAuth Error:', err);
                showNotification('Connection error: ' + err.message, 'error');
            }
        });
    }

    // Signup Form
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // Basic validation
            if (!fullName || !email || !password) {
                showNotification('Please fill in all fields', 'error');
                return;
            }

            if (password.length < 8) {
                showNotification('Password must be at least 8 characters', 'error');
                return;
            }

            if (DEV_MODE) {
                // Dev mode: create mock session
                console.log('[DEV MODE] Creating mock account for:', email);
                createDevSession(email, fullName);
                showNotification('Account created! (Dev Mode)', 'success');
                setTimeout(() => {
                    window.location.assign('onboarding.html');
                }, 1000);
            } else {
                // Production: use Supabase
                console.log('Creating account for:', email);
                const result = await signUp(email, password, fullName);

                if (result) {
                    showNotification('Account created successfully!', 'success');
                    setTimeout(() => {
                        window.location.assign('onboarding.html');
                    }, 1500);
                } else {
                    showNotification('Failed to create account. Please try again.', 'error');
                }
            }
        });
    }

    // Login Form
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (!email || !password) {
                showNotification('Please fill in all fields', 'error');
                return;
            }

            if (DEV_MODE) {
                // Dev mode: create mock session
                console.log('[DEV MODE] Logging in:', email);
                createDevSession(email, 'Dev User');
                showNotification('Login successful! (Dev Mode)', 'success');
                setTimeout(() => {
                    window.location.assign('dashboard.html');
                }, 1000);
            } else {
                // Production: use Supabase
                console.log('Logging in:', email);
                const result = await signIn(email, password);

                if (result) {
                    showNotification('Login successful!', 'success');
                    setTimeout(() => {
                        window.location.assign('dashboard.html');
                    }, 1500);
                } else {
                    showNotification('Invalid email or password.', 'error');
                }
            }
        });
    }
});
