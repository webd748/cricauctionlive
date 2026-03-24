import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAuthenticatedAccess,
} from '@/lib/server/modules/authModule'
import { selectBillingPlan } from '@/lib/server/modules/billingManagement'
import { logger } from '@/lib/logger'
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'

type PlanBody = {
    planCode?: string
}

export async function POST(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return errorJson('Invalid request origin.', 403)
    }

    let auth
    try {
        auth = await requireAuthenticatedAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing plan auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const body = (await req.json().catch(() => null)) as PlanBody | null
    const planCode = body?.planCode?.trim()
    if (!planCode) {
        return errorJson('planCode is required.', 400)
    }

    try {
        const data = await selectBillingPlan(auth.client, planCode)
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        logger.info('Billing plan selected', { userId: auth.user.id, planCode })
        return response
    } catch (error) {
        logger.error('Billing plan selection failed', {
            message: error instanceof Error ? error.message : String(error),
            userId: auth.user.id,
            planCode,
        })
        return errorJson(safePublicErrorMessage(error, 'Failed to select plan.'), 400)
    }
}
