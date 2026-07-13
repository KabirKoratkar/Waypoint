/**
 * Beta Request Logic
 * Handles the beta modal and any beta-related interactions.
 */

const BETA_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfMGGSEH96MkuanfuEtYL5WUew-VMWtuoG5b1jnMTdz3wg0Dg/viewform?usp=sharing&ouid=113360516330550696339';

document.addEventListener('DOMContentLoaded', () => {
    // Create Modal if it doesn't exist
    injectBetaModal();

    // Use event delegation for dynamically added badges
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.btn-request-beta, .badge-beta');
        if (target) {
            e.preventDefault();
            openBetaModal();
        }
    });
});

function injectBetaModal() {
    if (document.getElementById('betaModal')) return;

    const modalHtml = `
        <div id="betaModal" class="beta-modal-overlay">
            <div class="beta-modal">
                <button class="beta-modal-close" onclick="closeBetaModal()" aria-label="Close feedback dialog">
                    <i class="ph ph-x"></i>
                </button>
                <div class="beta-modal-icon"><i class="ph ph-chat-centered-text"></i></div>
                <h2 class="beta-modal-title">Help improve Waypoint</h2>
                <p class="beta-modal-text">
                    We're looking for direct feedback from students and families. Tell us what is confusing, what is missing, and what would make the application process easier to manage.
                </p>
                <div class="flex flex-col gap-md">
                    <a href="${BETA_FORM_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg" onclick="closeBetaModal()">
                        Open feedback form
                    </a>
                    <button class="btn btn-secondary" onclick="closeBetaModal()">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Close on overlay click
    document.getElementById('betaModal').addEventListener('click', (e) => {
        if (e.target.id === 'betaModal') closeBetaModal();
    });
}

function openBetaModal() {
    const modal = document.getElementById('betaModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scroll
    }
}

function closeBetaModal() {
    const modal = document.getElementById('betaModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
    }
}

// Export to window for global access
window.openBetaModal = openBetaModal;
window.closeBetaModal = closeBetaModal;
