import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireActiveSubscriptionAccess,
} from '@/lib/server/modules/authModule'
import { createTeam, deleteTeam } from '@/lib/server/modules/teamManagement'
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
        logger.warn('Teams GET auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    if (!(await checkReadRateLimit(req, 'teams:get', auth.user.id, 180, 60 * 1000))) {
        return errorJson('Too many requests. Please try again shortly.', 429)
    }

    const view = req.nextUrl.searchParams.get('view') ?? 'setup'
    const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? '200')
    const requestedOffset = Number(req.nextUrl.searchParams.get('offset') ?? '0')
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(1, requestedLimit), 500) : 200
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0

    try {
        const { data: teams, error: teamsError } = await auth.client
            .from('teams')
            .select('id,name,acronym,logo_url,wallet_balance,created_at')
            .range(offset, offset + limit - 1)
            .order(view === 'dashboard' ? 'name' : 'created_at', { ascending: true })
        if (teamsError) throw new Error(teamsError.message)

        if (view !== 'dashboard') {
            const response = NextResponse.json({ data: { teams: teams ?? [] } })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        const soldLimitRaw = Number(req.nextUrl.searchParams.get('soldLimit') ?? '500')
        const soldLimit = Number.isFinite(soldLimitRaw) ? Math.min(Math.max(1, soldLimitRaw), 2000) : 500
        const [{ data: soldPlayers, error: soldError }, { data: settings, error: settingsError }] =
            await Promise.all([
                auth.client
                    .from('sold_players')
                    .select('id,player_id,sold_price,team_id,players(id,name,role,photo_url)')
                    .limit(soldLimit),
                auth.client
                    .from('auction_settings')
                    .select('min_squad_size,base_price')
                    .limit(1)
                    .maybeSingle(),
            ])
        if (soldError) throw new Error(soldError.message)
        if (settingsError) throw new Error(settingsError.message)

        const response = NextResponse.json({
            data: {
                teams: teams ?? [],
                soldPlayers: soldPlayers ?? [],
                settings: settings ?? null,
            },
        })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const publicMessage = safePublicErrorMessage(error, 'Failed to load teams.')
        logger.error('Teams GET failed', {
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
        logger.warn('Teams API auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const formData = await req.formData()
    const name = String(formData.get('name') ?? '')
    const acronym = String(formData.get('acronym') ?? '')
    const logoValue = formData.get('logo')
    const logo = logoValue instanceof File ? logoValue : null

    if (auth.subscription?.maxTeams) {
        const { count, error: countError } = await auth.client
            .from('teams')
            .select('*', { count: 'exact', head: true })

        if (!countError && count !== null && count >= auth.subscription.maxTeams) {
            return errorJson(`Plan limit reached. You can only create up to ${auth.subscription.maxTeams} teams.`, 403)
        }
    }

    try {
        const serviceClient = getServiceRoleClient()
        const data = await createTeam(serviceClient, { name, acronym, logo })
        logger.info('Team created', { userId: auth.user.id, teamId: data.id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create team.'
        logger.error('Team create failed', { message, userId: auth.user.id })
        const status = operationStatus(message)
        const fallback = status === 500 ? 'Server is not fully configured.' : 'Failed to create team.'
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
        logger.warn('Teams API auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const id = req.nextUrl.searchParams.get('id')
    try {
        const serviceClient = getServiceRoleClient()
        const data = await deleteTeam(serviceClient, id ?? '')
        logger.info('Team deleted', { userId: auth.user.id, teamId: id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete team.'
        logger.error('Team delete failed', { message, userId: auth.user.id, teamId: id })
        const status = operationStatus(message)
        const fallback = status === 500 ? 'Server is not fully configured.' : 'Failed to delete team.'
        return errorJson(safePublicErrorMessage(error, fallback), status)
    }
}
