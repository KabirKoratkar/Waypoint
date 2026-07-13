-- Prevent caller-controlled schemas from changing object resolution inside functions.
ALTER FUNCTION public.is_admin(text)
    SET search_path = pg_catalog, public;

ALTER FUNCTION public.is_beta_tester(text)
    SET search_path = pg_catalog, public;

ALTER FUNCTION public.has_premium_access(text)
    SET search_path = pg_catalog, public;

ALTER FUNCTION public.log_admin_action()
    SET search_path = pg_catalog, public;

ALTER FUNCTION public.update_updated_at_column()
    SET search_path = pg_catalog, public;

ALTER FUNCTION public.update_essay_word_count()
    SET search_path = pg_catalog, public;
