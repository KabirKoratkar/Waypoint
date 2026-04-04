# 🚀 Waypoint Launch Roadmap: "Operation Launch Ready"

This roadmap outlines the critical steps required to move Waypoint from its current Beta state to a production-ready launch.

## 🔴 Tier 1: Critical Blockers (Do These First)
These issues will directly impact user experience or security once live.

### 1. Production Email Service (Resend)
*   **Current State:** [COMPLETED] 📧 Production key added and sender identity verified.
*   **Action:** 
    *   [x] Obtain a production API key from Resend.
    *   [x] Verify the sender domain in Resend.
    *   [x] Update the backend email identity in `ai-server.js`.
*   **Impact:** Transactional emails are now operational.

### 2. Stripe Production Swap
*   **Current State:** [COMPLETED] 💳 Live Mode Secret Key, Price ID, and Webhook confirmed.
*   **Action:** 
    *   [x] Swap `sk_test_...` with `sk_live_...`.
    *   [x] Create a live Price ID for the Pro Plan and update the `.env`.
    *   [x] Update the Stripe Webhook URL/Secret.
*   **Impact:** Payments are now live and operational.

### 3. API Security & CORS
*   **Current State:** [COMPLETED] 🔒 Locked down to `waypointedu.org` and related domains.
*   **Action:** 
    *   [x] Restrict CORS origins.
    *   [x] Enable `credentials: true`.
*   **Impact:** Production API is now secure.

*   **Current State:** [COMPLETED] 🤖 Migrated strategic features to OpenAI GPT-4o for stability.
*   **Action:** 
    *   [x] Consolidate AI services under one provider.
    *   [x] Re-architect `/api/chat/claude` to use GPT-4o.
*   **Impact:** High-level analysis is now stable and doesn't require extra keys.

---

## 🟠 Tier 2: High Priority Polish
Items that improve trust and professional appeal.

### 5. Finalize Marketing Logic
*   **Action:** Replace placeholder testimonials ("Sarah R.", etc.) on `index.html` with real beta feedback or remove them until you have results.
*   **Action:** Fix broken footer links (Blog, Help Center) to point to valid pages or social media.

### 6. Environment Hardening
*   **Action:** Set `NODE_ENV=production` in the Railway dashboard.
*   **Action:** Update the `APP_URL` in the backend `.env` to the final custom domain.

### 7. Landing Page "Interactive Map" Sync
*   **Action:** Ensure the `interactiveMap` in `index.html` feels responsive on the latest mobile devices (test via Chrome DevTools).

---

## 🟡 Tier 3: Quality of Life & Growth
Items to tackle during launch week.

### 8. Trial Expiry Experience
*   **Action:** Add a simple notification or modal that appears when a user's 7-day trial is nearing its end (tracked via `created_at` in the profile).

### 9. Social Sharing (OG Tags)
*   **Action:** Add Open Graph meta tags and a branded image (`og:image`) to `index.html` so shares look premium on Discord, LinkedIn, and X.

### 10. Performance Monitoring
*   **Action:** Set up a status page or a simple ping service (like UptimeRobot) to ensure the Railway instance doesn't experience downtime during peak traffic.

---

## ✅ Launch Day Checklist
- [ ] Backend `/api/health` indicates all services (Stripe, OpenAI, Supabase) are connected.
- [ ] Test a full signup flow from a fresh user account.
- [ ] Verify that adding a college via AI counselor triggers the essay sync correctly.
- [ ] Confirm Stripe Webhook receives the `checkout.session.completed` event.
- [ ] Check console for any 404s or uncaught errors on the dashboard.

**Ready to fly.** 🎓
