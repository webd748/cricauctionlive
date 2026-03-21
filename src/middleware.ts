import { NextRequest, NextResponse } from 'next/server'

const ADMIN_ROLES = (process.env.APP_ADMIN_ROLES ?? 'admin,owner')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
const ADMIN_EMAILS = (process.env.APP_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

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

type JwtPayload = {
    email?: string
    role?: string
    app_metadata?: { role?: string }
    user_metadata?: { role?: string }
}

function decodePayload(token: string): JwtPayload | null {
    const parts = token.split('.')
    if (parts.length < 2) return null
    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
        const json = atob(padded)
        return JSON.parse(json) as JwtPayload
    } catch {
        return null
    }
}

function isAdminHint(token: string): boolean {
    const payload = decodePayload(token)
    if (!payload) return false
    const role = String(payload.app_metadata?.role ?? payload.user_metadata?.role ?? payload.role ?? '').toLowerCase()
    const email = String(payload.email ?? '').toLowerCase()
    return ADMIN_ROLES.includes(role) || ADMIN_EMAILS.includes(email)
}

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

type SessionPayload = {
    data?: {
        isAdmin?: boolean
    }
}

type BillingPayload = {
    data?: {
        subscription?: {
            status?: 'pending_payment' | 'pending_review' | 'active' | 'rejected' | 'expired'
            expires_at?: string | null
        } | null
    }
}

async function resolveSessionFromApi(req: NextRequest): Promise<{ ok: boolean; isAdmin: boolean }> {
    try {
        const sessionUrl = new URL('/api/auth/session', req.url)
        const response = await fetch(sessionUrl, {
            method: 'GET',
            headers: {
                cookie: req.headers.get('cookie') ?? '',
                accept: 'application/json',
            },
            cache: 'no-store',
        })
        if (!response.ok) return { ok: false, isAdmin: false }
        const payload = (await response.json().catch(() => null)) as SessionPayload | null
        return {
            ok: true,
            isAdmin: Boolean(payload?.data?.isAdmin),
        }
    } catch {
        return { ok: false, isAdmin: false }
    }
}

async function resolveBillingFromApi(
    req: NextRequest,
): Promise<{ ok: boolean; status: string | null; expiresAt: string | null }> {
    try {
        const billingUrl = new URL('/api/billing/status', req.url)
        const response = await fetch(billingUrl, {
            method: 'GET',
            headers: {
                cookie: req.headers.get('cookie') ?? '',
                accept: 'application/json',
            },
            cache: 'no-store',
        })
        if (!response.ok) {
            return { ok: false, status: null, expiresAt: null }
        }
        const payload = (await response.json().catch(() => null)) as BillingPayload | null
        return {
            ok: true,
            status: payload?.data?.subscription?.status ?? null,
            expiresAt: payload?.data?.subscription?.expires_at ?? null,
        }
    } catch {
        return { ok: false, status: null, expiresAt: null }
    }
}

function hasActiveSubscription(status: string | null, expiresAt: string | null): boolean {
    if (status !== 'active') {
        return false
    }
    if (!expiresAt) {
        return true
    }
    const expiry = Date.parse(expiresAt)
    if (Number.isNaN(expiry)) {
        return true
    }
    return expiry > Date.now()
}

function redirectToLogin(req: NextRequest, pathname: string) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
}

function redirectToStep(req: NextRequest, pathname: string, destination: '/plans' | '/payment') {
    const url = new URL(destination, req.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl
    if (!isProtectedPath(pathname)) {
        return NextResponse.next()
    }

    const accessToken = req.cookies.get('sb-access-token')?.value
    const refreshToken = req.cookies.get('sb-refresh-token')?.value
    if (!accessToken && !refreshToken) {
        return redirectToLogin(req, pathname)
    }

    const session = await resolveSessionFromApi(req)
    if (!session.ok) {
        return redirectToLogin(req, pathname)
    }

    if (isAdminPath(pathname)) {
        const hintAllowed = accessToken ? isAdminHint(accessToken) : false
        if (!session.isAdmin && !hintAllowed) {
            return NextResponse.redirect(new URL('/unauthorized', req.url))
        }
    }

    if (isSubscriptionRequiredPath(pathname)) {
        const billing = await resolveBillingFromApi(req)
        if (!billing.ok) {
            return redirectToStep(req, pathname, '/plans')
        }

        if (hasActiveSubscription(billing.status, billing.expiresAt)) {
            return NextResponse.next()
        }

        if (
            billing.status === 'pending_payment' ||
            billing.status === 'pending_review' ||
            billing.status === 'rejected'
        ) {
            return redirectToStep(req, pathname, '/payment')
        }

        return redirectToStep(req, pathname, '/plans')
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/dashboard/:path*', '/auction/:path*', '/plans', '/payment'],
}
