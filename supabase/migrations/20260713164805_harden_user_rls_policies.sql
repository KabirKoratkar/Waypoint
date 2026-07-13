-- Remove legacy ID-prefix bypasses and require authenticated ownership.
-- This intentionally preserves unrelated collaboration and public-catalog policies.

do $$
begin
    if to_regclass('public.profiles') is not null then
        alter table public.profiles enable row level security;

        drop policy if exists "Users can view own profile" on public.profiles;
        drop policy if exists "Users can update own profile" on public.profiles;
        drop policy if exists "Users can insert own profile" on public.profiles;

        create policy "Users can view own profile"
            on public.profiles for select
            to authenticated
            using ((select auth.uid())::text = id::text);

        create policy "Users can update own profile"
            on public.profiles for update
            to authenticated
            using ((select auth.uid())::text = id::text)
            with check ((select auth.uid())::text = id::text);

        create policy "Users can insert own profile"
            on public.profiles for insert
            to authenticated
            with check ((select auth.uid())::text = id::text);

        -- Table-level UPDATE would let users set billing/admin fields on their own row.
        -- Replace it with an explicit allowlist of user-editable profile columns.
        revoke update on public.profiles from authenticated;
    end if;
end
$$;

do $$
declare
    column_name text;
begin
    if to_regclass('public.profiles') is not null then
        for column_name in
            select allowed.column_name
            from (values
                ('id'),
                ('email'),
                ('full_name'),
                ('graduation_year'),
                ('intended_major'),
                ('high_school_name'),
                ('school_name'),
                ('unweighted_gpa'),
                ('weighted_gpa'),
                ('sat_score'),
                ('act_score'),
                ('submission_leeway'),
                ('intensity_level'),
                ('work_weekends'),
                ('daily_word_goal'),
                ('ai_profile'),
                ('location'),
                ('birth_date'),
                ('planned_deadlines'),
                ('profile_bio'),
                ('demographics'),
                ('interests'),
                ('user_role'),
                ('student_name'),
                ('top_goal'),
                ('high_school_id'),
                ('app_focus'),
                ('updated_at')
            ) as allowed(column_name)
            where exists (
                select 1
                from information_schema.columns c
                where c.table_schema = 'public'
                  and c.table_name = 'profiles'
                  and c.column_name = allowed.column_name
            )
        loop
            execute format(
                'grant update (%I) on public.profiles to authenticated',
                column_name
            );
        end loop;
    end if;
end
$$;

do $$
declare
    target record;
begin
    for target in
        select * from (values
            ('colleges', 'Users can manage own colleges', 'user_id'),
            ('essays', 'Users can manage own essays', 'user_id'),
            ('tasks', 'Users can manage own tasks', 'user_id'),
            ('activities', 'Users can manage own activities', 'user_id'),
            ('awards', 'Users can manage own awards', 'user_id'),
            ('documents', 'Users can manage own documents', 'user_id'),
            ('conversations', 'Users can manage own conversations', 'user_id'),
            ('essay_versions', 'Users can manage own essay versions', 'user_id')
        ) as policies(table_name, policy_name, owner_column)
    loop
        if to_regclass(format('public.%I', target.table_name)) is not null then
            execute format('alter table public.%I enable row level security', target.table_name);
            execute format(
                'drop policy if exists %I on public.%I',
                target.policy_name,
                target.table_name
            );
            execute format(
                'create policy %I on public.%I for all to authenticated using ((select auth.uid())::text = %I::text) with check ((select auth.uid())::text = %I::text)',
                target.policy_name,
                target.table_name,
                target.owner_column,
                target.owner_column
            );
        end if;
    end loop;
end
$$;
