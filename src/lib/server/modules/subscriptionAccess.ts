import type { SupabaseClient } from '@supabase/supabase-js'

export type BillingStatus = 'pending_payment' | 'pending_review' | 'active' | 'rejected' | 'expired'

export type SubscriptionState = {
    status: BillingStatus | null
    planCode: string | null
    maxTeams: number | null
    expiresAt: string | null
}

export function hasActiveSubscription(status: string | null, expiresAt: string | null): boolean {
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

export async function getSubscriptionState(client: SupabaseClient): Promise<SubscriptionState> {
    const { data, error } = await client
        .from('billing_subscriptions')
        .select('status,expires_at,plan_code,max_teams')
        .limit(1)
        .maybeSingle()

    if (error) {
        throw new Error('Failed to load subscription status.')
    }

    return {
        status: (data?.status as BillingStatus | null) ?? null,
        planCode: data?.plan_code ?? null,
        maxTeams: typeof data?.max_teams === 'number' ? data.max_teams : null,
        expiresAt: data?.expires_at ?? null,
    }
}

export async function assertActiveSubscription(client: SupabaseClient): Promise<SubscriptionState> {
    const state = await getSubscriptionState(client)
    if (!hasActiveSubscription(state.status, state.expiresAt)) {
        throw new Error('Active subscription required.')
    }
    return state
}
