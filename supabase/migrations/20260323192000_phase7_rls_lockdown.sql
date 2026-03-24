begin;

-- Restrict app table reads to authenticated users.
drop policy if exists "auction_settings_read" on public.auction_settings;
create policy "auction_settings_read"
on public.auction_settings
for select
to authenticated
using (true);

drop policy if exists "auction_state_read" on public.auction_state;
create policy "auction_state_read"
on public.auction_state
for select
to authenticated
using (true);

drop policy if exists "players_read" on public.players;
create policy "players_read"
on public.players
for select
to authenticated
using (true);

drop policy if exists "teams_read" on public.teams;
create policy "teams_read"
on public.teams
for select
to authenticated
using (true);

drop policy if exists "sold_players_read" on public.sold_players;
create policy "sold_players_read"
on public.sold_players
for select
to authenticated
using (true);

drop policy if exists "billing_plans_read" on public.billing_plans;
create policy "billing_plans_read"
on public.billing_plans
for select
to authenticated
using (is_active = true or public.is_admin());

-- Prevent direct client execution of privileged auction RPCs.
revoke all on function public.place_bid(uuid) from authenticated;
revoke all on function public.sell_player() from authenticated;
revoke all on function public.mark_unsold() from authenticated;
revoke all on function public.transfer_player(uuid, uuid) from authenticated;
revoke all on function public.update_sale_price(uuid, numeric) from authenticated;
revoke all on function public.remove_sale(uuid) from authenticated;
revoke all on function public.reset_auction() from authenticated;

grant execute on function public.place_bid(uuid) to service_role;
grant execute on function public.sell_player() to service_role;
grant execute on function public.mark_unsold() to service_role;
grant execute on function public.transfer_player(uuid, uuid) to service_role;
grant execute on function public.update_sale_price(uuid, numeric) to service_role;
grant execute on function public.remove_sale(uuid) to service_role;
grant execute on function public.reset_auction() to service_role;

commit;
