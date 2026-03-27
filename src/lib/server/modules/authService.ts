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
export const GOOGLE_PKCE_VERIFIER_COOKIE = 'sb-google-pkce-verifier'

type AuthFlowType = 'implicit' | 'pkce'
type AuthStorage = {
    getItem: (key: string) => string | null | Promise<string | null>
    setItem: (key: string, value: string) => void | Promise<void>
    removeItem: (key: string) => void | Promise<void>
}

function getAuthClient(options?: { flowType?: AuthFlowType; storage?: AuthStorage }) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase environment variables are missing.')
    }

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            flowType: options?.flowType ?? 'implicit',
            storage: options?.storage,
        },
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

export async function getGoogleOAuthUrl(redirectTo: string): Promise<{ url: string; codeVerifier: string }> {
    const store = new Map<string, string>()
    const storage: AuthStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => {
            store.set(key, value)
        },
        removeItem: (key) => {
            store.delete(key)
        },
    }

    const client = getAuthClient({ flowType: 'pkce', storage })
    const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
    })
    if (error || !data.url) {
        throw new Error(error?.message ?? 'Unable to start Google sign-in.')
    }

    const verifierEntry = Array.from(store.entries()).find(([key]) => key.endsWith('-code-verifier'))
    const codeVerifier = verifierEntry?.[1] ?? ''
    if (!codeVerifier) {
        throw new Error('Unable to initialize Google sign-in verifier.')
    }

    return { url: data.url, codeVerifier }
}

export async function exchangeOAuthCode(code: string, codeVerifier: string) {
    if (!codeVerifier) {
        throw new Error('Missing OAuth verifier.')
    }

    const storage: AuthStorage = {
        getItem: (key) => (key.endsWith('-code-verifier') ? codeVerifier : null),
        setItem: () => undefined,
        removeItem: () => undefined,
    }

    const client = getAuthClient({ flowType: 'pkce', storage })
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

export async function revokeAccessSession(accessToken: string): Promise<void> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !accessToken) {
        return
    }

    try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${accessToken}`,
            },
        })
    } catch {
        // Ignore logout revocation failures and clear local cookies regardless.
    }
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
