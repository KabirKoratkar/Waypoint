# CollegeApps.ai - Master Guide

Welcome to the command center for your college applications. This guide consolidates all information about setting up, running, testing, and deploying the CollegeApps.ai platform.

---

## 🎯 Project Overview

CollegeApps.ai helps students organize the entire application process. Instead of juggling multiple portals, students use one dashboard that manages tasks, essays, and deadlines.

### Core Features
- **Daily Task Dashboard**: Know exactly what to work on today.
- **Calendar View**: Visual monthly view of deadlines, essays, and tasks.
- **Essay Workspace**: Modern editor with autosave and AI assistance.
- **AI Counselor**: 24/7 expert guidance powered by GPT-4.
- **Document Vault**: Secure storage for transcripts, resumes, and awards.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- **Node.js** (v18 or higher)
- **Supabase Account** (free tier)
- **OpenAI API Key**

### 1. Database Setup (Supabase)
1.  Create a new project on [Supabase](https://supabase.com).
2.  Run the schema from `backend/supabase-schema.sql` in the SQL Editor.
3.  **Crucial**: Run the `backend/profile-extension.sql` to add newer columns (`birth_date`, `location`).
4.  Copy your **Project URL** and **anon public key**.

### 2. Backend Configuration
1.  In `backend/`, copy `.env.example` to `.env`.
2.  Fill in your `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY`.
3.  Run `npm install` in the root directory.

### 3. Frontend Configuration
1.  In `js/supabase-config.js`, update the `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 4. Running the App
The project uses **npm workspaces**. You can run everything from the root:
- **Build**: `npm install`
- **Start Backend**: `npm start` (Runs AI Counselor server on port 3001)
- **Start Frontend**: Open `index.html` or use `python3 -m http.server 8000`

---

## 🤖 AI Counselor & Integrations

The AI Counselor is the heart of the app. It can:
- **Add Colleges**: "I'm applying to Stanford" adds the college and all its requirements.
- **Create Tasks**: "Remind me to ask for LORs" creates a task synced to your calendar.
- **Analyze Essays**: Get feedback on your drafts.

### Testing the Sync
1.  Ask the AI: "I want to apply to Georgia Tech."
2.  Check the **Colleges** page to see it added.
3.  Check the **Calendar** to see the Jan 4 deadline.
4.  Check the **Essays** page for automatically generated prompts.

---

## 💾 Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User info (location, grad year, major) |
| `colleges` | User's college list and application status |
| `essays` | Essay drafts with word counts and versions |
| `tasks` | Deadlines and to-do items |
| `documents` | Metadata for uploaded transcripts/resumes |
| `conversations` | AI chat history persistence |

---

## 🌐 Deployment

### Backend (Railway)
1.  Connect your GitHub repo to Railway.
2.  Ensure **Root Directory** in settings is set to `/` (or left blank).
3.  Railway uses the root `package.json` to start the workspace.
4.  Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`.

### Frontend (Vercel)
1.  Import the repository.
2.  Vercel will auto-detect it as a static site.
3.  Live URL: [collegeapps-ai.vercel.app](https://collegeapps-ai.vercel.app)

---

## 🛠️ Troubleshooting

- **"Failed to create profile"**: Ensure you ran the `profile-extension.sql` in Supabase.
- **"Build Failed" on Railway**: Check that Node version is set to `20.x` and `Root Directory` is correct.
- **AI not responding**: Verify your OpenAI API key and billing status.

---

*Built with ❤️ for students navigating the college application journey.*
