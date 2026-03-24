import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireActiveSubscriptionAccess,
} from '@/lib/server/modules/authModule'
import { resetAuction, saveSettings, type SettingsPayload } from '@/lib/server/modules/settingsManagement'
import { logger } from '@/lib/logger'
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { getServiceRoleClient } from '@/lib/server/serviceSupabase'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'
import { checkReadRateLimit } from '@/lib/server/readThrottle'

type SettingsActionBody =
    | { action: 'save'; payload: SettingsPayload }
    | { action: 'reset' }

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
        logger.warn('Settings GET auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    if (!(await checkReadRateLimit(req, 'settings:get', auth.user.id, 120, 60 * 1000))) {
        return errorJson('Too many requests. Please try again shortly.', 429)
    }

    try {
        const { data, error } = await auth.client
            .from('auction_settings')
            .select('*')
            .limit(1)
            .maybeSingle()
        if (error) {
            throw new Error(error.message)
        }

        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const publicMessage = safePublicErrorMessage(error, 'Failed to load settings.')
        logger.error('Settings GET failed', {
            message: error instanceof Error ? error.message : String(error),
            userId: auth.user.id,
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
        logger.warn('Settings API auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const body = (await req.json().catch(() => null)) as SettingsActionBody | null
    if (!body) return errorJson('Invalid request body.', 400)

    try {
        const serviceClient = getServiceRoleClient()
        if (body.action === 'reset') {
            const data = await resetAuction(serviceClient)
            logger.warn('Auction reset invoked', { userId: auth.user.id })
            const response = NextResponse.json({ data })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        const data = await saveSettings(serviceClient, body.payload)
        logger.info('Auction settings saved', { userId: auth.user.id, settingsId: data.id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Settings request failed.'
        logger.error('Settings request failed', { message, userId: auth.user.id })
        const status = operationStatus(message)
        const fallback = status === 500 ? 'Server is not fully configured.' : 'Failed to save settings.'
        return errorJson(safePublicErrorMessage(error, fallback), status)
    }
}
