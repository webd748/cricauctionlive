import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { verifyStripeWebhookAndParseEvent } from '@/lib/server/stripeGateway'
import { activateBillingSubscription } from '@/lib/server/modules/billingManagement'
import { getServiceRoleClient } from '@/lib/server/serviceSupabase'

export const runtime = 'nodejs'

function parseValidDays(): number {
    const raw = Number(process.env.STRIPE_BILLING_VALID_DAYS ?? 30)
    return Math.min(365, Math.max(1, Number.isFinite(raw) ? raw : 30))
}

export async function POST(req: NextRequest) {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
    }

    let rawBody = ''
    try {
        rawBody = await req.text()
    } catch {
        return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
    }

    try {
        const event = verifyStripeWebhookAndParseEvent(rawBody, signature)

        if (event.type === 'checkout.session.completed') {
            const session = event.data?.object
            const metadata = session?.metadata ?? {}
            const paymentStatus = session?.payment_status

            if (paymentStatus === 'paid' && metadata.subscription_id && metadata.user_id) {
                const serviceClient = getServiceRoleClient()
                await activateBillingSubscription(serviceClient, {
                    subscriptionId: metadata.subscription_id,
                    userId: metadata.user_id,
                    validDays: parseValidDays(),
                })
                logger.info('Stripe checkout marked subscription active', {
                    subscriptionId: metadata.subscription_id,
                    userId: metadata.user_id,
                    sessionId: session?.id,
                })
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        logger.warn('Stripe webhook rejected', {
            message: error instanceof Error ? error.message : String(error),
        })
        return NextResponse.json({ error: 'Webhook verification failed.' }, { status: 400 })
    }
}
