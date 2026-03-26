import { NextRequest, NextResponse } from 'next/server'
import { exchangeOAuthCode, setSessionCookies } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'
import { resolvePostAuthPath, sanitizeNextPath } from '@/lib/navigation'
import { buildAbsoluteUrl } from '@/lib/server/request'

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code')
    const next = sanitizeNextPath(req.nextUrl.searchParams.get('next'), '/plans')
    if (!code) {
        const loginUrl = buildAbsoluteUrl(req, '/login')
        loginUrl.searchParams.set('error', 'Missing Google auth code.')
        loginUrl.searchParams.set('next', next)
        return NextResponse.redirect(loginUrl)
    }

    let result
    try {
        result = await exchangeOAuthCode(code)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to complete Google sign-in.'
        logger.warn('Google OAuth callback failed', { message })
        const loginUrl = buildAbsoluteUrl(req, '/login')
        loginUrl.searchParams.set('error', message)
        loginUrl.searchParams.set('next', next)
        return NextResponse.redirect(loginUrl)
    }

    const redirectTarget = buildAbsoluteUrl(req, resolvePostAuthPath(next, result.isAdmin))
    const response = NextResponse.redirect(redirectTarget)
    setSessionCookies(response, result.session.access_token, result.session.refresh_token)
    logger.info('Google OAuth login succeeded', { userId: result.user.id, isAdmin: result.isAdmin })
    return response
}
