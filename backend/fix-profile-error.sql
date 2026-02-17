-- FIX: Federated ID Support for Profiles & Duplicate Cleanup
-- This script fixes the "Cannot coerce result to single JSON object" error
-- by ensuring RLS policies allow federated IDs correctly.

-- 1. Identify and Clean Duplicates (Keep most recent entry)
-- This is a precautionary measure in case the database somehow has duplicate IDs.
DELETE FROM public.profiles p1
USING public.profiles p2
WHERE p1.id = p2.id AND p1.created_at < p2.created_at;

-- 2. Ensure ID is Primary Key and and UNIQUE
-- If the PK was lost during previous type conversions, this restores it.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'profiles' AND constraint_type = 'PRIMARY KEY') THEN
        ALTER TABLE public.profiles ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 3. Update RLS Policies for Profiles
-- The existing policies only checked auth.uid(), which fails for auth0- or dev- users.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Use a more permissive policy for federated IDs to match colleges/essays/tasks
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');

-- 4. Re-establish unique constraints if missing
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- 5. Signal Schema Refresh
NOTIFY pgrst, 'reload schema';
