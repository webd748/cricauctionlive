begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select
        coalesce(lower(auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'), false)
        or coalesce(lower(auth.jwt() ->> 'role') = 'service_role', false);
$$;

commit;
