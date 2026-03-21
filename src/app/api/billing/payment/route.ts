import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAuthenticatedAccess,
} from '@/lib/server/modules/authModule'
import { submitBillingPaymentProof } from '@/lib/server/modules/billingManagement'
import { logger } from '@/lib/logger'

function authStatus(errorMessage: string): number {
    if (errorMessage === 'Not authenticated.' || errorMessage === 'Invalid session.') {
        return 401
    }
    return 400
}

export async function POST(req: NextRequest) {
    let auth
    try {
        auth = await requireAuthenticatedAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing payment auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const formData = await req.formData()
    const upiRef = String(formData.get('upiRef') ?? '')
    const note = String(formData.get('note') ?? '')
    const screenshotValue = formData.get('screenshot')
    const screenshot = screenshotValue instanceof File ? screenshotValue : null

    if (!screenshot) {
        return NextResponse.json({ error: 'Payment screenshot is required.' }, { status: 400 })
    }

    try {
        const data = await submitBillingPaymentProof(auth.client, {
            userId: auth.user.id,
            screenshot,
            upiRef,
            note,
        })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        logger.info('Billing payment submitted', { userId: auth.user.id })
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit payment proof.'
        logger.error('Billing payment submission failed', { message, userId: auth.user.id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
