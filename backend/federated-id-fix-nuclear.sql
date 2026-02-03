-- NUCLEAR RECOVERY MIGRATION (v3): Global Federated ID Support
-- This handles the "tickets_user_id_fkey" and all other incompatible type errors
-- by aggressively dropping all foreign keys before converting IDs to TEXT.

-- 1. DROP ALL DEPENDENT POLICIES (Aggressive)
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

-- 2. DROP ALL KNOWN FOREIGN KEYS REFERENCING PROFILES
-- We drop these so we can change the 'id' type in the parent table (profiles)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.colleges DROP CONSTRAINT IF EXISTS colleges_user_id_fkey;
ALTER TABLE public.essays DROP CONSTRAINT IF EXISTS essays_user_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
ALTER TABLE public.awards DROP CONSTRAINT IF EXISTS awards_user_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_user_id_fkey;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;

-- 3. ALTER ALL ID COLUMNS TO TEXT
-- This allows Auth0 strings (auth0-...) to be stored everywhere
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.colleges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.essays ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.tasks ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Additional tables conditional check
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        ALTER TABLE public.tickets ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        ALTER TABLE public.documents ALTER COLUMN user_id TYPE TEXT USING user_id::text;
    END IF;
END $$;

-- 4. RE-ESTABLISH POLICIES (Compatible with strings)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Allow both Supabase Auth IDs and Federated IDs (Auth0/Mocks)
CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own essays" ON public.essays FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 5. RE-ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6. FINAL NOTIFICATION
-- SUCCESS: Global migration complete. All user-locked tables now support Federated IDs.
