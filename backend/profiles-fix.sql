-- Migration to add missing columns to the profiles table
-- Run this in your Supabase SQL Editor

-- Check if submission_leeway exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='submission_leeway') THEN
        ALTER TABLE public.profiles ADD COLUMN submission_leeway INTEGER DEFAULT 2;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='intensity_level') THEN
        ALTER TABLE public.profiles ADD COLUMN intensity_level TEXT DEFAULT 'balanced';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='work_weekends') THEN
        ALTER TABLE public.profiles ADD COLUMN work_weekends BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='location') THEN
        ALTER TABLE public.profiles ADD COLUMN location TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='birth_date') THEN
        ALTER TABLE public.profiles ADD COLUMN birth_date TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='planned_deadlines') THEN
        ALTER TABLE public.profiles ADD COLUMN planned_deadlines TEXT[];
    END IF;
END $$;
