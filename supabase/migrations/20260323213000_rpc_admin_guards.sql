begin;

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
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

    select *
    into v_state
    from auction_state
    limit 1
    for update;

    if not found then
        insert into auction_state (current_player_id, current_bid, current_team_id, is_live)
        values (null, 0, null, false)
        returning * into v_state;
    end if;

    if not v_state.is_live then
        raise exception 'Auction is not live.';
    end if;

    if v_state.current_player_id is null then
        raise exception 'No active player selected.';
    end if;

    select *
    into v_settings
    from auction_settings
    limit 1;

    if not found then
        raise exception 'Auction settings are missing.';
    end if;

    if coalesce(v_settings.is_active, false) = false then
        raise exception 'Auction is inactive.';
    end if;

    select wallet_balance
    into v_wallet
    from teams
    where id = p_team_id
    for update;

    if v_wallet is null then
        raise exception 'Team not found.';
    end if;

    select count(*)
    into v_player_count
    from sold_players
    where team_id = p_team_id;

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
        current_bid = v_new_bid
    where id = v_state.id;

    return query
    select v_new_bid, p_team_id;
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
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

    select *
    into v_state
    from auction_state
    limit 1
    for update;

    if not found or v_state.current_player_id is null or v_state.current_team_id is null then
        raise exception 'Active player and winning team are required.';
    end if;

    if not v_state.is_live then
        raise exception 'Auction is not live.';
    end if;

    if exists (
        select 1
        from sold_players
        where player_id = v_state.current_player_id
    ) then
        raise exception 'Player is already sold.';
    end if;

    select *
    into v_settings
    from auction_settings
    limit 1;

    if not found then
        raise exception 'Auction settings are missing.';
    end if;

    select wallet_balance
    into v_wallet
    from teams
    where id = v_state.current_team_id
    for update;

    if v_wallet is null then
        raise exception 'Winning team does not exist.';
    end if;

    select count(*)
    into v_player_count
    from sold_players
    where team_id = v_state.current_team_id;

    v_mbv := v_wallet - greatest(0, coalesce(v_settings.min_squad_size, 0) - v_player_count - 1) * coalesce(v_settings.base_price, 0);

    if v_state.current_bid > v_wallet then
        raise exception 'Team wallet is insufficient.';
    end if;

    if v_state.current_bid > v_mbv then
        raise exception 'Team exceeds Max Bid Value.';
    end if;

    update players
    set is_sold = true
    where id = v_state.current_player_id;

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
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

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
    v_new_wallet numeric;
begin
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

    select *
    into v_sale
    from sold_players
    where id = p_sold_player_id
    for update;

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
    where id = p_new_team_id
    returning wallet_balance into v_new_wallet;

    if v_new_wallet is null then
        raise exception 'Destination team not found.';
    end if;

    if v_new_wallet < 0 then
        raise exception 'Destination team wallet cannot be negative.';
    end if;

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
    v_new_wallet numeric;
begin
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

    if p_new_price < 0 then
        raise exception 'Sale price cannot be negative.';
    end if;

    select *
    into v_sale
    from sold_players
    where id = p_sold_player_id
    for update;

    if not found then
        raise exception 'Sale record not found.';
    end if;

    v_diff := p_new_price - v_sale.sold_price;

    update teams
    set wallet_balance = wallet_balance - v_diff
    where id = v_sale.team_id
    returning wallet_balance into v_new_wallet;

    if v_new_wallet is null then
        raise exception 'Team not found.';
    end if;

    if v_new_wallet < 0 then
        raise exception 'Team wallet cannot be negative.';
    end if;

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
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

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
    if not public.is_admin() then
        raise exception 'Admin access required.';
    end if;

    delete from sold_players;
    delete from auction_state;
    delete from players;
    delete from teams;
    return true;
end;
$$;

revoke all on function public.place_bid(uuid) from public;
revoke all on function public.sell_player() from public;
revoke all on function public.mark_unsold() from public;
revoke all on function public.transfer_player(uuid, uuid) from public;
revoke all on function public.update_sale_price(uuid, numeric) from public;
revoke all on function public.remove_sale(uuid) from public;
revoke all on function public.reset_auction() from public;

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
