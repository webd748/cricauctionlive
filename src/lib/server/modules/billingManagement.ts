import type { SupabaseClient } from '@supabase/supabase-js'
import { getBillingPlan } from '@/lib/billing'

export type BillingSubscriptionStatus =
    | 'pending_payment'
    | 'pending_review'
    | 'active'
    | 'rejected'
    | 'expired'

export type BillingSubscription = {
    id: string
    user_id: string
    plan_code: string
    max_teams: number
    amount_inr: number
    status: BillingSubscriptionStatus
    selected_at: string
    activated_at: string | null
    expires_at: string | null
}

export type BillingPaymentProof = {
    id: string
    user_id: string
    subscription_id: string
    plan_code: string
    amount_inr: number
    upi_ref: string | null
    screenshot_path: string | null
    status: 'submitted' | 'approved' | 'rejected'
    review_note: string | null
    created_at: string
    reviewed_at: string | null
    reviewed_by: string | null
    screenshot_signed_url?: string | null
}

export type BillingState = {
    subscription: BillingSubscription | null
    plan: ReturnType<typeof getBillingPlan>
    latestProof: BillingPaymentProof | null
}

async function createSignedProofUrl(client: SupabaseClient, path: string | null): Promise<string | null> {
    if (!path) return null
    const { data, error } = await client.storage.from('payment-proofs').createSignedUrl(path, 60 * 60)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
}

export async function getBillingState(client: SupabaseClient): Promise<BillingState> {
    const { data: subscriptionData, error: subscriptionError } = await client
        .from('billing_subscriptions')
        .select('id,user_id,plan_code,max_teams,amount_inr,status,selected_at,activated_at,expires_at')
        .limit(1)
        .maybeSingle()

    if (subscriptionError) {
        throw new Error(subscriptionError.message)
    }

    const subscription = (subscriptionData ?? null) as BillingSubscription | null
    if (!subscription) {
        return {
            subscription: null,
            plan: null,
            latestProof: null,
        }
    }

    const { data: proofData, error: proofError } = await client
        .from('billing_payment_proofs')
        .select('id,user_id,subscription_id,plan_code,amount_inr,upi_ref,screenshot_path,status,review_note,created_at,reviewed_at,reviewed_by')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (proofError) {
        throw new Error(proofError.message)
    }

    const latestProof = (proofData ?? null) as BillingPaymentProof | null
    if (latestProof) {
        latestProof.screenshot_signed_url = await createSignedProofUrl(client, latestProof.screenshot_path)
    }

    return {
        subscription,
        plan: getBillingPlan(subscription.plan_code),
        latestProof,
    }
}

export async function selectBillingPlan(client: SupabaseClient, planCode: string): Promise<BillingState> {
    const plan = getBillingPlan(planCode)
    if (!plan) {
        throw new Error('Invalid billing plan.')
    }

    const { error } = await client.rpc('select_billing_plan', { p_plan_code: plan.code })
    if (error) {
        throw new Error(error.message)
    }

    return getBillingState(client)
}

function sanitizeFileName(name: string): string {
    const normalized = name.trim().replace(/\s+/g, '-')
    const cleaned = normalized.replace(/[^a-zA-Z0-9._-]/g, '')
    return cleaned.length > 0 ? cleaned : 'payment-proof.png'
}

export async function submitBillingPaymentProof(
    client: SupabaseClient,
    input: {
        userId: string
        screenshot: File
        upiRef?: string | null
        note?: string | null
    },
): Promise<BillingState> {
    if (!input.screenshot) {
        throw new Error('Payment screenshot is required.')
    }

    if (input.screenshot.size > 10 * 1024 * 1024) {
        throw new Error('Screenshot file must be 10MB or less.')
    }

    const safeName = sanitizeFileName(input.screenshot.name)
    const filePath = `${input.userId}/${Date.now()}-${safeName}`
    const fileBuffer = Buffer.from(await input.screenshot.arrayBuffer())

    const { error: uploadError } = await client.storage
        .from('payment-proofs')
        .upload(filePath, fileBuffer, {
            contentType: input.screenshot.type || 'image/png',
            upsert: false,
        })

    if (uploadError) {
        throw new Error(`Failed to upload payment proof: ${uploadError.message}`)
    }

    const { error: submitError } = await client.rpc('submit_payment_proof', {
        p_upi_ref: input.upiRef?.trim() || null,
        p_screenshot_path: filePath,
        p_note: input.note?.trim() || null,
    })

    if (submitError) {
        throw new Error(submitError.message)
    }

    return getBillingState(client)
}

export async function listBillingProofsForReview(
    client: SupabaseClient,
    status?: 'submitted' | 'approved' | 'rejected',
): Promise<BillingPaymentProof[]> {
    let query = client
        .from('billing_payment_proofs')
        .select('id,user_id,subscription_id,plan_code,amount_inr,upi_ref,screenshot_path,status,review_note,created_at,reviewed_at,reviewed_by')
        .order('created_at', { ascending: false })

    if (status) {
        query = query.eq('status', status)
    }

    const { data, error } = await query.limit(150)
    if (error) {
        throw new Error(error.message)
    }

    const rows = (data ?? []) as BillingPaymentProof[]
    await Promise.all(
        rows.map(async (proof) => {
            proof.screenshot_signed_url = await createSignedProofUrl(client, proof.screenshot_path)
        }),
    )
    return rows
}

export async function reviewBillingProof(
    client: SupabaseClient,
    input: {
        proofId: string
        action: 'approve' | 'reject'
        validDays?: number
        reason?: string | null
    },
) {
    if (!input.proofId) {
        throw new Error('Proof id is required.')
    }

    if (input.action === 'approve') {
        const { error } = await client.rpc('approve_payment_proof', {
            p_proof_id: input.proofId,
            p_valid_days: Math.max(1, Number(input.validDays ?? 30)),
        })
        if (error) {
            throw new Error(error.message)
        }
        return { ok: true }
    }

    const { error } = await client.rpc('reject_payment_proof', {
        p_proof_id: input.proofId,
        p_reason: input.reason?.trim() || null,
    })
    if (error) {
        throw new Error(error.message)
    }
    return { ok: true }
}
