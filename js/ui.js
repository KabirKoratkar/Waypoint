/**
 * UI Utilities
 * Handles global UI updates like the navbar user badge.
 */

import { signOut } from './supabase-config.js';

export function updateNavbarUser(user) {
    const userBadge = document.getElementById('user-badge');
    if (!userBadge || !user) return;

    // Get name from profile metadata or use email
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    userBadge.textContent = name;

    // Add a logout listener to the parent item if we want
    const userNavItem = document.getElementById('user-nav-item');
    if (userNavItem) {
        userNavItem.style.cursor = 'pointer';
        userNavItem.title = 'Click to Sign Out';
        userNavItem.addEventListener('click', async () => {
            if (confirm('Are you sure you want to sign out?')) {
                await signOut();
                window.location.href = new URL('index.html', window.location.href).href;
            }
        });
    }
}
