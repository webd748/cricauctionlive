import { NextRequest, NextResponse } from 'next/server'
import { resolveSession, setSessionCookies } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
    let session
    try {
        session = await resolveSession(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid session.'
        logger.warn('Session resolve failed', { message })
        return NextResponse.json({ error: message }, { status: 401 })
    }

    logger.debug('Session resolved', { userId: session.user.id, isAdmin: session.isAdmin })
    const response = NextResponse.json({
        data: {
            user: { id: session.user.id, email: session.user.email },
            isAdmin: session.isAdmin,
        },
    })
    if (session.refreshedSession) {
        setSessionCookies(response, session.refreshedSession.accessToken, session.refreshedSession.refreshToken)
    }
    return response
}
