import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { executeAuctionAction, type AuctionAction } from '@/lib/server/modules/auctionEngine'
import {
    applyRefreshedSessionCookies,
    requireActiveSubscriptionAccess,
} from '@/lib/server/modules/authModule'
import { logger } from '@/lib/logger'
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { getServiceRoleClient } from '@/lib/server/serviceSupabase'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'
import { checkReadRateLimit } from '@/lib/server/readThrottle'

type AuctionBody = {
    action?: AuctionAction
    payload?: Record<string, unknown>
}

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
        logger.warn('Auction GET auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    if (!(await checkReadRateLimit(req, 'auction:get', auth.user.id, 240, 60 * 1000))) {
        return errorJson('Too many requests. Please try again shortly.', 429)
    }

    const view = req.nextUrl.searchParams.get('view') ?? 'live'
    const soldLimitRaw = Number(req.nextUrl.searchParams.get('soldLimit') ?? (view === 'admin' ? '200' : '30'))
    const soldLimit = Number.isFinite(soldLimitRaw) ? Math.min(Math.max(1, soldLimitRaw), 500) : 30

    try {
        const [{ data: state, error: stateError }, { data: settings, error: settingsError }] = await Promise.all([
            auth.client.from('auction_state').select('id,current_player_id,current_team_id,current_bid,is_live').limit(1).maybeSingle(),
            auth.client.from('auction_settings').select('id,auction_name,budget_per_team,min_squad_size,max_squad_size,is_active').limit(1).maybeSingle(),
        ])
        if (stateError) throw new Error(stateError.message)
        if (settingsError) throw new Error(settingsError.message)

        const [
            { data: teams, error: teamsError },
            { data: soldRows, error: soldError },
            { data: soldCountRows, error: soldCountError },
        ] = await Promise.all([
            auth.client
                .from('teams')
                .select('id,name,acronym,logo_url,wallet_balance')
                .order('name', { ascending: true }),
            auth.client
                .from('sold_players')
                .select('id,player_id,sold_price,sold_at,team_id,players(name,role),teams(name,acronym)')
                .order('sold_at', { ascending: false })
                .limit(soldLimit),
            auth.client.rpc('team_player_counts'),
        ])
        if (teamsError) throw new Error(teamsError.message)
        if (soldError) throw new Error(soldError.message)
        if (soldCountError) throw new Error(soldCountError.message)

        const teamCountMap = new Map<string, number>()
        for (const row of soldCountRows ?? []) {
            const record = row as { team_id?: string | null; player_count?: number | null }
            const key = String(record.team_id ?? '')
            if (!key) continue
            teamCountMap.set(key, Number(record.player_count ?? 0))
        }

        const teamsWithCounts = (teams ?? []).map((team) => ({
            ...team,
            wallet_balance: team.wallet_balance ?? 0,
            player_count: teamCountMap.get(team.id) ?? 0,
        }))

        const currentPlayer = state?.current_player_id
            ? await auth.client
                .from('players')
                .select('id,name,role,place,photo_url,is_sold,created_at')
                .eq('id', state.current_player_id)
                .maybeSingle()
            : { data: null, error: null }
        if (currentPlayer.error) throw new Error(currentPlayer.error.message)

        const [{ count: soldCount, error: soldCountErr }, { count: availableCount, error: availableCountErr }] =
            await Promise.all([
                auth.client.from('players').select('id', { count: 'exact', head: true }).eq('is_sold', true),
                auth.client.from('players').select('id', { count: 'exact', head: true }).eq('is_sold', false),
            ])
        if (soldCountErr) throw new Error(soldCountErr.message)
        if (availableCountErr) throw new Error(availableCountErr.message)

        const stats = {
            sold: soldCount ?? 0,
            available: availableCount ?? 0,
            unsold: Math.max(0, (availableCount ?? 0) - (state?.current_player_id ? 1 : 0)),
        }

        if (view !== 'admin') {
            const payload = {
                auctionState: state ?? null,
                settings: settings ?? null,
                currentPlayer: currentPlayer.data ?? null,
                teams: teamsWithCounts,
                sold: soldRows ?? [],
                stats,
            }
            const payloadStr = JSON.stringify(payload)
            const etag = `"${crypto.createHash('md5').update(payloadStr).digest('hex')}"`

            if (req.headers.get('if-none-match') === etag) {
                const response = new NextResponse(null, { status: 304, headers: { ETag: etag } })
                applyRefreshedSessionCookies(response, auth)
                return response
            }

            const response = new NextResponse(payloadStr, {
                status: 200,
                headers: { 'Content-Type': 'application/json', ETag: etag },
            })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        const availableLimitRaw = Number(req.nextUrl.searchParams.get('availableLimit') ?? '1000')
        const availableLimit = Number.isFinite(availableLimitRaw)
            ? Math.min(Math.max(1, availableLimitRaw), 2000)
            : 1000
        const { data: availablePlayers, error: availableError } = await auth.client
            .from('players')
            .select('id,name,role,place,photo_url,is_sold,created_at')
            .eq('is_sold', false)
            .order('created_at', { ascending: true })
            .limit(availableLimit)
        if (availableError) throw new Error(availableError.message)

        const payload = {
            auctionState: state ?? null,
            settings: settings ?? null,
            currentPlayer: currentPlayer.data ?? null,
            teams: teamsWithCounts,
            sold: soldRows ?? [],
            availablePlayers: availablePlayers ?? [],
            stats,
        }
        const payloadStr = JSON.stringify(payload)
        const etag = `"${crypto.createHash('md5').update(payloadStr).digest('hex')}"`

        if (req.headers.get('if-none-match') === etag) {
            const response = new NextResponse(null, { status: 304, headers: { ETag: etag } })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        const response = new NextResponse(payloadStr, {
            status: 200,
            headers: { 'Content-Type': 'application/json', ETag: etag },
        })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const publicMessage = safePublicErrorMessage(error, 'Failed to load auction data.')
        logger.error('Auction GET failed', {
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
        logger.warn('Auction API auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const body = (await req.json().catch(() => null)) as AuctionBody | null
    const action = body?.action
    const payload = body?.payload ?? {}
    if (!action) {
        return errorJson('Action is required.', 400)
    }

    try {
        logger.info('Auction action requested', { action, userId: auth.user.id })
        const serviceClient = getServiceRoleClient()
        const data = await executeAuctionAction(serviceClient, action, payload)
        logger.info('Auction action completed', { action, userId: auth.user.id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed.'
        logger.error('Auction action failed', { action, message, userId: auth.user.id })
        const status = operationStatus(message)
        const fallback = status === 500 ? 'Server is not fully configured.' : 'Auction action failed.'
        return errorJson(safePublicErrorMessage(error, fallback), status)
    }
}
