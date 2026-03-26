import { NextRequest, NextResponse } from 'next/server'
import {
    createScopedServerClient,
    getAccessTokenFromRequest,
    getRefreshTokenFromRequest,
    getAuthenticatedUser,
    isAdminUser,
    refreshSessionWithToken,
} from '@/lib/server/auth'
import { setSessionCookies } from '@/lib/server/modules/authService'
import { assertSecurityBaseline } from '@/lib/server/startupSecurity'
import { hasActiveSubscription } from '@/lib/server/modules/subscriptionAccess'
import { buildAbsoluteUrl } from '@/lib/server/request'

const AUTH_REQUIRED_PREFIXES = ['/dashboard', '/auction', '/plans', '/payment']
const ADMIN_ONLY_PREFIXES = ['/dashboard/admin', '/dashboard/settings', '/auction']
const SUBSCRIPTION_REQUIRED_PREFIXES = [
    '/auction',
    '/dashboard/live',
    '/dashboard/teams',
    '/dashboard/players',
    '/dashboard/settings',
    '/dashboard/admin',
]
const SUBSCRIPTION_EXEMPT_PATHS = ['/dashboard/admin/payments']

function isProtectedPath(pathname: string): boolean {
    return AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isAdminPath(pathname: string): boolean {
    return ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isSubscriptionRequiredPath(pathname: string): boolean {
    if (SUBSCRIPTION_EXEMPT_PATHS.some((path) => pathname.startsWith(path))) {
        return false
    }
    return SUBSCRIPTION_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

type SessionResolution = {
    ok: boolean
    isAdmin: boolean
    accessToken: string | null
    refreshedSession?: {
        accessToken: string
        refreshToken: string
    }
}

async function resolveSession(req: NextRequest): Promise<SessionResolution> {
    const accessToken = getAccessTokenFromRequest(req)
    const refreshToken = getRefreshTokenFromRequest(req)

    if (accessToken) {
        const user = await getAuthenticatedUser(accessToken)
        if (user) {
            return {
                ok: true,
                isAdmin: isAdminUser(user),
                accessToken,
            }
        }
    }

    if (!refreshToken) {
        return { ok: false, isAdmin: false, accessToken: null }
    }

    const refreshed = await refreshSessionWithToken(refreshToken)
    if (!refreshed) {
        return { ok: false, isAdmin: false, accessToken: null }
    }

    return {
        ok: true,
        isAdmin: isAdminUser(refreshed.user),
        accessToken: refreshed.accessToken,
        refreshedSession: {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
        },
    }
}

async function resolveBilling(
    accessToken: string,
): Promise<{ ok: boolean; status: string | null; expiresAt: string | null }> {
    try {
        const client = createScopedServerClient(accessToken)
        const { data, error } = await client
            .from('billing_subscriptions')
            .select('status,expires_at')
            .limit(1)
            .maybeSingle()
        if (error) {
            return { ok: false, status: null, expiresAt: null }
        }

        return {
            ok: true,
            status: (data?.status as string | null) ?? null,
            expiresAt: data?.expires_at ?? null,
        }
    } catch {
        return { ok: false, status: null, expiresAt: null }
    }
}

function redirectToLogin(req: NextRequest, pathname: string) {
    const loginUrl = buildAbsoluteUrl(req, '/login')
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
}

function redirectToStep(req: NextRequest, pathname: string, destination: '/plans' | '/payment') {
    const url = buildAbsoluteUrl(req, destination)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
}

function withRefreshedCookies(response: NextResponse, session: SessionResolution) {
    if (!session.refreshedSession) return response
    setSessionCookies(response, session.refreshedSession.accessToken, session.refreshedSession.refreshToken)
    return response
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl
    if (!isProtectedPath(pathname)) {
        return NextResponse.next()
    }

    try {
        await assertSecurityBaseline()
    } catch {
        return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 })
    }

    const accessToken = getAccessTokenFromRequest(req)
    const refreshToken = getRefreshTokenFromRequest(req)
    if (!accessToken && !refreshToken) {
        return redirectToLogin(req, pathname)
    }

    const session = await resolveSession(req)
    if (!session.ok) {
        return redirectToLogin(req, pathname)
    }

    if (isAdminPath(pathname)) {
        if (!session.isAdmin) {
            return withRefreshedCookies(NextResponse.redirect(buildAbsoluteUrl(req, '/unauthorized')), session)
        }
    }

    if (isSubscriptionRequiredPath(pathname)) {
        const billing = await resolveBilling(session.accessToken!)
        if (!billing.ok) {
            return withRefreshedCookies(redirectToStep(req, pathname, '/plans'), session)
        }

        if (hasActiveSubscription(billing.status, billing.expiresAt)) {
            return withRefreshedCookies(NextResponse.next(), session)
        }

        if (
            billing.status === 'pending_payment' ||
            billing.status === 'pending_review' ||
            billing.status === 'rejected'
        ) {
            return withRefreshedCookies(redirectToStep(req, pathname, '/payment'), session)
        }

        return withRefreshedCookies(redirectToStep(req, pathname, '/plans'), session)
    }

    return withRefreshedCookies(NextResponse.next(), session)
}

export const config = {
    matcher: ['/dashboard/:path*', '/auction/:path*', '/plans', '/payment'],
}
