-- Waypoint Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    graduation_year INTEGER,
    intended_major TEXT,
    high_school_name TEXT,
    unweighted_gpa NUMERIC,
    weighted_gpa NUMERIC,
    submission_leeway INTEGER DEFAULT 3,
    intensity_level TEXT DEFAULT 'Balanced',
    work_weekends BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    is_beta BOOLEAN DEFAULT false,
    premium_since TIMESTAMP WITH TIME ZONE,
    ai_profile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Colleges table
CREATE TABLE public.colleges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    application_platform TEXT, -- "Common App", "UC App", "Coalition"
    deadline DATE,
    deadline_type TEXT, -- "ED", "EA", "RD", "UC"
    essays_required JSONB DEFAULT '[]'::jsonb,
    test_policy TEXT, -- "Required", "Optional", "Test Blind", "Test Flexible"
    lors_required INTEGER DEFAULT 0,
    portfolio_required BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Not Started', -- "Not Started", "In Progress", "Completed"
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own colleges"
    ON public.colleges FOR ALL
    USING (auth.uid() = user_id);

-- Essays table
CREATE TABLE public.essays (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    essay_type TEXT, -- "Common App", "UC PIQ", "Supplement"
    prompt TEXT,
    content TEXT DEFAULT '',
    word_limit INTEGER,
    word_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    is_completed BOOLEAN DEFAULT false,
    last_saved TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own essays"
    ON public.essays FOR ALL
    USING (auth.uid() = user_id);

-- Tasks table
CREATE TABLE public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    category TEXT, -- "Essay", "Document", "LOR", "General"
    priority TEXT DEFAULT 'Medium', -- "High", "Medium", "Low"
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tasks"
    ON public.tasks FOR ALL
    USING (auth.uid() = user_id);

-- Documents table
CREATE TABLE public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase storage path
    file_type TEXT,
    file_size INTEGER,
    category TEXT, -- "Transcript", "Resume", "Award", "Certificate", "Test Score", "Essay Draft", "Portfolio", "Other"
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents"
    ON public.documents FOR ALL
    USING (auth.uid() = user_id);

-- Conversations table (for AI chat history)
CREATE TABLE public.conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL, -- "user" or "assistant"
    content TEXT NOT NULL,
    function_call JSONB, -- For AI function calls
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
    ON public.conversations FOR ALL
    USING (auth.uid() = user_id);

-- Essay versions (for version control)
CREATE TABLE public.essay_versions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    essay_id UUID REFERENCES public.essays(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.essay_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own essay versions"
    ON public.essay_versions FOR ALL
    USING (auth.uid() = user_id);

-- Functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_colleges_updated_at
    BEFORE UPDATE ON public.colleges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update word count automatically
CREATE OR REPLACE FUNCTION update_essay_word_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = array_length(regexp_split_to_array(trim(NEW.content), '\s+'), 1);
    NEW.char_count = length(NEW.content);
    NEW.last_saved = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_essay_counts
    BEFORE INSERT OR UPDATE OF content ON public.essays
    FOR EACH ROW
    EXECUTE FUNCTION update_essay_word_count();

-- Create storage bucket for documents (run this separately in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies (run after creating bucket)
-- CREATE POLICY "Users can upload own documents"
--     ON storage.objects FOR INSERT
--     WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can read own documents"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Indexes for performance
CREATE INDEX idx_colleges_user_id ON public.colleges(user_id);
CREATE INDEX idx_essays_user_id ON public.essays(user_id);
CREATE INDEX idx_essays_college_id ON public.essays(college_id);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);

-- Global College Catalog (Reference data for all users)
CREATE TABLE public.college_catalog (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    application_platform TEXT,
    deadline_date DATE,
    deadline_type TEXT,
    test_policy TEXT,
    lors_required INTEGER,
    portfolio_required BOOLEAN DEFAULT false,
    essays JSONB DEFAULT '[]'::jsonb,
    verified BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Read-only for public)
ALTER TABLE public.college_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view college catalog"
    ON public.college_catalog FOR SELECT
    USING (true);

-- Indexes
CREATE INDEX idx_college_catalog_name ON public.college_catalog(name);
-- Activities and Awards/Honors Schema for Waypoint

-- Activities Table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    organization TEXT,
    description TEXT,
    years_active INTEGER[] DEFAULT '{}', -- [9, 10, 11, 12]
    hours_per_week INTEGER,
    weeks_per_year INTEGER,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own activities"
    ON public.activities FOR ALL
    USING (auth.uid() = user_id);

-- Awards Table
CREATE TABLE IF NOT EXISTS public.awards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    level TEXT, -- "School", "Regional", "State", "National", "International"
    years_received INTEGER[] DEFAULT '{}', -- [9, 10, 11, 12]
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own awards"
    ON public.awards FOR ALL
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_awards_user_id ON public.awards(user_id);
-- Migration to extend profiles and colleges tables
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS planned_deadlines TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS type TEXT; -- "Reach", "Target", "Safety"
-- ULTIMATE RLS & TYPE CONVERSION FIX (v3 - Procedural Block)
-- This script uses a single DO block to ensure perfect execution order and syntax.

DO $$ 
DECLARE 
    pol RECORD;
    t TEXT;
BEGIN
    -- 1. DROP ALL EXISTING POLICIES IN PUBLIC SCHEMA
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;

    -- 2. ALTER UUID COLUMNS TO TEXT
    -- Profiles table PK
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
    END IF;

    -- All tables with user_id
    FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'user_id' AND table_schema = 'public'
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'user_id' AND data_type = 'uuid') THEN
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE TEXT USING user_id::text', t);
        END IF;
    END LOOP;

    -- 3. RE-ESTABLISH PRIMARY KEYS
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'profiles' AND constraint_type = 'PRIMARY KEY') THEN
        ALTER TABLE public.profiles ADD PRIMARY KEY (id);
    END IF;

    -- 4. RE-ESTABLISH POLICIES (Federated ID Support)
    -- Profiles
    EXECUTE 'CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id OR id LIKE ''auth0-%'' OR id LIKE ''dev-%'')';
    EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id OR id LIKE ''auth0-%'' OR id LIKE ''dev-%'')';
    EXECUTE 'CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id OR id LIKE ''auth0-%'' OR id LIKE ''dev-%'')';

    -- Colleges
    EXECUTE 'CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';

    -- Essays
    EXECUTE 'CREATE POLICY "Users can manage own essays" ON public.essays FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';

    -- Tasks
    EXECUTE 'CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';

    -- Activities (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') THEN
        EXECUTE 'CREATE POLICY "Users can manage own activities" ON public.activities FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';
    END IF;

    -- Awards (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'awards') THEN
        EXECUTE 'CREATE POLICY "Users can manage own awards" ON public.awards FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';
    END IF;

    -- Documents
    EXECUTE 'CREATE POLICY "Users can manage own documents" ON public.documents FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';

    -- Conversations
    EXECUTE 'CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';

    -- Essay Versions (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'essay_versions') THEN
        EXECUTE 'CREATE POLICY "Users can manage own essay versions" ON public.essay_versions FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE ''auth0-%'' OR user_id LIKE ''dev-%'')';
    END IF;

    -- 5. RELOAD SCHEMA CACHE
    NOTIFY pgrst, 'reload schema';

END $$;
-- ULTIMATE RECOVERY MIGRATION: Federated ID Support
-- This handles EVERY foreign key constraint error by dropping ALL references 
-- to public.profiles before converting the primary key type.

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
DROP POLICY IF EXISTS "Users can manage own essay versions" ON public.essay_versions;

-- 2. DROP ALL FOREIGN KEYS ACROSS ENTIRE SCHEMA (Profiles References)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.colleges DROP CONSTRAINT IF EXISTS colleges_user_id_fkey;
ALTER TABLE public.essays DROP CONSTRAINT IF EXISTS essays_user_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
ALTER TABLE public.awards DROP CONSTRAINT IF EXISTS awards_user_id_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_user_id_fkey;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;

-- Extra check for essay_versions which just threw an error
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'essay_versions_user_id_fkey') THEN
        ALTER TABLE public.essay_versions DROP CONSTRAINT essay_versions_user_id_fkey;
    END IF;
END $$;

-- 3. ALTER ALL ID COLUMNS TO TEXT (Strict conversion)
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE public.colleges ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.essays ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.tasks ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Conditional conversion for other common tables
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'user_id' AND table_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE TEXT USING user_id::text', t);
    END LOOP;
END $$;

-- 4. RE-ESTABLISH CORE POLICIES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own essays" ON public.essays FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid()::text = user_id OR user_id LIKE 'auth0-%' OR user_id LIKE 'dev-%');

-- 5. FINAL RE-ENABLE
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- SUCCESS: Database now supports universal string IDs for all federated login providers.
