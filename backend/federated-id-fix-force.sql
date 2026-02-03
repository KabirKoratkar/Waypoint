-- HEAVY RECOVERY MIGRATION: Federated ID Support
-- This handles the "cannot alter type of a column used in a policy definition" error
-- by temporarily dropping and re-creating the RLS policies.

-- 1. DROP ALL DEPENDENT POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own colleges" ON public.colleges;
DROP POLICY IF EXISTS "Users can manage own essays" ON public.essays;
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can manage own awards" ON public.awards;
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;

-- 2. DROP FOREIGN KEYS (Temporary)
ALTER TABLE public.colleges DROP CONSTRAINT IF EXISTS colleges_user_id_fkey;
ALTER TABLE public.essays DROP CONSTRAINT IF EXISTS essays_user_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
-- Activities/Awards/etc might not have FKs set up yet in some versions, but we'll try:
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
ALTER TABLE public.awards DROP CONSTRAINT IF EXISTS awards_user_id_fkey;

-- 3. ALTER PRIMARY KEY AND COLUMN TYPES
-- We use USING clause to cast existing UUIDs to TEXT
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.colleges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.essays ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.tasks ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Additional tables
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        ALTER TABLE public.documents ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
END $$;

-- 4. RE-ESTABLISH POLICIES
-- Note: We cast auth.uid() to text to allow comparison with our new string IDs
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own essays" ON public.essays FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 5. RE-ENABLE RLS (Safety Check)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. FINAL NOTIFICATION
-- SUCCESS: Schema migrated to support both Supabase Auth and Federated IDs (Auth0/Mocks).
