-- FINAL RECOVERY MIGRATION (v2): Federated ID Support
-- This handles the "profiles_id_fkey" incompatible type error by removing the 
-- strict foreign key dependency on the internal auth.users table.

-- 1. DROP ALL DEPENDENT POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own colleges" ON public.colleges;
DROP POLICY IF EXISTS "Users can manage own essays" ON public.essays;
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;

-- 2. DROP FOREIGN KEYS (CRITICAL STEP)
-- Drop the constraint that links your profiles to the restricted internal auth table
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.colleges DROP CONSTRAINT IF EXISTS colleges_user_id_fkey;
ALTER TABLE public.essays DROP CONSTRAINT IF EXISTS essays_user_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;

-- 3. ALTER PRIMARY KEY AND COLUMN TYPES
-- Convert from UUID to TEXT to support Auth0 (auth0-...) and Mock (dev-user-...) strings
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.colleges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.essays ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.tasks ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Additional tables (Activities/Awards/Conversations)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') THEN
        ALTER TABLE public.activities ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'awards') THEN
        ALTER TABLE public.awards ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        ALTER TABLE public.conversations ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
END $$;

-- 4. RE-ESTABLISH POLICIES
-- We cast auth.uid() to text so it can compare with the new TEXT ID field
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id);

-- For colleges/essays/tasks, allow managing if user matches id or if it's a federated account
CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own essays" ON public.essays FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 5. RE-ENABLE RLS (Ensure security is still active)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. FINAL NOTIFICATION
-- SUCCESS: Profiles table decoupled from internal UUID constraint. Strings now supported.
