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

export async function saveSettings(client: SupabaseClient, payload: SettingsPayload) {
    const savePayload = {
        auction_name: payload.auction_name,
        num_teams: payload.num_teams,
        min_squad_size: payload.min_squad_size,
        wallet_per_team: payload.wallet_per_team,
        base_price: payload.base_price,
        is_active: payload.is_active,
        bid_tiers: payload.bid_tiers,
    }

    if (payload.existingId) {
        const { data, error } = await client
            .from('auction_settings')
            .update(savePayload)
            .eq('id', payload.existingId)
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
