import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ADMIN_ROLES = (process.env.APP_ADMIN_ROLES ?? 'admin,owner')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
const ADMIN_EMAILS = (process.env.APP_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

function assertSupabaseEnv() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase environment variables are missing.')
    }
}

export function getAccessTokenFromRequest(req?: NextRequest): string | null {
    const header = req?.headers.get('authorization')
    if (header?.startsWith('Bearer ')) {
        return header.slice(7)
    }

    if (req) {
        return req.cookies.get('sb-access-token')?.value ?? null
    }

    return null
}

export function getRefreshTokenFromRequest(req?: NextRequest): string | null {
    if (!req) return null
    return req.cookies.get('sb-refresh-token')?.value ?? null
}

export function isAdminUser(user: User | null): boolean {
    if (!user) return false
    const appRole = String(user.app_metadata?.role ?? '').toLowerCase()
    if (ADMIN_ROLES.includes(appRole)) {
        return true
    }

    const email = String(user.email ?? '').toLowerCase()
    const emailConfirmed = Boolean(user.email_confirmed_at)
    if (emailConfirmed && email && ADMIN_EMAILS.includes(email)) {
        return true
    }

    return false
}

export async function getAuthenticatedUser(accessToken: string): Promise<User | null> {
    assertSupabaseEnv()
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.getUser(accessToken)
    if (error || !data.user) return null
    return data.user
}

export type RefreshedSession = {
    accessToken: string
    refreshToken: string
    user: User
}

export async function refreshSessionWithToken(refreshToken: string): Promise<RefreshedSession | null> {
    assertSupabaseEnv()
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session || !data.user) return null
    return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: data.user,
    }
}

export function createScopedServerClient(accessToken: string) {
    assertSupabaseEnv()
    return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    })
}
