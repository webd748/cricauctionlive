begin;

create or replace function public.security_baseline_health()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
    checks jsonb := '{}'::jsonb;
    ok boolean;
begin
    checks := checks || jsonb_build_object(
        'players_read_authenticated',
        exists(
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'players'
              and policyname = 'players_read'
              and roles @> array['authenticated']
        )
    );

    checks := checks || jsonb_build_object(
        'teams_read_authenticated',
        exists(
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'teams'
              and policyname = 'teams_read'
              and roles @> array['authenticated']
        )
    );

    checks := checks || jsonb_build_object(
        'sold_players_read_authenticated',
        exists(
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'sold_players'
              and policyname = 'sold_players_read'
              and roles @> array['authenticated']
        )
    );

    checks := checks || jsonb_build_object(
        'auction_state_read_authenticated',
        exists(
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'auction_state'
              and policyname = 'auction_state_read'
              and roles @> array['authenticated']
        )
    );

    checks := checks || jsonb_build_object(
        'auction_settings_read_authenticated',
        exists(
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'auction_settings'
              and policyname = 'auction_settings_read'
              and roles @> array['authenticated']
        )
    );

    checks := checks || jsonb_build_object(
        'auction_settings_single_row_idx',
        exists(
            select 1
            from pg_indexes
            where schemaname = 'public'
              and indexname = 'auction_settings_single_row_idx'
        )
    );

    checks := checks || jsonb_build_object(
        'auction_state_single_row_idx',
        exists(
            select 1
            from pg_indexes
            where schemaname = 'public'
              and indexname = 'auction_state_single_row_idx'
        )
    );

    checks := checks || jsonb_build_object(
        'place_bid_guard_present',
        position('if not public.is_admin()' in lower(pg_get_functiondef('public.place_bid(uuid)'::regprocedure))) > 0
    );

    checks := checks || jsonb_build_object(
        'sell_player_guard_present',
        position('if not public.is_admin()' in lower(pg_get_functiondef('public.sell_player()'::regprocedure))) > 0
    );

    checks := checks || jsonb_build_object(
        'reset_auction_guard_present',
        position('if not public.is_admin()' in lower(pg_get_functiondef('public.reset_auction()'::regprocedure))) > 0
    );

    checks := checks || jsonb_build_object(
        'service_role_can_execute_place_bid',
        has_function_privilege('service_role', 'public.place_bid(uuid)', 'EXECUTE')
    );

    checks := checks || jsonb_build_object(
        'authenticated_cannot_execute_place_bid',
        not has_function_privilege('authenticated', 'public.place_bid(uuid)', 'EXECUTE')
    );

    checks := checks || jsonb_build_object(
        'anon_cannot_execute_place_bid',
        not has_function_privilege('anon', 'public.place_bid(uuid)', 'EXECUTE')
    );

    checks := checks || jsonb_build_object(
        'billing_plans_read_active',
        exists(
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'billing_plans'
              and policyname = 'billing_plans_read'
        )
    );

    checks := checks || jsonb_build_object(
        'billing_subscriptions_read_own_or_admin',
        exists(
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'billing_subscriptions'
              and policyname = 'billing_subscriptions_read_own_or_admin'
        )
    );

    checks := checks || jsonb_build_object(
        'authenticated_can_execute_select_billing_plan',
        has_function_privilege('authenticated', 'public.select_billing_plan(text)', 'EXECUTE')
    );

    checks := checks || jsonb_build_object(
        'anon_cannot_execute_select_billing_plan',
        not has_function_privilege('anon', 'public.select_billing_plan(text)', 'EXECUTE')
    );

    select coalesce(bool_and(value::boolean), false)
    into ok
    from jsonb_each_text(checks);

    return jsonb_build_object('ok', ok, 'checks', checks);
end;
$$;

revoke all on function public.security_baseline_health() from public;
grant execute on function public.security_baseline_health() to service_role;

commit;
