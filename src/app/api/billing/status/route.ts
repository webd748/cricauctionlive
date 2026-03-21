import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAuthenticatedAccess,
} from '@/lib/server/modules/authModule'
import { getBillingState } from '@/lib/server/modules/billingManagement'
import { logger } from '@/lib/logger'

function authStatus(errorMessage: string): number {
    if (errorMessage === 'Not authenticated.' || errorMessage === 'Invalid session.') {
        return 401
    }
    return 400
}

export async function GET(req: NextRequest) {
    let auth
    try {
        auth = await requireAuthenticatedAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing status auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    try {
        const data = await getBillingState(auth.client)
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load billing state.'
        logger.error('Billing status fetch failed', { message, userId: auth.user.id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
