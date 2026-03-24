import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAuthenticatedAccess,
} from '@/lib/server/modules/authModule'
import { getBillingState } from '@/lib/server/modules/billingManagement'
import { logger } from '@/lib/logger'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'
import { checkReadRateLimit } from '@/lib/server/readThrottle'

export async function GET(req: NextRequest) {
    let auth
    try {
        auth = await requireAuthenticatedAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing status auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    if (!(await checkReadRateLimit(req, 'billing:status', auth.user.id, 120, 60 * 1000))) {
        return errorJson('Too many requests. Please try again shortly.', 429)
    }

    try {
        const data = await getBillingState(auth.client)
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        logger.error('Billing status fetch failed', {
            message: error instanceof Error ? error.message : String(error),
            userId: auth.user.id,
        })
        return errorJson(safePublicErrorMessage(error, 'Failed to load billing state.'), 400)
    }
}
