import os
import re

nav_html = """    <nav class=\"navbar\">
        <div class=\"navbar-container\">
            <a href=\"dashboard.html\" class=\"navbar-logo\">
                <img src=\"assets/logo.png\" alt=\"Waypoint Logo\" style=\"height: 24px;\">
                <span class=\"badge-beta\">Beta</span>
            </a>
            <ul class=\"navbar-links\" id=\"navLinks\">
                <li><a href=\"dashboard.html\" class=\"navbar-link\">Home</a></li>
                <li><a href=\"calendar.html\" class=\"navbar-link\">Calendar</a></li>
                <li><a href=\"analytics.html\" class=\"navbar-link\">Analytics</a></li>
                <li><a href=\"colleges.html\" class=\"navbar-link\">Colleges</a></li>
                <li><a href=\"essays.html\" class=\"navbar-link\">Essays</a></li>
                <li><a href=\"documents.html\" class=\"navbar-link\">Documents</a></li>
                <li><a href=\"resources.html\" class=\"navbar-link\">Research</a></li>
                <li><a href=\"settings.html\" class=\"navbar-link\">Settings</a></li>
                <li id=\"user-nav-item\"><span class=\"badge badge-primary\" id=\"user-badge\">User</span></li>
            </ul>
            <button class=\"mobile-menu-toggle\" id=\"mobileToggle\">☰</button>
        </div>
    </nav>"""

files = ['dashboard.html', 'analytics.html', 'calendar.html', 'college-explorer.html', 'colleges.html', 'documents.html', 'essays.html', 'resources.html', 'settings.html']

for f in files:
    try:
        with open(f, 'r') as file:
            content = file.read()
        
        # Regex to find everything between <nav class="navbar"> and </nav>
        new_content = re.sub(r'<nav class="navbar">.*?</nav>', nav_html, content, flags=re.DOTALL)
        
        with open(f, 'w') as file:
            file.write(new_content)
        print(f"Updated {f}")
    except Exception as e:
        print(f"Error touching {f}: {e}")

