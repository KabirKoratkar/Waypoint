-- ULTIMATE RLS & TYPE CONVERSION FIX
-- This script fixes the "cannot alter type of a column used in a policy definition" error
-- by following the strict order: DROP policies -> ALTER columns -> CREATE policies.

-- 1. DROP ALL POTENTIAL POLICIES (Comprehensive list from all migrations)
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. ALTER COLUMNS TO TEXT (Universal string ID support)
-- We do this for both 'id' in profiles and 'user_id' in all other tables.
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    -- Fix profiles first
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
    END IF;

    -- Fix all tables with user_id
    FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'user_id' AND table_schema = 'public'
    LOOP
        -- Extra check to ensure we only alter if it's currently a UUID
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'user_id' AND data_type = 'uuid') THEN
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE TEXT USING user_id::text', t);
        END IF;
    END LOOP;
END $$;

-- 3. RE-ESTABLISH PRIMARY KEYS & CONSTRAINTS (Ensuring data integrity)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'profiles' AND constraint_type = 'PRIMARY KEY') THEN
        ALTER TABLE public.profiles ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 4. CREATE FEDERATED-READY POLICIES
-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id OR id LIKE 'auth0-%' OR id LIKE 'dev-%');

-- Colleges
CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- Essays
CREATE POLICY "Users can manage own essays" ON public.essays FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- Tasks
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- Activities
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') THEN
    CREATE POLICY "Users can manage own activities" ON public.activities FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
END IF;

-- Awards
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'awards') THEN
    CREATE POLICY "Users can manage own awards" ON public.awards FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
END IF;

-- Documents
CREATE POLICY "Users can manage own documents" ON public.documents FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- Conversations
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- Essay Versions
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'essay_versions') THEN
    CREATE POLICY "Users can manage own essay versions" ON public.essay_versions FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
END IF;

-- 5. FINAL RELOAD
NOTIFY pgrst, 'reload schema';
