begin;

create index if not exists auction_state_current_player_idx
    on auction_state (current_player_id);

create index if not exists players_created_at_idx
    on players (created_at);

create index if not exists players_role_idx
    on players (role);

create index if not exists teams_wallet_balance_idx
    on teams (wallet_balance desc);

create index if not exists sold_players_player_team_idx
    on sold_players (player_id, team_id);

create or replace function public.team_player_counts()
returns table(team_id uuid, player_count bigint)
language sql
stable
as $$
    select sp.team_id, count(*)::bigint as player_count
    from sold_players sp
    where sp.team_id is not null
    group by sp.team_id;
$$;

commit;
