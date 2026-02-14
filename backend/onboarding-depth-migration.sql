-- Migration to support depth in onboarding and intended major per college
-- Run this in your Supabase SQL Editor

-- 1. Add major to colleges
ALTER TABLE public.colleges 
ADD COLUMN IF NOT EXISTS intended_major TEXT DEFAULT '';

-- 2. Add strategy and goals to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS intensity_level TEXT DEFAULT 'Balanced',
ADD COLUMN IF NOT EXISTS app_focus TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS top_goal TEXT;
