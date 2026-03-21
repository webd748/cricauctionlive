import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
    getAuthenticatedUser,
    getAccessTokenFromRequest,
    getRefreshTokenFromRequest,
    isAdminUser,
    refreshSessionWithToken,
} from '@/lib/server/auth'
import type { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getAuthClient() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase environment variables are missing.')
    }

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}

export async function loginWithPassword(email: string, password: string) {
    const client = getAuthClient()
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session || !data.user) {
        throw new Error(error?.message ?? 'Invalid credentials.')
    }

    return {
        user: data.user,
        session: data.session,
        isAdmin: isAdminUser(data.user),
    }
}

export async function registerWithPassword(email: string, password: string) {
    const client = getAuthClient()
    const { data, error } = await client.auth.signUp({ email, password })
    if (error || !data.user) {
        throw new Error(error?.message ?? 'Unable to create account.')
    }

    return {
        user: data.user,
        session: data.session,
        isAdmin: isAdminUser(data.user),
        requiresEmailVerification: !data.session,
    }
}

export async function getGoogleOAuthUrl(redirectTo: string) {
    const client = getAuthClient()
    const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
    })
    if (error || !data.url) {
        throw new Error(error?.message ?? 'Unable to start Google sign-in.')
    }
    return data.url
}

export async function exchangeOAuthCode(code: string) {
    const client = getAuthClient()
    const { data, error } = await client.auth.exchangeCodeForSession(code)
    if (error || !data.session || !data.user) {
        throw new Error(error?.message ?? 'Unable to complete Google sign-in.')
    }
    return {
        user: data.user,
        session: data.session,
        isAdmin: isAdminUser(data.user),
    }
}

export function setSessionCookies(response: NextResponse, accessToken: string, refreshToken: string) {
    const secure = process.env.NODE_ENV === 'production'
    response.cookies.set('sb-access-token', accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 60 * 60,
    })
    response.cookies.set('sb-refresh-token', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    })
}

export function clearSessionCookies(response: NextResponse) {
    const secure = process.env.NODE_ENV === 'production'
    response.cookies.set('sb-access-token', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 0,
    })
    response.cookies.set('sb-refresh-token', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 0,
    })
}

export async function resolveSession(req: NextRequest) {
    const accessToken = getAccessTokenFromRequest(req)
    const refreshToken = getRefreshTokenFromRequest(req)

    if (accessToken) {
        const user = await getAuthenticatedUser(accessToken)
        if (user) {
            return {
                user,
                isAdmin: isAdminUser(user),
            }
        }
    }

    if (!refreshToken) {
        throw new Error(accessToken ? 'Invalid session.' : 'Not authenticated.')
    }

    const refreshed = await refreshSessionWithToken(refreshToken)
    if (!refreshed) {
        throw new Error('Invalid session.')
    }

    return {
        user: refreshed.user,
        isAdmin: isAdminUser(refreshed.user),
        refreshedSession: {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
        },
    }
}
