import type { SupabaseClient } from '@supabase/supabase-js'

export type AuctionAction =
    | 'place_bid'
    | 'sell_player'
    | 'mark_unsold'
    | 'transfer_player'
    | 'update_sale_price'
    | 'remove_sale'
    | 'reset_auction'
    | 'toggle_live'
    | 'set_current_player'
    | 'start_random_player'
    | 'end_auction'
    | 'adjust_bid'

export type AuctionPayload = Record<string, unknown>

type AuctionStateRow = {
    id: string
    current_player_id: string | null
    current_bid: number | null
    current_team_id: string | null
    is_live: boolean | null
}

type BidTier = {
    from: number
    to: number
    increment: number
}

async function ensureAuctionState(client: SupabaseClient): Promise<AuctionStateRow> {
    const { data: existing } = await client.from('auction_state').select('*').limit(1).maybeSingle()
    if (existing) {
        return existing as AuctionStateRow
    }

    const { data, error } = await client
        .from('auction_state')
        .insert({ current_player_id: null, current_bid: 0, current_team_id: null, is_live: false })
        .select('*')
        .single()

    if (error || !data) {
        throw new Error(error?.message ?? 'Failed to initialize auction state.')
    }

    return data as AuctionStateRow
}

function parseBidTiers(raw: unknown): BidTier[] {
    if (!Array.isArray(raw)) {
        return []
    }

    return raw
        .map((item) => {
            const tier = item as Partial<BidTier>
            return {
                from: Number(tier.from ?? 0),
                to: Number(tier.to ?? 0),
                increment: Number(tier.increment ?? 0),
            }
        })
        .filter((tier) => Number.isFinite(tier.from) && Number.isFinite(tier.to) && Number.isFinite(tier.increment))
}

export async function executeAuctionAction(
    client: SupabaseClient,
    action: AuctionAction,
    payload: AuctionPayload,
): Promise<unknown> {
    if (action === 'place_bid') {
        const teamId = String(payload.teamId ?? '')
        if (!teamId) throw new Error('teamId is required.')
        const { data, error } = await client.rpc('place_bid', { p_team_id: teamId })
        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'sell_player') {
        const { data, error } = await client.rpc('sell_player')
        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'mark_unsold') {
        const { data, error } = await client.rpc('mark_unsold')
        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'transfer_player') {
        const soldPlayerId = String(payload.soldPlayerId ?? '')
        const newTeamId = String(payload.newTeamId ?? '')
        if (!soldPlayerId || !newTeamId) {
            throw new Error('soldPlayerId and newTeamId are required.')
        }

        const { data, error } = await client.rpc('transfer_player', {
            p_sold_player_id: soldPlayerId,
            p_new_team_id: newTeamId,
        })

        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'update_sale_price') {
        const soldPlayerId = String(payload.soldPlayerId ?? '')
        const newPrice = Number(payload.newPrice)
        if (!soldPlayerId || !Number.isFinite(newPrice)) {
            throw new Error('soldPlayerId and newPrice are required.')
        }

        const { data, error } = await client.rpc('update_sale_price', {
            p_sold_player_id: soldPlayerId,
            p_new_price: newPrice,
        })

        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'remove_sale') {
        const soldPlayerId = String(payload.soldPlayerId ?? '')
        if (!soldPlayerId) {
            throw new Error('soldPlayerId is required.')
        }

        const { data, error } = await client.rpc('remove_sale', {
            p_sold_player_id: soldPlayerId,
        })

        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'reset_auction') {
        const { data, error } = await client.rpc('reset_auction')
        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'toggle_live') {
        const state = await ensureAuctionState(client)
        const { data, error } = await client
            .from('auction_state')
            .update({ is_live: !state.is_live })
            .eq('id', state.id)
            .select('*')
            .single()
        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'set_current_player') {
        const playerId = String(payload.playerId ?? '')
        const isLive = Boolean(payload.isLive ?? true)
        if (!playerId) throw new Error('playerId is required.')

        const { data: selectedPlayer, error: selectedPlayerError } = await client
            .from('players')
            .select('id,is_sold')
            .eq('id', playerId)
            .maybeSingle()
        if (selectedPlayerError) throw new Error(selectedPlayerError.message)
        if (!selectedPlayer) throw new Error('Selected player does not exist.')
        if (selectedPlayer.is_sold) throw new Error('Selected player is already sold.')

        const state = await ensureAuctionState(client)
        const { data: settings } = await client
            .from('auction_settings')
            .select('base_price')
            .limit(1)
            .maybeSingle()

        const startPrice = Number(settings?.base_price ?? 0)

        const { data, error } = await client
            .from('auction_state')
            .update({
                current_player_id: playerId,
                current_bid: startPrice,
                current_team_id: null,
                is_live: isLive,
            })
            .eq('id', state.id)
            .select('*')
            .single()

        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'start_random_player') {
        const state = await ensureAuctionState(client)
        const { data: players, error: playerError } = await client
            .from('players')
            .select('id')
            .eq('is_sold', false)

        if (playerError) throw new Error(playerError.message)
        if (!players || players.length === 0) {
            throw new Error('No available players.')
        }

        const randomPlayer = players[Math.floor(Math.random() * players.length)]
        const { data: settings } = await client
            .from('auction_settings')
            .select('base_price')
            .limit(1)
            .maybeSingle()
        const startPrice = Number(settings?.base_price ?? 0)

        const { data, error } = await client
            .from('auction_state')
            .update({
                current_player_id: randomPlayer.id,
                current_bid: startPrice,
                current_team_id: null,
                is_live: true,
            })
            .eq('id', state.id)
            .select('*')
            .single()

        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'end_auction') {
        const state = await ensureAuctionState(client)
        const { data, error } = await client
            .from('auction_state')
            .update({
                current_player_id: null,
                current_team_id: null,
                current_bid: 0,
                is_live: false,
            })
            .eq('id', state.id)
            .select('*')
            .single()

        if (error) throw new Error(error.message)
        return data
    }

    if (action === 'adjust_bid') {
        const direction = String(payload.direction ?? '')
        if (direction !== 'up' && direction !== 'down') {
            throw new Error('direction must be up or down.')
        }

        const state = await ensureAuctionState(client)
        if (!state.current_player_id) {
            throw new Error('No active player selected.')
        }
        if (!state.is_live) {
            throw new Error('Auction is not live.')
        }

        const { data: settings } = await client
            .from('auction_settings')
            .select('bid_tiers,base_price')
            .limit(1)
            .maybeSingle()

        const bidTiers = parseBidTiers(settings?.bid_tiers)
        const currentBid = Number(state.current_bid ?? 0)
        const floorBid = Number(settings?.base_price ?? 0)
        const tier = bidTiers.find((item) => currentBid >= item.from && currentBid < item.to) ?? bidTiers.at(-1)
        const increment = Number(tier?.increment ?? 100)
        const newBid = direction === 'up' ? currentBid + increment : Math.max(floorBid, currentBid - increment)

        const { data, error } = await client
            .from('auction_state')
            .update({ current_bid: newBid })
            .eq('id', state.id)
            .select('*')
            .single()

        if (error) throw new Error(error.message)
        return data
    }

    throw new Error('Unsupported action.')
}
