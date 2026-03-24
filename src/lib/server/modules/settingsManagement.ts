import type { SupabaseClient } from '@supabase/supabase-js'

type BidTier = {
    from: number
    to: number
    increment: number
}

export type SettingsPayload = {
    existingId?: string | null
    auction_name: string
    num_teams: number
    min_squad_size: number
    wallet_per_team: number
    base_price: number
    is_active: boolean
    bid_tiers: BidTier[]
}

function normalizeNumber(value: unknown): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : NaN
}

function validateSettingsPayload(payload: SettingsPayload): SettingsPayload {
    const auctionName = String(payload.auction_name ?? '').trim()
    const numTeams = normalizeNumber(payload.num_teams)
    const minSquadSize = normalizeNumber(payload.min_squad_size)
    const walletPerTeam = normalizeNumber(payload.wallet_per_team)
    const basePrice = normalizeNumber(payload.base_price)
    const bidTiers = Array.isArray(payload.bid_tiers) ? payload.bid_tiers : []

    if (auctionName.length < 3) {
        throw new Error('Auction name must be at least 3 characters.')
    }
    if (!Number.isInteger(numTeams) || numTeams < 2 || numTeams > 20) {
        throw new Error('num_teams must be an integer between 2 and 20.')
    }
    if (!Number.isInteger(minSquadSize) || minSquadSize < 1 || minSquadSize > 50) {
        throw new Error('min_squad_size must be an integer between 1 and 50.')
    }
    if (walletPerTeam < 0 || basePrice < 0) {
        throw new Error('wallet_per_team and base_price cannot be negative.')
    }
    if (basePrice > walletPerTeam) {
        throw new Error('base_price cannot exceed wallet_per_team.')
    }
    if (bidTiers.length === 0) {
        throw new Error('At least one bid tier is required.')
    }

    let previousTo: number | null = null
    const normalizedTiers = bidTiers.map((tier, index) => {
        const from = normalizeNumber(tier.from)
        const to = normalizeNumber(tier.to)
        const increment = normalizeNumber(tier.increment)

        if (increment <= 0) {
            throw new Error(`Bid tier ${index + 1} increment must be greater than 0.`)
        }
        if (to <= from) {
            throw new Error(`Bid tier ${index + 1} "to" must be greater than "from".`)
        }
        if (index === 0 && from !== basePrice) {
            throw new Error('First bid tier must start at base_price.')
        }
        if (index > 0 && previousTo !== from) {
            throw new Error('Bid tiers must be contiguous.')
        }

        previousTo = to
        return { from, to, increment }
    })

    return {
        ...payload,
        auction_name: auctionName,
        num_teams: numTeams,
        min_squad_size: minSquadSize,
        wallet_per_team: walletPerTeam,
        base_price: basePrice,
        bid_tiers: normalizedTiers,
    }
}

export async function saveSettings(client: SupabaseClient, payload: SettingsPayload) {
    const validated = validateSettingsPayload(payload)
    const savePayload = {
        auction_name: validated.auction_name,
        num_teams: validated.num_teams,
        min_squad_size: validated.min_squad_size,
        wallet_per_team: validated.wallet_per_team,
        base_price: validated.base_price,
        is_active: validated.is_active,
        bid_tiers: validated.bid_tiers,
    }

    if (validated.existingId) {
        const { data, error } = await client
            .from('auction_settings')
            .update(savePayload)
            .eq('id', validated.existingId)
            .select('*')
            .single()

        if (error) {
            throw new Error(error.message)
        }

        return data
    }

    const { data: existing, error: existingError } = await client
        .from('auction_settings')
        .select('id')
        .limit(1)
        .maybeSingle()
    if (existingError) {
        throw new Error(existingError.message)
    }
    if (existing?.id) {
        const { data, error } = await client
            .from('auction_settings')
            .update(savePayload)
            .eq('id', existing.id)
            .select('*')
            .single()

        if (error) {
            throw new Error(error.message)
        }

        return data
    }

    const { data, error } = await client
        .from('auction_settings')
        .insert(savePayload)
        .select('*')
        .single()

    if (error) {
        throw new Error(error.message)
    }

    return data
}

export async function resetAuction(client: SupabaseClient) {
    const { data, error } = await client.rpc('reset_auction')
    if (error) {
        throw new Error(error.message)
    }

    return data
}
