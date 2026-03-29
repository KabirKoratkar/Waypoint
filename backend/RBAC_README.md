# Role-Based Access Control (RBAC) System

This document explains the new RBAC implementation for Waypoint. It replaces the hardcoded email whitelist with a proper, scalable role system.

## Overview

### Roles

- **admin**: Full access. Can assign roles, view audit logs, manage users.
- **moderator**: Can moderate content, view some analytics.
- **beta_tester**: Early access to features. Gets premium automatically.
- **user**: Standard user. Trial period or paid premium.

### Profile Fields

Each user's `profiles` table row now includes:

```sql
role             user_role  DEFAULT 'user'        -- The user's role
is_premium       BOOLEAN    DEFAULT false         -- Paid premium subscriber
is_beta          BOOLEAN    DEFAULT false         -- Beta tester (deprecated, use role)
premium_since    TIMESTAMP  NULL                  -- When they became premium
stripe_customer_id TEXT     NULL                  -- Stripe customer ID
```

## Setup

### 1. Run the Migration

Apply `rbac-implementation.sql` to your Supabase database:

```bash
# Option A: Via Supabase Dashboard SQL Editor
# Copy/paste the entire rbac-implementation.sql file

# Option B: Via psql (if you have direct access)
psql -U postgres -d waypoint < backend/rbac-implementation.sql
```

### 2. Seed Initial Admin

After running the migration, promote your account to admin:

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'kabirvideo@gmail.com';
```

### 3. Update Environment Variables

Remove the old email whitelist variables (they're still supported as fallback):

```bash
# Old (optional fallback)
VITE_ADMIN_EMAILS=kabirvideo@gmail.com

# New system uses database roles
# No env vars needed for basic RBAC
```

## Usage

### Frontend (JavaScript)

```javascript
import { getUserProfile, isPremiumUser } from './js/supabase-config.js';

const profile = await getUserProfile(userId);

// Check premium access (uses both role + legacy flags)
if (isPremiumUser(profile)) {
    // Show premium features
}

// Check specific role
if (profile.role === 'admin') {
    // Show admin panel
}
```

### Backend (Node.js)

```javascript
import { isAdmin, hasPremiumAccess, premiumOnly } from './backend/rbac-helpers.js';

// Check if user is admin
if (await isAdmin(userId)) {
    // Allow admin action
}

// Check premium access
if (await hasPremiumAccess(userId)) {
    // Show premium content
}

// Use middleware to protect routes
app.post('/api/admin/users', premiumOnly, async (req, res) => {
    // Only premium users can access
});

// Or explicit check
app.post('/api/admin/roles', async (req, res) => {
    const { allowed, error } = await protectEndpoint(req, 'admin');
    if (!allowed) return res.status(403).json({ error });
    
    // Handle admin request
});
```

## Database Schema

### profiles table (updated)

```sql
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    graduation_year INTEGER,
    intended_major TEXT,
    role user_role DEFAULT 'user',              -- ← NEW
    is_premium BOOLEAN DEFAULT false,            -- ← UPDATED
    is_beta BOOLEAN DEFAULT false,               -- ← UPDATED
    premium_since TIMESTAMP WITH TIME ZONE,      -- ← NEW
    stripe_customer_id TEXT,                     -- ← NEW
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### role_assignments table (new)

```sql
CREATE TABLE public.role_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    role user_role NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, role)
);
```

### admin_audit_log table (new)

```sql
CREATE TABLE public.admin_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_user_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE
);
```

## RLS Policies

### role_assignments

- Admins can view all
- Users can view own assignments
- Only admins can insert/update/delete

### admin_audit_log

- Only admins can view

### profiles (updated)

- Users can view own profile
- Admins can view all profiles

## Admin Functions

These SQL functions are now available:

```sql
-- Check if user is admin
SELECT is_admin('user-id-here'::uuid);

-- Check if user is beta tester
SELECT is_beta_tester('user-id-here'::uuid);

-- Check if user has premium
SELECT has_premium_access('user-id-here'::uuid);
```

## Workflow: Promoting a User to Admin

### Via SQL

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'newadmin@example.com';
```

### Via Backend API (once implemented)

```javascript
// In admin endpoints
const result = await assignRole(adminUserId, targetUserId, 'admin');
if (result.success) {
    // User promoted
} else {
    // Error: result.error
}
```

## Audit Trail

All admin actions are logged to `admin_audit_log`:

```sql
SELECT * FROM public.admin_audit_log 
WHERE admin_id = 'your-admin-id'::uuid
ORDER BY created_at DESC
LIMIT 20;
```

## Migration from Email Whitelist

The old system (hardcoded email in code) is now gone. If you need a temporary fallback:

```javascript
// Frontend fallback (still works, but secondary)
const adminEmail = import.meta.env.VITE_ADMIN_EMAILS?.split(',') || [];
if (adminEmail.includes(profile.email)) {
    // Grant access
}
```

**Recommendation:** Remove `VITE_ADMIN_EMAILS` from your `.env` files once you've promoted users to admin roles in the database.

## Security Checklist

- [x] Email whitelist removed from codebase
- [x] Roles stored in database
- [x] RLS policies protect sensitive data
- [x] Admin audit log tracks actions
- [ ] Implement role assignment endpoint (next step)
- [ ] Add role management UI (future)

## Next Steps

1. **Run migration** on Supabase
2. **Promote initial admin** via SQL
3. **Test** frontend & backend with role-based access
4. **Implement role assignment API** endpoint
5. **Add admin UI** for managing roles (optional for MVP)

## Troubleshooting

### "Only admins can assign roles" error

Make sure the requester's profile has `role = 'admin'`:

```sql
SELECT role FROM public.profiles WHERE id = 'your-id'::uuid;
```

### RLS policy denying access

Check that RLS policies exist:

```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

### Audit log not showing entries

Make sure trigger is active:

```sql
SELECT * FROM pg_trigger WHERE tgrelname = 'profiles';
```

## References

- Supabase RBAC: https://supabase.com/docs/guides/auth/authorization
- PostgreSQL Roles: https://www.postgresql.org/docs/current/user-manag.html
