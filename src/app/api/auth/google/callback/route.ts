import { NextRequest, NextResponse } from 'next/server'
import { exchangeOAuthCode, GOOGLE_PKCE_VERIFIER_COOKIE, setSessionCookies } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'
import { resolvePostAuthPath, sanitizeNextPath } from '@/lib/navigation'
import { buildAbsoluteUrl } from '@/lib/server/request'

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code')
    const next = sanitizeNextPath(req.nextUrl.searchParams.get('next'), '/plans')
    const providerError = req.nextUrl.searchParams.get('error_description') ?? req.nextUrl.searchParams.get('error')
    if (providerError) {
        const loginUrl = buildAbsoluteUrl(req, '/login')
        loginUrl.searchParams.set('error', providerError)
        loginUrl.searchParams.set('next', next)
        const response = NextResponse.redirect(loginUrl)
        response.cookies.set(GOOGLE_PKCE_VERIFIER_COOKIE, '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0,
        })
        return response
    }

    if (!code) {
        const loginUrl = buildAbsoluteUrl(req, '/login')
        loginUrl.searchParams.set('error', 'Google sign-in did not return an auth code. Please try again.')
        loginUrl.searchParams.set('next', next)
        const response = NextResponse.redirect(loginUrl)
        response.cookies.set(GOOGLE_PKCE_VERIFIER_COOKIE, '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0,
        })
        return response
    }

    const codeVerifier = req.cookies.get(GOOGLE_PKCE_VERIFIER_COOKIE)?.value ?? ''
    if (!codeVerifier) {
        const loginUrl = buildAbsoluteUrl(req, '/login')
        loginUrl.searchParams.set('error', 'Google sign-in expired. Please try again.')
        loginUrl.searchParams.set('next', next)
        return NextResponse.redirect(loginUrl)
    }

    let result
    try {
        result = await exchangeOAuthCode(code, codeVerifier)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to complete Google sign-in.'
        logger.warn('Google OAuth callback failed', { message })
        const loginUrl = buildAbsoluteUrl(req, '/login')
        loginUrl.searchParams.set('error', message)
        loginUrl.searchParams.set('next', next)
        const response = NextResponse.redirect(loginUrl)
        response.cookies.set(GOOGLE_PKCE_VERIFIER_COOKIE, '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0,
        })
        return response
    }

    const redirectTarget = buildAbsoluteUrl(req, resolvePostAuthPath(next, result.isAdmin))
    const response = NextResponse.redirect(redirectTarget)
    setSessionCookies(response, result.session.access_token, result.session.refresh_token)
    response.cookies.set(GOOGLE_PKCE_VERIFIER_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
    })
    logger.info('Google OAuth login succeeded', { userId: result.user.id, isAdmin: result.isAdmin })
    return response
}
