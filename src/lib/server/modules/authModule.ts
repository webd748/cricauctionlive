import type { NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { NextResponse } from 'next/server'
import {
    createScopedServerClient,
    getAccessTokenFromRequest,
    getRefreshTokenFromRequest,
    getAuthenticatedUser,
    isAdminUser,
    refreshSessionWithToken,
} from '@/lib/server/auth'
import { setSessionCookies } from '@/lib/server/modules/authService'
import { assertActiveSubscription, type SubscriptionState } from '@/lib/server/modules/subscriptionAccess'
import { assertSecurityBaseline } from '@/lib/server/startupSecurity'

export type AdminAccessResult = {
    user: User
    accessToken: string
    client: SupabaseClient
    isAdmin: boolean
    refreshedSession?: {
        accessToken: string
        refreshToken: string
    }
    subscription?: SubscriptionState
}

export function applyRefreshedSessionCookies(response: NextResponse, auth: AdminAccessResult) {
    if (!auth.refreshedSession) return
    setSessionCookies(response, auth.refreshedSession.accessToken, auth.refreshedSession.refreshToken)
}

export async function requireAuthenticatedAccess(req: NextRequest): Promise<AdminAccessResult> {
    await assertSecurityBaseline()

    const accessToken = getAccessTokenFromRequest(req)
    const refreshToken = getRefreshTokenFromRequest(req)

    if (accessToken) {
        const user = await getAuthenticatedUser(accessToken)
        if (user) {
            return {
                user,
                accessToken,
                client: createScopedServerClient(accessToken),
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
        accessToken: refreshed.accessToken,
        client: createScopedServerClient(refreshed.accessToken),
        isAdmin: isAdminUser(refreshed.user),
        refreshedSession: {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
        },
    }
}

export async function requireAdminAccess(req: NextRequest): Promise<AdminAccessResult> {
    const auth = await requireAuthenticatedAccess(req)
    if (!auth.isAdmin) {
        throw new Error('Admin access required.')
    }
    return auth
}

type ActiveSubscriptionOptions = {
    admin?: boolean
}

export async function requireActiveSubscriptionAccess(
    req: NextRequest,
    options: ActiveSubscriptionOptions = {},
): Promise<AdminAccessResult> {
    const auth = options.admin ? await requireAdminAccess(req) : await requireAuthenticatedAccess(req)
    const subscription = await assertActiveSubscription(auth.client)
    return {
        ...auth,
        subscription,
    }
}
