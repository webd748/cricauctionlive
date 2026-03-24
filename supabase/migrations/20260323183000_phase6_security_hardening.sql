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

-- Keep exactly one settings row to avoid ambiguous limit(1) behavior.
with keep_row as (
    select ctid
    from auction_settings
    order by updated_at desc nulls last, id
    limit 1
)
delete from auction_settings s
where exists (select 1 from keep_row)
  and s.ctid <> (select ctid from keep_row);

create unique index if not exists auction_settings_single_row_idx
    on auction_settings ((true));

-- RPC execution scope hardening: authenticated users only (no anon execution).
revoke all on function public.place_bid(uuid) from public;
revoke all on function public.sell_player() from public;
revoke all on function public.mark_unsold() from public;
revoke all on function public.transfer_player(uuid, uuid) from public;
revoke all on function public.update_sale_price(uuid, numeric) from public;
revoke all on function public.remove_sale(uuid) from public;
revoke all on function public.reset_auction() from public;
revoke all on function public.team_player_counts() from public;

grant execute on function public.place_bid(uuid) to authenticated, service_role;
grant execute on function public.sell_player() to authenticated, service_role;
grant execute on function public.mark_unsold() to authenticated, service_role;
grant execute on function public.transfer_player(uuid, uuid) to authenticated, service_role;
grant execute on function public.update_sale_price(uuid, numeric) to authenticated, service_role;
grant execute on function public.remove_sale(uuid) to authenticated, service_role;
grant execute on function public.reset_auction() to authenticated, service_role;
grant execute on function public.team_player_counts() to authenticated, service_role;

revoke all on function public.select_billing_plan(text) from public;
revoke all on function public.submit_payment_proof(text, text, text) from public;
revoke all on function public.approve_payment_proof(uuid, integer) from public;
revoke all on function public.reject_payment_proof(uuid, text) from public;

grant execute on function public.select_billing_plan(text) to authenticated, service_role;
grant execute on function public.submit_payment_proof(text, text, text) to authenticated, service_role;
grant execute on function public.approve_payment_proof(uuid, integer) to authenticated, service_role;
grant execute on function public.reject_payment_proof(uuid, text) to authenticated, service_role;

commit;
