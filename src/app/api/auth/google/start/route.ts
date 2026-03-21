import { NextRequest, NextResponse } from 'next/server'
import { getGoogleOAuthUrl } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
    const next = req.nextUrl.searchParams.get('next') || '/plans'
    const callback = new URL('/api/auth/google/callback', req.url)
    callback.searchParams.set('next', next)

    try {
        const url = await getGoogleOAuthUrl(callback.toString())
        return NextResponse.redirect(url)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start Google sign-in.'
        logger.warn('Google OAuth start failed', { message })
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('error', message)
        loginUrl.searchParams.set('next', next)
        return NextResponse.redirect(loginUrl)
    }
}
