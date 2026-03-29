-- RBAC (Role-Based Access Control) Implementation for Waypoint
-- Replaces hardcoded email whitelist with proper role system

-- 1. Create roles enum type
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'user', 'beta_tester');

-- 2. Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 3. Create role assignments table (for future multi-tenant support)
CREATE TABLE IF NOT EXISTS public.role_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, role) -- Prevent duplicate role assignments
);

-- 4. Enable RLS on role_assignments
ALTER TABLE public.role_assignments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for role_assignments
CREATE POLICY "Admins can view all role assignments"
    ON public.role_assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can view own role assignments"
    ON public.role_assignments FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Only admins can assign roles"
    ON public.role_assignments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update role assignments"
    ON public.role_assignments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete role assignments"
    ON public.role_assignments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 6. Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM public.profiles 
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Create helper function to check if user is beta tester
CREATE OR REPLACE FUNCTION is_beta_tester(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM public.profiles 
        WHERE id = user_id AND (is_beta = true OR role = 'beta_tester')
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Create helper function to check if user has premium access
CREATE OR REPLACE FUNCTION has_premium_access(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM public.profiles 
        WHERE id = user_id AND (is_premium = true OR is_beta = true OR role = 'admin')
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Update RLS policies on profiles to use new role system
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR is_admin(auth.uid()));

-- 10. Create audit table for admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES public.profiles(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
    ON public.admin_audit_log FOR SELECT
    USING (is_admin(auth.uid()));

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium ON public.profiles(is_premium);
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON public.role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role ON public.role_assignments(role);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);

-- 12. Seed initial admin (run this carefully!)
-- Uncomment and customize with actual admin email
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE email = 'kabirvideo@gmail.com';

-- 13. Trigger to auto-log admin actions
CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER AS $$
BEGIN
    IF is_admin(auth.uid()) THEN
        INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, details)
        VALUES (
            auth.uid(),
            TG_OP,
            NEW.id,
            jsonb_build_object(
                'old_role', OLD.role,
                'new_role', NEW.role,
                'timestamp', NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_role_change_audit
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW
WHEN (OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION log_admin_action();
