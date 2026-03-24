import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhotoUrl } from '@/lib/photoUrl'

export type PlayerInsert = {
    name: string
    role: string
    place?: string | null
    photo_url?: string | null
}

const ROLE_MAP: Record<string, string> = {
    batsman: 'Batsman',
    bowler: 'Bowler',
    'all-rounder': 'All-Rounder',
    allrounder: 'All-Rounder',
    'all_rounder': 'All-Rounder',
    'wicket-keeper': 'Wicket-Keeper',
    wicketkeeper: 'Wicket-Keeper',
    'wicket_keeper': 'Wicket-Keeper',
}

function normalizeRole(role: string): string | null {
    const key = role.trim().toLowerCase().replace(/\s+/g, '-')
    return ROLE_MAP[key] ?? null
}

export async function createPlayers(client: SupabaseClient, players: PlayerInsert[]) {
    if (!Array.isArray(players) || players.length === 0) {
        throw new Error('At least one player is required.')
    }
    if (players.length > 500) {
        throw new Error('You can import at most 500 players at a time.')
    }

    const cleaned = players
        .map((player) => {
            const name = String(player.name ?? '').trim()
            const role = normalizeRole(String(player.role ?? ''))
            const placeValue = player.place ? String(player.place).trim() : null
            const place = placeValue && placeValue.length > 120 ? placeValue.slice(0, 120) : placeValue
            const photoUrl = normalizePhotoUrl(player.photo_url)

            if (!name || name.length > 120 || !role) {
                return null
            }
            if (photoUrl && photoUrl.length > 2048) {
                return null
            }

            return {
                name,
                role,
                place,
                photo_url: photoUrl,
            }
        })
        .filter((player): player is { name: string; role: string; place: string | null; photo_url: string | null } => player !== null)

    if (cleaned.length === 0) {
        throw new Error('No valid players in payload. Check name, role, and optional photo URL values.')
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
