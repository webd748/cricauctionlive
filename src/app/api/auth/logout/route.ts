import { NextResponse } from 'next/server'
import { clearSessionCookies, revokeAccessSession } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'
import type { NextRequest } from 'next/server'
import { getAccessTokenFromRequest } from '@/lib/server/auth'
import { hasValidSameOrigin } from '@/lib/server/csrf'

export async function POST(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    const accessToken = getAccessTokenFromRequest(req)
    if (accessToken) {
        await revokeAccessSession(accessToken)
    }
    const response = NextResponse.json({ data: { ok: true } })
    clearSessionCookies(response)
    logger.info('Logout completed')
    return response
}
