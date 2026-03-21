import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAuthenticatedAccess,
} from '@/lib/server/modules/authModule'
import { selectBillingPlan } from '@/lib/server/modules/billingManagement'
import { logger } from '@/lib/logger'

function authStatus(errorMessage: string): number {
    if (errorMessage === 'Not authenticated.' || errorMessage === 'Invalid session.') {
        return 401
    }
    return 400
}

type PlanBody = {
    planCode?: string
}

export async function POST(req: NextRequest) {
    let auth
    try {
        auth = await requireAuthenticatedAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing plan auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const body = (await req.json().catch(() => null)) as PlanBody | null
    const planCode = body?.planCode?.trim()
    if (!planCode) {
        return NextResponse.json({ error: 'planCode is required.' }, { status: 400 })
    }

    try {
        const data = await selectBillingPlan(auth.client, planCode)
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        logger.info('Billing plan selected', { userId: auth.user.id, planCode })
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to select plan.'
        logger.error('Billing plan selection failed', { message, userId: auth.user.id, planCode })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
