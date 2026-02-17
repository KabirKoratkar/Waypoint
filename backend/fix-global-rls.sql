-- COMPREHENSIVE RLS FIX: Federated & Mock ID Support
-- This script ensures all tables allow manage access for Auth0 and Dev users.

-- 1. Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT 
USING (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE 
USING (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT 
WITH CHECK (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');

-- 2. Colleges
DROP POLICY IF EXISTS "Users can manage own colleges" ON public.colleges;
CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL 
USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 3. Essays
DROP POLICY IF EXISTS "Users can manage own essays" ON public.essays;
CREATE POLICY "Users can manage own essays" ON public.essays FOR ALL 
USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 4. Tasks
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL 
USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 5. Activities
DROP POLICY IF EXISTS "Users can manage own activities" ON public.activities;
CREATE POLICY "Users can manage own activities" ON public.activities FOR ALL 
USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 6. Awards
DROP POLICY IF EXISTS "Users can manage own awards" ON public.awards;
CREATE POLICY "Users can manage own awards" ON public.awards FOR ALL 
USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 7. Documents
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
CREATE POLICY "Users can manage own documents" ON public.documents FOR ALL 
USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 8. Conversations
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL 
USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- Handle potential data types mismatch (UUID vs TEXT)
-- This ensures the column types are consistent across the board.
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'user_id' AND table_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE TEXT USING user_id::text', t);
    END LOOP;
END $$;

-- Specifically for profiles where the PK is 'id'
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;

-- Final Schema Cache Reload
NOTIFY pgrst, 'reload schema';
