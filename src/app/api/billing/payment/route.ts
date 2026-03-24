import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAuthenticatedAccess,
} from '@/lib/server/modules/authModule'
import { submitBillingPaymentProof } from '@/lib/server/modules/billingManagement'
import { logger } from '@/lib/logger'
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'

export async function POST(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return errorJson('Invalid request origin.', 403)
    }

    let auth
    try {
        auth = await requireAuthenticatedAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Billing payment auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    const formData = await req.formData()
    const upiRef = String(formData.get('upiRef') ?? '')
    const note = String(formData.get('note') ?? '')
    const screenshotValue = formData.get('screenshot')
    const screenshot = screenshotValue instanceof File ? screenshotValue : null

    if (!screenshot) {
        return errorJson('Payment screenshot is required.', 400)
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
        logger.error('Billing payment submission failed', {
            message: error instanceof Error ? error.message : String(error),
            userId: auth.user.id,
        })
        return errorJson(safePublicErrorMessage(error, 'Failed to submit payment proof.'), 400)
    }
}
