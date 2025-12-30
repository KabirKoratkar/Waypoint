-- Migration to extend profiles and colleges tables
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS planned_deadlines TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS type TEXT; -- "Reach", "Target", "Safety"
