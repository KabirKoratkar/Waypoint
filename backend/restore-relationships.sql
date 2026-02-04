-- RESTORE RELATIONSHIPS MIGRATION
-- This script re-establishes some foreign keys that were dropped in the god-mode migration.

DO $$ 
BEGIN
    -- 1. Restore the colleges -> profiles (user_id) relationship
    -- Since user_id and profiles.id are now both TEXT, this works.
    BEGIN
        ALTER TABLE public.colleges 
        ADD CONSTRAINT colleges_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Could not add colleges_user_id_fkey: %', SQLERRM;
    END;

    -- 2. Restore the essays -> profiles (user_id) relationship
    BEGIN
        ALTER TABLE public.essays 
        ADD CONSTRAINT essays_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Could not add essays_user_id_fkey: %', SQLERRM;
    END;

    -- 3. Restore the essays -> colleges (college_id) relationship
    -- These are likely still UUID. Let's check/re-add.
    BEGIN
        ALTER TABLE public.essays 
        ADD CONSTRAINT essays_college_id_fkey 
        FOREIGN KEY (college_id) REFERENCES public.colleges(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Could not add essays_college_id_fkey: %', SQLERRM;
    END;

    -- 4. Restore the tasks -> colleges (college_id) relationship
    BEGIN
        ALTER TABLE public.tasks 
        ADD CONSTRAINT tasks_college_id_fkey 
        FOREIGN KEY (college_id) REFERENCES public.colleges(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Could not add tasks_college_id_fkey: %', SQLERRM;
    END;

    -- 5. Restore the tasks -> profiles (user_id) relationship
    BEGIN
        ALTER TABLE public.tasks 
        ADD CONSTRAINT tasks_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Could not add tasks_user_id_fkey: %', SQLERRM;
    END;
END $$;
