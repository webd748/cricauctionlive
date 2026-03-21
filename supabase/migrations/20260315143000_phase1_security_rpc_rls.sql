begin;

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select
        coalesce(lower(auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner'), false)
        or coalesce(lower(auth.jwt() -> 'user_metadata' ->> 'role') in ('admin', 'owner'), false);
$$;

create or replace function public.current_bid_increment(p_current_bid numeric, p_bid_tiers jsonb)
returns numeric
language plpgsql
stable
as $$
declare
    v_tier jsonb;
    v_increment numeric;
begin
    if p_bid_tiers is null or jsonb_typeof(p_bid_tiers) <> 'array' or jsonb_array_length(p_bid_tiers) = 0 then
        return case when p_current_bid < 1000 then 100 else 200 end;
    end if;

    for v_tier in select * from jsonb_array_elements(p_bid_tiers)
    loop
        if p_current_bid >= coalesce((v_tier ->> 'from')::numeric, 0)
           and p_current_bid < coalesce((v_tier ->> 'to')::numeric, 999999999) then
            v_increment := coalesce((v_tier ->> 'increment')::numeric, 100);
            return greatest(1, v_increment);
        end if;
    end loop;

    v_tier := p_bid_tiers -> (jsonb_array_length(p_bid_tiers) - 1);
    return greatest(1, coalesce((v_tier ->> 'increment')::numeric, 100));
end;
$$;

create or replace function public.place_bid(p_team_id uuid)
returns table(current_bid numeric, current_team_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_state auction_state%rowtype;
    v_settings auction_settings%rowtype;
    v_wallet numeric;
    v_new_bid numeric;
    v_increment numeric;
    v_player_count int;
    v_mbv numeric;
begin
    select * into v_state from auction_state limit 1 for update;
    if not found then
        insert into auction_state (current_player_id, current_bid, current_team_id, is_live)
        values (null, 0, null, false)
        returning * into v_state;
    end if;

    if v_state.current_player_id is null then
        raise exception 'No active player selected.';
    end if;

    select * into v_settings from auction_settings limit 1;
    if not found then
        raise exception 'Auction settings are missing.';
    end if;

    select wallet_balance into v_wallet from teams where id = p_team_id for update;
    if v_wallet is null then
        raise exception 'Team not found.';
    end if;

    select count(*) into v_player_count from sold_players where team_id = p_team_id;
    v_increment := public.current_bid_increment(coalesce(v_state.current_bid, 0), v_settings.bid_tiers);

    if v_state.current_team_id is null then
        v_new_bid := greatest(coalesce(v_state.current_bid, 0), coalesce(v_settings.base_price, 0));
    else
        v_new_bid := coalesce(v_state.current_bid, 0) + v_increment;
    end if;

    v_mbv := v_wallet - greatest(0, coalesce(v_settings.min_squad_size, 0) - v_player_count - 1) * coalesce(v_settings.base_price, 0);

    if v_new_bid > v_wallet then
        raise exception 'Team wallet is insufficient for this bid.';
    end if;

    if v_new_bid > v_mbv then
        raise exception 'Team exceeds Max Bid Value.';
    end if;

    update auction_state
    set current_team_id = p_team_id,
        current_bid = v_new_bid,
        is_live = true
    where id = v_state.id;

    return query select v_new_bid, p_team_id;
end;
$$;

create or replace function public.sell_player()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_state auction_state%rowtype;
    v_settings auction_settings%rowtype;
    v_wallet numeric;
    v_player_count int;
    v_mbv numeric;
    v_sale_id uuid;
begin
    select * into v_state from auction_state limit 1 for update;
    if not found or v_state.current_player_id is null or v_state.current_team_id is null then
        raise exception 'Active player and winning team are required.';
    end if;

    select * into v_settings from auction_settings limit 1;
    if not found then
        raise exception 'Auction settings are missing.';
    end if;

    select wallet_balance into v_wallet from teams where id = v_state.current_team_id for update;
    if v_wallet is null then
        raise exception 'Winning team does not exist.';
    end if;

    select count(*) into v_player_count from sold_players where team_id = v_state.current_team_id;
    v_mbv := v_wallet - greatest(0, coalesce(v_settings.min_squad_size, 0) - v_player_count - 1) * coalesce(v_settings.base_price, 0);

    if v_state.current_bid > v_wallet then
        raise exception 'Team wallet is insufficient.';
    end if;
    if v_state.current_bid > v_mbv then
        raise exception 'Team exceeds Max Bid Value.';
    end if;

    update players set is_sold = true where id = v_state.current_player_id;

    insert into sold_players (player_id, team_id, sold_price)
    values (v_state.current_player_id, v_state.current_team_id, v_state.current_bid)
    returning id into v_sale_id;

    update teams
    set wallet_balance = wallet_balance - v_state.current_bid
    where id = v_state.current_team_id;

    update auction_state
    set current_player_id = null,
        current_team_id = null,
        current_bid = 0,
        is_live = false
    where id = v_state.id;

    return v_sale_id;
end;
$$;

create or replace function public.mark_unsold()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_state auction_state%rowtype;
begin
    select * into v_state from auction_state limit 1 for update;
    if not found then
        return false;
    end if;

    update auction_state
    set current_player_id = null,
        current_team_id = null,
        current_bid = 0,
        is_live = false
    where id = v_state.id;

    return true;
end;
$$;

create or replace function public.transfer_player(p_sold_player_id uuid, p_new_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sale sold_players%rowtype;
begin
    select * into v_sale from sold_players where id = p_sold_player_id for update;
    if not found then
        raise exception 'Sale record not found.';
    end if;

    if v_sale.team_id = p_new_team_id then
        return true;
    end if;

    update teams
    set wallet_balance = wallet_balance + v_sale.sold_price
    where id = v_sale.team_id;

    update teams
    set wallet_balance = wallet_balance - v_sale.sold_price
    where id = p_new_team_id;

    update sold_players
    set team_id = p_new_team_id
    where id = p_sold_player_id;

    return true;
end;
$$;

create or replace function public.update_sale_price(p_sold_player_id uuid, p_new_price numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sale sold_players%rowtype;
    v_diff numeric;
begin
    if p_new_price < 0 then
        raise exception 'Sale price cannot be negative.';
    end if;

    select * into v_sale from sold_players where id = p_sold_player_id for update;
    if not found then
        raise exception 'Sale record not found.';
    end if;

    v_diff := p_new_price - v_sale.sold_price;

    update teams
    set wallet_balance = wallet_balance - v_diff
    where id = v_sale.team_id;

    update sold_players
    set sold_price = p_new_price
    where id = p_sold_player_id;

    return true;
end;
$$;

create or replace function public.remove_sale(p_sold_player_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sale sold_players%rowtype;
begin
    select * into v_sale from sold_players where id = p_sold_player_id for update;
    if not found then
        raise exception 'Sale record not found.';
    end if;

    update teams
    set wallet_balance = wallet_balance + v_sale.sold_price
    where id = v_sale.team_id;

    update players
    set is_sold = false
    where id = v_sale.player_id;

    delete from sold_players where id = p_sold_player_id;

    return true;
end;
$$;

create or replace function public.reset_auction()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from sold_players;
    delete from auction_state;
    delete from players;
    delete from teams;
    return true;
end;
$$;

alter table if exists auction_settings enable row level security;
alter table if exists auction_state enable row level security;
alter table if exists players enable row level security;
alter table if exists teams enable row level security;
alter table if exists sold_players enable row level security;

drop policy if exists "auction_settings_read" on auction_settings;
drop policy if exists "auction_settings_write_admin" on auction_settings;
create policy "auction_settings_read" on auction_settings for select using (true);
create policy "auction_settings_write_admin" on auction_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "auction_state_read" on auction_state;
drop policy if exists "auction_state_write_admin" on auction_state;
create policy "auction_state_read" on auction_state for select using (true);
create policy "auction_state_write_admin" on auction_state for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "players_read" on players;
drop policy if exists "players_write_admin" on players;
create policy "players_read" on players for select using (true);
create policy "players_write_admin" on players for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teams_read" on teams;
drop policy if exists "teams_write_admin" on teams;
create policy "teams_read" on teams for select using (true);
create policy "teams_write_admin" on teams for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sold_players_read" on sold_players;
drop policy if exists "sold_players_write_admin" on sold_players;
create policy "sold_players_read" on sold_players for select using (true);
create policy "sold_players_write_admin" on sold_players for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

drop policy if exists "team_logos_read" on storage.objects;
drop policy if exists "team_logos_write_admin" on storage.objects;
drop policy if exists "team_logos_delete_admin" on storage.objects;
create policy "team_logos_read" on storage.objects
for select
using (bucket_id = 'team-logos');
create policy "team_logos_write_admin" on storage.objects
for insert to authenticated
with check (bucket_id = 'team-logos' and public.is_admin());
create policy "team_logos_delete_admin" on storage.objects
for delete to authenticated
using (bucket_id = 'team-logos' and public.is_admin());

commit;
