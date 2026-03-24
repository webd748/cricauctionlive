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
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { getServiceRoleClient } from '@/lib/server/serviceSupabase'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'
import { checkReadRateLimit } from '@/lib/server/readThrottle'

function operationStatus(errorMessage: string): number {
    if (errorMessage === 'Server Supabase service role is not configured.') {
        return 500
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
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    if (!(await checkReadRateLimit(req, 'billing:review:get', auth.user.id, 120, 60 * 1000))) {
        return errorJson('Too many requests. Please try again shortly.', 429)
    }

    const status = req.nextUrl.searchParams.get('status')
    const normalizedStatus =
        status === 'submitted' || status === 'approved' || status === 'rejected' ? status : undefined

    try {
        const serviceClient = getServiceRoleClient()
        const data = await listBillingProofsForReview(serviceClient, normalizedStatus)
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load payment proofs.'
        logger.error('Billing review list failed', { message, userId: auth.user.id })
        const statusCode = operationStatus(message)
        const fallback = statusCode === 500 ? 'Server is not fully configured.' : 'Failed to load payment proofs.'
        return errorJson(safePublicErrorMessage(error, fallback), statusCode)
    }
}

type ReviewBody = {
    proofId?: string
    action?: 'approve' | 'reject'
    validDays?: number
    reason?: string
}

export async function POST(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return errorJson('Invalid request origin.', 403)
    }

    let auth
    try {
        auth = await requireAdminAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing review auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const body = (await req.json().catch(() => null)) as ReviewBody | null
    if (!body?.proofId || !body.action) {
        return errorJson('proofId and action are required.', 400)
    }

    try {
        const serviceClient = getServiceRoleClient()
        const data = await reviewBillingProof(serviceClient, {
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
        const statusCode = operationStatus(message)
        const fallback = statusCode === 500 ? 'Server is not fully configured.' : 'Failed to review payment proof.'
        return errorJson(safePublicErrorMessage(error, fallback), statusCode)
    }
}
