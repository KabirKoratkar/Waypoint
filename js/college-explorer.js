import config from './config.js';
import { getCurrentUser } from './supabase-config.js';

let enrollmentChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const collegeName = urlParams.get('name');

    if (!collegeName) {
        window.location.href = 'colleges.html';
        return;
    }

    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    try {
        await fetchAndRenderCollegeData(collegeName);
    } catch (error) {
        console.error('Error loading college data:', error);
        alert('Could not lead college data. Please try again.');
        window.location.href = 'colleges.html';
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
});

async function fetchAndRenderCollegeData(name) {
    // Call our new research endpoint
    const response = await fetch(`${config.apiUrl}/api/colleges/research?name=${encodeURIComponent(name)}`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Failed to fetch college data');
    }

    const college = data.college;

    // Update UI Elements
    document.getElementById('collegeName').textContent = college.name;
    document.title = `${college.name} - College Explorer`;

    document.getElementById('collegeLocation').textContent = college.location || 'Location Unknown';
    document.getElementById('collegeWebsite').href = college.website || '#';
    document.getElementById('collegeDescription').textContent = college.description || 'No description available.';

    // Stats
    document.getElementById('acceptanceRate').textContent = college.acceptance_rate ? `${college.acceptance_rate}%` : '--%';
    document.getElementById('medianSAT').textContent = college.median_sat || 'N/A';
    document.getElementById('medianACT').textContent = college.median_act || 'N/A';
    document.getElementById('avgGPA').textContent = college.avg_gpa || 'N/A';

    // Detail Sidebar
    document.getElementById('totalEnrollment').textContent = college.enrollment ? college.enrollment.toLocaleString() : 'N/A';
    document.getElementById('costOfAttendance').textContent = college.cost_of_attendance ? `$${college.cost_of_attendance.toLocaleString()}` : 'N/A';

    // Header Style
    if (college.image_url) {
        document.getElementById('collegeHeader').style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url(${college.image_url})`;
    }

    // AI Insight (Placeholder for now, could be its own endpoint or handled in first chat)
    renderAIInsight(college);

    // Render Charts
    renderEnrollmentChart(college);

    // Setup Buttons
    const addBtn = document.getElementById('addCollegeBtn');
    addBtn.onclick = () => addCollege(college.name);
}

function renderAIInsight(college) {
    const insights = [
        `${college.name} is known for its ${college.acceptance_rate < 10 ? 'highly competitive' : 'selective'} admissions environment. Successful applicants often demonstrate strong leadership and specific excellence in ${college.name.includes('Tech') || college.name.includes('Institute') ? 'STEM and innovation' : 'their chosen field of study'}.`,
        `Given the median SAT of ${college.median_sat || 'high range'}, focus on ensuring your score is within the 25th-75th percentile to be competitive.`,
        `Pro-tip: This college values "cultural fit" and ${college.acceptance_rate < 15 ? 'intellectual curiosity' : 'academic grit'}. Make sure your supplemental essays reflect this.`
    ];
    document.getElementById('aiInsight').textContent = insights.join(' ');
}

function renderEnrollmentChart(college) {
    const ctx = document.getElementById('enrollmentChart').getContext('2d');

    if (enrollmentChart) {
        enrollmentChart.destroy();
    }

    enrollmentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Admitted', 'Waitlisted', 'Denied'],
            datasets: [{
                data: [college.acceptance_rate || 10, 5, 100 - (college.acceptance_rate || 10) - 5],
                backgroundColor: [
                    '#5B8DEE', // Admitted
                    '#8B7BF7', // Waitlisted
                    '#E2E8F0'  // Denied
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            }
        }
    });
}

async function addCollege(name) {
    const btn = document.getElementById('addCollegeBtn');
    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
        const user = await getCurrentUser();
        const response = await fetch(`${config.apiUrl}/api/colleges/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, collegeName: name })
        });

        const result = await response.json();
        if (result.success) {
            alert(`Successfully added ${name} to your list!`);
            window.location.href = 'colleges.html';
        } else {
            alert('Could not add college: ' + result.error);
        }
    } catch (error) {
        console.error('Error adding college:', error);
        alert('An error occurred. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = '+ Add to List';
    }
}
