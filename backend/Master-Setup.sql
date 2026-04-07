-- WAYPOINT ULTIMATE SUPABASE SETUP SCRIPT --
-- RUN THIS IN YOUR SUPABASE SQL EDITOR --

-- 1. Enable Dependencies
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ensure Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update Schema to Document-Based Model
ALTER TABLE public.profiles DROP COLUMN IF EXISTS intended_major;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS unweighted_gpa;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS weighted_gpa;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS sat_score;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS act_score;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_transfer;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS target_start_year;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS interests;

-- 3.5 Ensure required base columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS graduation_year INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_school_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_profile JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS submission_leeway INTEGER DEFAULT 2;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS intensity_level TEXT DEFAULT 'Moderate';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_weekends BOOLEAN DEFAULT false;

-- 4. Enable RLS and Create Policies for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()::text = id::text);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()::text = id::text);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- 5. Nuke Activities Table (Moved to Document Model)
DROP TABLE IF EXISTS public.activities CASCADE;

-- 6. Ensure Colleges Table
CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    application_platform TEXT,
    deadline DATE,
    deadline_type TEXT,
    essays_required JSONB DEFAULT '[]'::jsonb,
    test_policy TEXT,
    lors_required INTEGER DEFAULT 0,
    portfolio_required BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Not Started',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own colleges" ON public.colleges;
CREATE POLICY "Users can manage own colleges" ON public.colleges FOR ALL USING (auth.uid()::text = user_id::text);

-- 7. Trigger to keep schema cache updated for PostgREST
NOTIFY pgrst, 'reload schema';
 