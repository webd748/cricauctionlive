begin;

create extension if not exists btree_gist;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'teams_wallet_non_negative'
    ) then
        alter table teams
            add constraint teams_wallet_non_negative
            check (wallet_balance >= 0);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'sold_players_price_non_negative'
    ) then
        alter table sold_players
            add constraint sold_players_price_non_negative
            check (sold_price >= 0);
    end if;
end;
$$;

create unique index if not exists sold_players_unique_player_sale_idx
    on sold_players (player_id);

create unique index if not exists auction_state_single_live_idx
    on auction_state (is_live)
    where is_live = true;

create or replace function public.validate_auction_state()
returns trigger
language plpgsql
as $$
begin
    if new.current_bid < 0 then
        raise exception 'current_bid cannot be negative';
    end if;

    if new.current_team_id is not null and new.current_player_id is null then
        raise exception 'current_team_id cannot be set without current_player_id';
    end if;

    if new.is_live and new.current_player_id is null then
        raise exception 'is_live cannot be true without a current_player_id';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_validate_auction_state on auction_state;
create trigger trg_validate_auction_state
before insert or update on auction_state
for each row
execute function public.validate_auction_state();

create or replace function public.validate_sold_player()
returns trigger
language plpgsql
as $$
declare
    v_exists boolean;
begin
    if new.sold_price < 0 then
        raise exception 'sold_price cannot be negative';
    end if;

    select exists(
        select 1
        from sold_players
        where player_id = new.player_id
          and id <> coalesce(new.id, gen_random_uuid())
    ) into v_exists;

    if v_exists then
        raise exception 'player is already sold';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_validate_sold_player on sold_players;
create trigger trg_validate_sold_player
before insert or update on sold_players
for each row
execute function public.validate_sold_player();

create or replace function public.validate_auction_settings()
returns trigger
language plpgsql
as $$
declare
    v_tier jsonb;
    v_prev_to numeric := null;
    v_from numeric;
    v_to numeric;
    v_increment numeric;
begin
    if new.base_price < 0 or new.wallet_per_team < 0 then
        raise exception 'base_price and wallet_per_team cannot be negative';
    end if;

    if new.bid_tiers is null or jsonb_typeof(new.bid_tiers) <> 'array' or jsonb_array_length(new.bid_tiers) = 0 then
        raise exception 'bid_tiers must be a non-empty array';
    end if;

    for v_tier in select * from jsonb_array_elements(new.bid_tiers)
    loop
        v_from := coalesce((v_tier ->> 'from')::numeric, 0);
        v_to := coalesce((v_tier ->> 'to')::numeric, 0);
        v_increment := coalesce((v_tier ->> 'increment')::numeric, 0);

        if v_increment <= 0 then
            raise exception 'bid tier increment must be greater than zero';
        end if;

        if v_to <= v_from then
            raise exception 'bid tier "to" must be greater than "from"';
        end if;

        if v_prev_to is not null and v_from <> v_prev_to then
            raise exception 'bid tiers must be contiguous';
        end if;

        v_prev_to := v_to;
    end loop;

    return new;
end;
$$;

drop trigger if exists trg_validate_auction_settings on auction_settings;
create trigger trg_validate_auction_settings
before insert or update on auction_settings
for each row
execute function public.validate_auction_settings();

commit;
