export type Role = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'

export type BidTier = {
    from: number
    to: number
    increment: number
}

export type AuctionState = {
    id: string
    current_player_id: string | null
    current_bid: number
    current_team_id: string | null
    is_live: boolean
}

export type AuctionSettings = {
    id: string
    auction_name: string
    num_teams: number
    min_squad_size: number
    wallet_per_team: number
    base_price: number
    is_active: boolean
    bid_tiers: BidTier[]
}

export type Player = {
    id: string
    name: string
    role: Role
    place: string | null
    photo_url: string | null
    is_sold: boolean
    created_at: string
}

export type Team = {
    id: string
    name: string
    acronym: string
    logo_url: string | null
    wallet_balance: number
    created_at?: string
}

export type SoldPlayer = {
    id: string
    player_id: string
    sold_price: number
    sold_at: string
    team_id: string
}
