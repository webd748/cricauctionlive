import { NextRequest, NextResponse } from 'next/server'
import { applyRefreshedSessionCookies, requireAdminAccess } from '@/lib/server/modules/authModule'
import { resetAuction, saveSettings, type SettingsPayload } from '@/lib/server/modules/settingsManagement'
import { logger } from '@/lib/logger'

type SettingsActionBody =
    | { action: 'save'; payload: SettingsPayload }
    | { action: 'reset' }

function authStatus(errorMessage: string): number {
    if (errorMessage === 'Not authenticated.' || errorMessage === 'Invalid session.') {
        return 401
    }
    if (errorMessage === 'Admin access required.') {
        return 403
    }
    return 400
}

export async function POST(req: NextRequest) {
    let auth
    try {
        auth = await requireAdminAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Settings API auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const body = (await req.json().catch(() => null)) as SettingsActionBody | null
    if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

    try {
        if (body.action === 'reset') {
            const data = await resetAuction(auth.client)
            logger.warn('Auction reset invoked', { userId: auth.user.id })
            const response = NextResponse.json({ data })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        const data = await saveSettings(auth.client, body.payload)
        logger.info('Auction settings saved', { userId: auth.user.id, settingsId: data.id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Settings request failed.'
        logger.error('Settings request failed', { message, userId: auth.user.id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
