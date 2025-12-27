/**
 * Analytics Dashboard Logic
 * Handles data fetching and chart rendering for the analytics page.
 */

import { getCurrentUser, getUserColleges, getUserEssays, getUserTasks } from './supabase-config.js';
import { updateNavbarUser } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Analytics initializing...');

    try {
        const user = await getCurrentUser();
        let colleges = [];
        let essays = [];
        let tasks = [];

        if (user) {
            colleges = await getUserColleges(user.id);
            essays = await getUserEssays(user.id);
            tasks = await getUserTasks(user.id);
            updateNavbarUser(user);
            console.log(`Found ${colleges.length} colleges, ${essays.length} essays, ${tasks.length} tasks`);
        }

        // Fallback to mock data if no data found or not logged in
        if (colleges.length === 0) {
            console.log('Using mock data for demonstration');
            colleges = [
                { name: 'Stanford', status: 'In Progress', type: 'Reach' },
                { name: 'UC Berkeley', status: 'In Progress', type: 'Target' },
                { name: 'UCLA', status: 'Not Started', type: 'Target' },
                { name: 'MIT', status: 'Not Started', type: 'Reach' },
                { name: 'USC', status: 'Completed', type: 'Target' },
                { name: 'Georgia Tech', status: 'Not Started', type: 'Target' }
            ];
        }

        updateSummaryStats(colleges, essays, tasks);
        renderCollegeBreakdown(colleges);
        renderAppStatus(colleges);
        renderActivity();
        renderEssayProgress(essays);

    } catch (error) {
        console.error('Error initializing analytics:', error);
    }
});

function updateSummaryStats(colleges, essays, tasks) {
    const completionCard = document.querySelector('.stats-summary .card:nth-child(1) div:last-child');
    const essaysCard = document.querySelector('.stats-summary .card:nth-child(3) div:last-child');
    const tasksCard = document.querySelector('.stats-summary .card:nth-child(4) div:last-child');

    if (completionCard) {
        const completed = colleges.filter(c => c.status === 'Completed').length;
        const total = colleges.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        completionCard.textContent = `${percent}%`;
    }

    if (essaysCard) {
        const drafted = essays.filter(e => e.word_count > 100).length;
        essaysCard.textContent = `${drafted} / ${essays.length || 12}`;
    }

    if (tasksCard) {
        const done = tasks.filter(t => t.completed).length;
        tasksCard.textContent = `${done} / ${tasks.length || 20}`;
    }
}

function renderCollegeBreakdown(colleges) {
    const ctx = document.getElementById('collegeBreakdownChart').getContext('2d');

    const types = { 'Reach': 0, 'Target': 0, 'Safety': 0 };
    colleges.forEach(c => {
        let type = c.type;
        if (!type) {
            type = (c.name.includes('Stanford') || c.name.includes('MIT') || c.name.includes('Harvard')) ? 'Reach' : 'Target';
        }
        if (types[type] !== undefined) {
            types[type]++;
        } else {
            // Default to Target if type is unknown
            types['Target']++;
        }
    });

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Reach', 'Target', 'Safety'],
            datasets: [{
                data: [types['Reach'], types['Target'], types['Safety']],
                backgroundColor: ['#8B7BF7', '#5B8DEE', '#10B981'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { family: 'Inter' }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function renderAppStatus(colleges) {
    const ctx = document.getElementById('appStatusChart').getContext('2d');

    const statusCounts = { 'Not Started': 0, 'In Progress': 0, 'Completed': 0 };
    colleges.forEach(c => {
        statusCounts[c.status || 'Not Started']++;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Not Started', 'In Progress', 'Completed'],
            datasets: [{
                label: 'Colleges',
                data: [statusCounts['Not Started'], statusCounts['In Progress'], statusCounts['Completed']],
                backgroundColor: ['#EF4444', '#F59E0B', '#10B981'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderActivity() {
    const ctx = document.getElementById('activityChart').getContext('2d');

    // Mock activity data for the last 7 days
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const sessions = [12, 19, 3, 5, 2, 3, 10];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Daily Tasks/Edits',
                data: sessions,
                fill: true,
                borderColor: '#5B8DEE',
                backgroundColor: 'rgba(91, 141, 238, 0.1)',
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#5B8DEE'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderEssayProgress(essays) {
    const ctx = document.getElementById('essayWordsChart').getContext('2d');

    let labels = [];
    let data = [];
    let limits = [];

    if (essays && essays.length > 0) {
        essays.slice(0, 5).forEach(e => {
            labels.push(e.title.split(' - ')[0]); // College name
            data.push(e.word_count || 0);
            limits.push(e.word_limit || 650);
        });
    } else {
        // Mock data
        labels = ['Common App', 'UC PIQ 1', 'Stanford Supp', 'MIT Supp', 'UCLA Supp'];
        data = [580, 210, 150, 45, 0];
        limits = [650, 350, 250, 250, 250];
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Current Word Count',
                    data: data,
                    backgroundColor: '#5B8DEE',
                    borderRadius: 4
                },
                {
                    label: 'Word Limit',
                    data: limits,
                    backgroundColor: 'rgba(229, 231, 235, 0.5)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: false },
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
