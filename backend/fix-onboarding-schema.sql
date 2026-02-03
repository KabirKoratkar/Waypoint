-- Consolidated Migration for Onboarding & Premium Features
-- Run this in your Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- 1. Add Academic Profile Columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS school_name TEXT,
ADD COLUMN IF NOT EXISTS unweighted_gpa NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS weighted_gpa NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS sat_score INTEGER,
ADD COLUMN IF NOT EXISTS act_score INTEGER,
ADD COLUMN IF NOT EXISTS planned_deadlines TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS submission_leeway INTEGER DEFAULT 3;

-- 2. Add Premium Status Columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_since TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 3. Update RLS (Ensure users can update these new columns)
-- Note: Policies usually cover all columns unless specifically restricted.
-- These are here just in case policies need to be reset.

-- 4. Refresh Schema Cache
-- Some versions of PostgREST need a signal to refresh, but usually adding a column triggers it.
-- If the error persists, you may need to restart your Supabase project or click "Reload schema" in the API settings.
