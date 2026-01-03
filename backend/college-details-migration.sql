-- Add detailed fields to college_catalog
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS median_sat INTEGER;
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS median_act INTEGER;
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS avg_gpa DECIMAL(3,2);
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS acceptance_rate DECIMAL(5,2);
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS enrollment INTEGER;
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS cost_of_attendance INTEGER;
ALTER TABLE public.college_catalog ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index for acceptance rate and cost
CREATE INDEX IF NOT EXISTS idx_college_catalog_acceptance_rate ON public.college_catalog(acceptance_rate);
CREATE INDEX IF NOT EXISTS idx_college_catalog_cost ON public.college_catalog(cost_of_attendance);

-- Add a column to user colleges to store personalized research if needed
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
