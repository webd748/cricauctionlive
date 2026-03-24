import { NextResponse } from 'next/server'
import { registerWithPassword, setSessionCookies } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/server/rateLimit'
import { hasValidSameOrigin } from '@/lib/server/csrf'
import { getRequestIp } from '@/lib/server/request'

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
    if (!hasValidSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null
    const email = body?.email?.trim().toLowerCase()
    const password = body?.password

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    if (password.length > 128) {
        return NextResponse.json({ error: 'Password is too long.' }, { status: 400 })
    }

    const ip = getRequestIp(req)
    const rateKey = `register:${ip}:${email}`
    if (!(await checkRateLimit(rateKey, 5, 15 * 60 * 1000))) {
        return NextResponse.json({ error: 'Too many registration attempts. Try again later.' }, { status: 429 })
    }

    let result
    try {
        result = await registerWithPassword(email, password)
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unable to create account.'
        const status = detail === 'Supabase environment variables are missing.' ? 500 : 400
        logger.warn('Register failed', { email, detail, status, ip })
        return NextResponse.json(
            { error: status === 500 ? 'Server authentication is not configured.' : 'Unable to create account.' },
            { status },
        )
    }

    const response = NextResponse.json({
        data: {
            user: { id: result.user.id, email: result.user.email },
            isAdmin: result.isAdmin,
            requiresEmailVerification: result.requiresEmailVerification,
        },
    })

    if (result.session) {
        setSessionCookies(response, result.session.access_token, result.session.refresh_token)
    }

    logger.info('Register succeeded', {
        userId: result.user.id,
        isAdmin: result.isAdmin,
        requiresEmailVerification: result.requiresEmailVerification,
    })
    return response
}
