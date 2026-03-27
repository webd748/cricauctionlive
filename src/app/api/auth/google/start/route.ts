import { NextRequest, NextResponse } from 'next/server'
import { getGoogleOAuthUrl, GOOGLE_PKCE_VERIFIER_COOKIE } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'
import { sanitizeNextPath } from '@/lib/navigation'
import { buildAbsoluteUrl } from '@/lib/server/request'

export async function GET(req: NextRequest) {
    const next = sanitizeNextPath(req.nextUrl.searchParams.get('next'), '/plans')
    const callback = buildAbsoluteUrl(req, '/api/auth/google/callback')
    callback.searchParams.set('next', next)

    try {
        const oauth = await getGoogleOAuthUrl(callback.toString())
        const response = NextResponse.redirect(oauth.url)
        response.cookies.set(GOOGLE_PKCE_VERIFIER_COOKIE, oauth.codeVerifier, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 15,
        })
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start Google sign-in.'
        logger.warn('Google OAuth start failed', { message })
        const loginUrl = buildAbsoluteUrl(req, '/login')
        loginUrl.searchParams.set('error', message)
        loginUrl.searchParams.set('next', next)
        return NextResponse.redirect(loginUrl)
    }
}
