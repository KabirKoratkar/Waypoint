# Implementation Plan - Dark Mode & UI Consistency

The objective is to fix the inconsistent dark mode and add missing policy links in settings.

## Proposed Changes

### 1. Global Theme Initialization
- Update `js/main.js` to include a self-invoked function that applies the saved theme from `localStorage` immediately.
- Update all HTML files (via search and replace or individual edits if few) to use a consistent theme-checking script in the `<head>`.

### 2. Settings Page
- Add "Privacy Policy" and "Terms of Service" links to `settings.html`.
- Ensure theme toggle works consistently.

### 3. Dashboard Enhancements (Core Task)
- **Deadlines:** Update `js/dashboard.js` to show ALL college deadlines, sorted by urgency.
- **Deadline Status:** Display "Reached" or "Passed" if the deadline is in the past or today.
- **Task Interaction:** Add a "View All Tasks" modal or scrollable section in the dashboard.
- **Goal Accuracy:** Refine `renderGoals` to better reflect the user's weekly schedule.

### 4. College List Enhancements
- **Categorization:** Add a dropdown for "Reach/Safety/Target" in the `colleges.html` table.
- **Update Logic:** Ensure changing the category updates the database and reflectors in the summary cards.

## Verification Plan

### Automated Tests
- N/A (Manual UI verification preferred for these visual changes)

### Manual Verification
1. Load different pages and ensure dark mode remains consistent.
2. Toggle dark mode in settings and verify it applies instantly across tabs.
3. Check dashboard for all college deadlines.
4. Categorize a college as "Reach" and check if the summary card counts it.
