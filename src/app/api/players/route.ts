import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireActiveSubscriptionAccess,
} from '@/lib/server/modules/authModule'
import { createPlayers, deletePlayer, type PlayerInsert } from '@/lib/server/modules/playerManagement'
import { logger } from '@/lib/logger'
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { getServiceRoleClient } from '@/lib/server/serviceSupabase'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'
import { checkReadRateLimit } from '@/lib/server/readThrottle'

function operationStatus(errorMessage: string): number {
    if (errorMessage === 'Server Supabase service role is not configured.') {
        return 500
    }
    return 400
}

export async function GET(req: NextRequest) {
    let auth
    try {
        auth = await requireActiveSubscriptionAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Players GET auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    if (!(await checkReadRateLimit(req, 'players:get', auth.user.id, 180, 60 * 1000))) {
        return errorJson('Too many requests. Please try again shortly.', 429)
    }

    const view = req.nextUrl.searchParams.get('view') ?? 'setup'
    const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? '300')
    const requestedOffset = Number(req.nextUrl.searchParams.get('offset') ?? '0')
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(1, requestedLimit), 1000) : 300
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0
    const ascending = view === 'dashboard'

    try {
        const { data: players, error: playersError } = await auth.client
            .from('players')
            .select('id,name,role,place,photo_url,is_sold,created_at')
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending })
        if (playersError) throw new Error(playersError.message)

        if (view !== 'dashboard') {
            const response = NextResponse.json({ data: { players: players ?? [] } })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        const { data: soldRows, error: soldError } = await auth.client
            .from('sold_players')
            .select('player_id,sold_price,teams(name,acronym,logo_url)')
        if (soldError) throw new Error(soldError.message)

        const response = NextResponse.json({
            data: {
                players: players ?? [],
                sold: soldRows ?? [],
            },
        })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const publicMessage = safePublicErrorMessage(error, 'Failed to load players.')
        logger.error('Players GET failed', {
            message: error instanceof Error ? error.message : String(error),
            userId: auth.user.id,
            view,
        })
        return errorJson(publicMessage, 400)
    }
}

export async function POST(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return errorJson('Invalid request origin.', 403)
    }

    let auth
    try {
        auth = await requireActiveSubscriptionAccess(req, { admin: true })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Players API auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const body = (await req.json().catch(() => null)) as { players?: PlayerInsert[] } | null
    try {
        const serviceClient = getServiceRoleClient()
        const data = await createPlayers(serviceClient, body?.players ?? [])
        logger.info('Players created', { userId: auth.user.id, count: data.length })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create players.'
        logger.error('Players create failed', { message, userId: auth.user.id })
        const status = operationStatus(message)
        const fallback = status === 500 ? 'Server is not fully configured.' : 'Failed to create players.'
        return errorJson(safePublicErrorMessage(error, fallback), status)
    }
}

export async function DELETE(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return errorJson('Invalid request origin.', 403)
    }

    let auth
    try {
        auth = await requireActiveSubscriptionAccess(req, { admin: true })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Players API auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const id = req.nextUrl.searchParams.get('id')
    try {
        const serviceClient = getServiceRoleClient()
        const data = await deletePlayer(serviceClient, id ?? '')
        logger.info('Player deleted', { userId: auth.user.id, playerId: id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete player.'
        logger.error('Players delete failed', { message, userId: auth.user.id, playerId: id })
        const status = operationStatus(message)
        const fallback = status === 500 ? 'Server is not fully configured.' : 'Failed to delete player.'
        return errorJson(safePublicErrorMessage(error, fallback), status)
    }
}
