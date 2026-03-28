import { NextRequest, NextResponse } from 'next/server'
import {
    applyRefreshedSessionCookies,
    requireAuthenticatedAccess,
} from '@/lib/server/modules/authModule'
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { authStatus, errorJson, safePublicErrorMessage } from '@/lib/server/apiErrors'
import { logger } from '@/lib/logger'
import { getBillingState, activateBillingSubscription } from '@/lib/server/modules/billingManagement'
import { createStripeCheckoutSession } from '@/lib/server/stripeGateway'
import { getServiceRoleClient } from '@/lib/server/serviceSupabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return errorJson('Invalid request origin.', 403)
    }

    let auth
    try {
        auth = await requireAuthenticatedAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Stripe checkout auth failed', { message })
        return errorJson(safePublicErrorMessage(error, 'Authentication failed.'), authStatus(message))
    }

    try {
        const billing = await getBillingState(auth.client)
        const subscription = billing.subscription
        if (!subscription) {
            return errorJson('Select a plan before starting payment.', 400)
        }

        if (subscription.status === 'active') {
            const response = NextResponse.json({ data: { checkoutUrl: null, alreadyActive: true } })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        if (subscription.amount_inr <= 0) {
            const serviceClient = getServiceRoleClient()
            await activateBillingSubscription(serviceClient, {
                subscriptionId: subscription.id,
                userId: auth.user.id,
                validDays: 30,
            })
            const response = NextResponse.json({ data: { checkoutUrl: null, alreadyActive: true } })
            applyRefreshedSessionCookies(response, auth)
            return response
        }

        const origin = req.nextUrl.origin
        const session = await createStripeCheckoutSession({
            amountInr: subscription.amount_inr,
            planName: billing.plan?.name ?? subscription.plan_code,
            planCode: subscription.plan_code,
            userId: auth.user.id,
            subscriptionId: subscription.id,
            successUrl: `${origin}/payment?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/payment?stripe=cancel`,
            customerEmail: auth.user.email,
        })

        const response = NextResponse.json({ data: { checkoutUrl: session.url ?? null, sessionId: session.id } })
        applyRefreshedSessionCookies(response, auth)
        logger.info('Stripe checkout session created', { userId: auth.user.id, subscriptionId: subscription.id })
        return response
    } catch (error) {
        logger.error('Stripe checkout creation failed', {
            message: error instanceof Error ? error.message : String(error),
            userId: auth.user.id,
        })
        return errorJson(safePublicErrorMessage(error, 'Unable to start Stripe checkout.'), 400)
    }
}
