-- High Schools Table (global, shared across all users)
CREATE TABLE IF NOT EXISTS high_schools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable trigram extension for fuzzy search (Supabase supports this)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create index for fast search
CREATE INDEX IF NOT EXISTS idx_high_schools_name ON high_schools USING gin (name gin_trgm_ops);

-- Allow all authenticated users to read
ALTER TABLE high_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read high schools" ON high_schools
    FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert high schools" ON high_schools
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add interests column to profiles (replacing intended_major concept for onboarding)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[];

-- Add user_role column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'student';

-- Add high_school_id to profiles for linking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS high_school_id UUID REFERENCES high_schools(id);

-- Ensure college_catalog allows inserts from authenticated users (for global DB)
CREATE POLICY "Authenticated can insert to college_catalog" ON college_catalog
    FOR INSERT WITH CHECK (true);
