import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhotoUrl } from '@/lib/photoUrl'

export type PlayerInsert = {
    name: string
    role: string
    place?: string | null
    photo_url?: string | null
}

export async function createPlayers(client: SupabaseClient, players: PlayerInsert[]) {
    if (!Array.isArray(players) || players.length === 0) {
        throw new Error('At least one player is required.')
    }

    const cleaned = players
        .map((player) => ({
            name: String(player.name ?? '').trim(),
            role: String(player.role ?? '').trim(),
            place: player.place ? String(player.place).trim() : null,
            photo_url: normalizePhotoUrl(player.photo_url),
        }))
        .filter((player) => player.name.length > 0 && player.role.length > 0)

    if (cleaned.length === 0) {
        throw new Error('No valid players in payload.')
    }

    const { data, error } = await client.from('players').insert(cleaned).select('*')
    if (error) {
        throw new Error(error.message)
    }

    return data
}

export async function deletePlayer(client: SupabaseClient, id: string) {
    if (!id) {
        throw new Error('Player id is required.')
    }

    const { error } = await client.from('players').delete().eq('id', id)
    if (error) {
        throw new Error(error.message)
    }

    return { ok: true }
}
