# Waypoint Launch Checklist

Complete before going live with the latest changes. Track as you go.

## Pre-Launch (Today)

### Code Quality
- [x] Issue #1 fixed: Email whitelist replaced with env vars
- [x] Issue #2 fixed: Webhook error handling improved
- [x] Issue #5 fixed: RBAC system implemented
- [ ] Run final linting/testing on live site
- [ ] Check browser console for errors (log in as test user)

### Environment Variables
- [ ] Verify on Vercel:
  - [ ] `VITE_ADMIN_EMAILS=kabirvideo@gmail.com`
  - [ ] `ADMIN_EMAILS=kabirvideo@gmail.com`
  - [ ] `STRIPE_SECRET_KEY` ✓ (already set)
  - [ ] `STRIPE_PRO_PRICE_ID` ✓ (already set)
  - [ ] `STRIPE_WEBHOOK_SECRET` ✓ (already set)
  - [ ] `APP_URL=https://waypointedu.org` (or your domain)
  - [ ] `SUPABASE_URL` ✓ (already set)
  - [ ] `SUPABASE_SERVICE_KEY` ✓ (already set)

### Database
- [ ] Run RBAC migration on Supabase:
  ```sql
  -- Paste rbac-implementation.sql into Supabase SQL Editor
  ```
- [ ] Promote your admin account:
  ```sql
  UPDATE public.profiles SET role = 'admin' WHERE email = 'kabirvideo@gmail.com';
  ```
- [ ] Verify roles table exists:
  ```sql
  SELECT * FROM pg_tables WHERE tablename = 'role_assignments';
  ```

### Payments
- [ ] Test checkout flow on live site:
  1. Go to Settings
  2. Click "Upgrade to Pro"
  3. Enter test card: `4242 4242 4242 4242`
  4. Complete flow
  5. Verify no errors in browser console
  6. Check Stripe dashboard for successful session
- [ ] Verify webhook is active in Stripe Dashboard:
  - Go to Stripe → Webhooks
  - Look for webhook to `{APP_URL}/api/payments/webhook`
  - Status should be "Enabled"
- [ ] Test failed payment scenario:
  1. Try card `4000 0000 0000 0002` (always declines)
  2. Should see error message
  3. Check backend logs for proper error response (500)

### Frontend
- [ ] Test as logged-in user:
  - [ ] Premium badge shows if `is_premium = true`
  - [ ] Admin panel visible if role = 'admin'
  - [ ] No console errors
- [ ] Test as new user:
  - [ ] Can sign up
  - [ ] 7-day trial starts automatically
  - [ ] Premium features locked (except trial period)
- [ ] Mobile responsiveness:
  - [ ] Test on iPhone
  - [ ] Test on Android
  - [ ] Payment flow works on mobile

### Security
- [ ] No hardcoded secrets in code:
  ```bash
  grep -r "kabirvideo@gmail.com" . --include="*.js" --include="*.html"
  # Should only appear in env files, not code
  ```
- [ ] RLS policies enabled on sensitive tables:
  ```sql
  SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('profiles', 'role_assignments', 'admin_audit_log');
  ```
- [ ] Stripe webhook signature validation enabled:
  - Check `backend/payments.js` line 145 (should verify sig)

### Monitoring
- [ ] Set up error tracking (optional):
  - [ ] Sentry, LogRocket, or similar configured
- [ ] Monitor Stripe webhook logs:
  - [ ] Check for failed webhooks
  - [ ] Look for duplicate customer IDs
- [ ] Set up basic logging:
  ```bash
  # Can view Vercel logs via:
  # https://vercel.com/dashboard/[project]/logs
  ```

## Launch Day

### Final Verification
- [ ] All environment variables deployed ✓
- [ ] RBAC migration applied ✓
- [ ] Admin account promoted ✓
- [ ] Webhook test successful ✓
- [ ] Payment flow works end-to-end ✓

### Marketing/Outreach
- [ ] Prepare launch announcement
- [ ] Test sharing link to friends
- [ ] Set up waitlist (if applicable)

### Post-Launch Monitoring (First Week)

- [ ] Daily check of Stripe webhook logs
  - Look for 500 errors (indicates real issues)
  - Monitor customer payment success rate
- [ ] Monitor Vercel logs for backend errors
- [ ] Check Supabase admin_audit_log:
  ```sql
  SELECT action, created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 20;
  ```
- [ ] Gather user feedback on payment flow

## Rollback Plan (If Critical Issue)

If something breaks badly:

1. **Disable payments:**
   ```bash
   # Set STRIPE_SECRET_KEY to empty/invalid on Vercel
   # Or comment out payment routes in backend
   ```

2. **Rollback code:**
   ```bash
   git revert [commit-hash]
   git push origin main
   # Vercel will redeploy automatically
   ```

3. **Check webhook status:**
   - If webhook is failing, disable it temporarily in Stripe

4. **Contact Stripe support if:**
   - Payments charged but not recorded in Supabase
   - Webhook signature verification failing

## Post-Launch (When Ready)

### Nice-to-Haves (Not blocking launch)
- [ ] Implement `/api/admin/users` endpoint (role management UI)
- [ ] Add audit log viewer to settings
- [ ] Email notifications on role changes
- [ ] Role-based feature flags
- [ ] Analytics dashboard

### Second Wave Improvements
- [ ] A/B test pricing
- [ ] Implement annual billing option
- [ ] Add referral system
- [ ] Implement email receipts on payment

---

## Notes

- **Commits since last launch:**
  - `038740e` - Fix env vars + webhook error handling
  - `257d3b2` - Implement RBAC system

- **Key files changed:**
  - `js/supabase-config.js` (admin check)
  - `backend/ai-server.js` (feedback email)
  - `backend/payments.js` (webhook response)
  - `backend/rbac-implementation.sql` (new)
  - `backend/rbac-helpers.js` (new)

- **Support Docs:**
  - `VERCEL_ENV_SETUP.md` - How to add env vars
  - `backend/RBAC_README.md` - RBAC system docs
  - `backend/.env.example` - Template for local dev

---

**Last Updated:** March 29, 2026 @ 08:45 AM
**Status:** Ready for launch after checklist completion
**Estimated Time:** 30-45 minutes to complete checklist
