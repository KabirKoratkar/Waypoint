-- Migration to support Federated IDs (Auth0/Mocks)
-- This converts UUID columns to TEXT to allow string IDs from external providers

-- 1. Profiles Table
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT;

-- 2. Colleges Table
ALTER TABLE public.colleges ALTER COLUMN user_id TYPE TEXT;

-- 3. Essays Table
ALTER TABLE public.essays ALTER COLUMN user_id TYPE TEXT;

-- 4. Tasks Table
ALTER TABLE public.tasks ALTER COLUMN user_id TYPE TEXT;

-- 5. Activities Table
ALTER TABLE public.activities ALTER COLUMN user_id TYPE TEXT;

-- 6. Awards Table
ALTER TABLE public.awards ALTER COLUMN user_id TYPE TEXT;

-- 7. Conversations Table
ALTER TABLE public.conversations ALTER COLUMN user_id TYPE TEXT;

-- 8. Tickets Table
ALTER TABLE public.tickets ALTER COLUMN user_id TYPE TEXT;

-- 9. Documents Table
ALTER TABLE public.documents ALTER COLUMN user_id TYPE TEXT;

-- Note: You may need to drop and re-create Foreign Keys if Postgres complains about type mismatch
-- but usually switching UUID -> TEXT is allowed if the referencing columns are also switched.
