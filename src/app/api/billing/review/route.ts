import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAdminAccess,
} from '@/lib/server/modules/authModule'
import {
    listBillingProofsForReview,
    reviewBillingProof,
} from '@/lib/server/modules/billingManagement'
import { logger } from '@/lib/logger'

function authStatus(errorMessage: string): number {
    if (errorMessage === 'Not authenticated.' || errorMessage === 'Invalid session.') {
        return 401
    }
    if (errorMessage === 'Admin access required.') {
        return 403
    }
    return 400
}

export async function GET(req: NextRequest) {
    let auth
    try {
        auth = await requireAdminAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing review auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const status = req.nextUrl.searchParams.get('status')
    const normalizedStatus =
        status === 'submitted' || status === 'approved' || status === 'rejected' ? status : undefined

    try {
        const data = await listBillingProofsForReview(auth.client, normalizedStatus)
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load payment proofs.'
        logger.error('Billing review list failed', { message, userId: auth.user.id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

type ReviewBody = {
    proofId?: string
    action?: 'approve' | 'reject'
    validDays?: number
    reason?: string
}

export async function POST(req: NextRequest) {
    let auth
    try {
        auth = await requireAdminAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing review auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const body = (await req.json().catch(() => null)) as ReviewBody | null
    if (!body?.proofId || !body.action) {
        return NextResponse.json({ error: 'proofId and action are required.' }, { status: 400 })
    }

    try {
        const data = await reviewBillingProof(auth.client, {
            proofId: body.proofId,
            action: body.action,
            validDays: body.validDays,
            reason: body.reason,
        })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        logger.info('Billing proof reviewed', { userId: auth.user.id, proofId: body.proofId, action: body.action })
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to review payment proof.'
        logger.error('Billing review action failed', { message, userId: auth.user.id, proofId: body.proofId, action: body.action })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
