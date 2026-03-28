import crypto from 'node:crypto'

export type StripeCheckoutSessionCreateInput = {
    amountInr: number
    planName: string
    planCode: string
    userId: string
    subscriptionId: string
    successUrl: string
    cancelUrl: string
    customerEmail?: string | null
}

type StripeCheckoutSessionResponse = {
    id: string
    url?: string
}

type StripeEvent = {
    id: string
    type: string
    data?: {
        object?: {
            id?: string
            mode?: string
            payment_status?: string
            metadata?: Record<string, string>
        }
    }
}

function getStripeSecretKey(): string {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
        throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY.')
    }
    return key
}

export async function createStripeCheckoutSession(input: StripeCheckoutSessionCreateInput): Promise<StripeCheckoutSessionResponse> {
    if (!Number.isFinite(input.amountInr) || input.amountInr <= 0) {
        throw new Error('Stripe checkout amount must be greater than zero.')
    }

    const form = new URLSearchParams()
    form.append('mode', 'payment')
    form.append('success_url', input.successUrl)
    form.append('cancel_url', input.cancelUrl)
    form.append('line_items[0][quantity]', '1')
    form.append('line_items[0][price_data][currency]', 'inr')
    form.append('line_items[0][price_data][unit_amount]', String(Math.round(input.amountInr * 100)))
    form.append('line_items[0][price_data][product_data][name]', `CricAuctionLive ${input.planName}`)
    form.append('line_items[0][price_data][product_data][description]', `Billing plan ${input.planCode}`)
    form.append('metadata[user_id]', input.userId)
    form.append('metadata[subscription_id]', input.subscriptionId)
    form.append('metadata[plan_code]', input.planCode)
    form.append('metadata[amount_inr]', String(input.amountInr))

    if (input.customerEmail) {
        form.append('customer_email', input.customerEmail)
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getStripeSecretKey()}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        cache: 'no-store',
    })

    const payload = (await response.json().catch(() => null)) as
        | ({ error?: { message?: string } } & StripeCheckoutSessionResponse)
        | null

    if (!response.ok || !payload?.id) {
        const stripeMessage = payload?.error?.message
        throw new Error(stripeMessage || 'Unable to create Stripe checkout session.')
    }

    return payload
}

function parseStripeSignature(header: string): { timestamp: string; signatures: string[] } {
    const items = header
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)

    const timestamp = items.find((item) => item.startsWith('t='))?.slice(2)
    const signatures = items.filter((item) => item.startsWith('v1=')).map((item) => item.slice(3))

    if (!timestamp || signatures.length === 0) {
        throw new Error('Invalid Stripe signature header.')
    }

    return { timestamp, signatures }
}

function secureEqualHex(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'hex')
    const bBuf = Buffer.from(b, 'hex')
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
}

export function verifyStripeWebhookAndParseEvent(rawBody: string, signatureHeader: string): StripeEvent {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        throw new Error('Stripe webhook is not configured. Missing STRIPE_WEBHOOK_SECRET.')
    }

    const { timestamp, signatures } = parseStripeSignature(signatureHeader)
    const signedPayload = `${timestamp}.${rawBody}`
    const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex')

    const isValid = signatures.some((sig) => secureEqualHex(expected, sig))
    if (!isValid) {
        throw new Error('Invalid Stripe webhook signature.')
    }

    const event = JSON.parse(rawBody) as StripeEvent
    if (!event?.type) {
        throw new Error('Invalid Stripe event payload.')
    }

    return event
}
