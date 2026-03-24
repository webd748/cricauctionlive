import { NextResponse } from 'next/server'
import { loginWithPassword, setSessionCookies } from '@/lib/server/modules/authService'
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

    const ip = getRequestIp(req)
    const rateKey = `login:${ip}:${email}`
    if (!(await checkRateLimit(rateKey, 10, 5 * 60 * 1000))) {
        return NextResponse.json({ error: 'Too many login attempts. Try again in a few minutes.' }, { status: 429 })
    }

    let result
    try {
        result = await loginWithPassword(email, password)
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'Login failed.'
        const status = detail === 'Supabase environment variables are missing.' ? 500 : 401
        logger.warn('Login failed', { email, detail, status, ip })
        return NextResponse.json(
            { error: status === 500 ? 'Server authentication is not configured.' : 'Invalid email or password.' },
            { status },
        )
    }

    const response = NextResponse.json({
        data: {
            user: { id: result.user.id, email: result.user.email },
            isAdmin: result.isAdmin,
        },
    })
    setSessionCookies(response, result.session.access_token, result.session.refresh_token)
    logger.info('Login succeeded', { userId: result.user.id, isAdmin: result.isAdmin })
    return response
}
