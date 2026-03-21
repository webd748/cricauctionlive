import { NextResponse } from 'next/server'
import { registerWithPassword, setSessionCookies } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
    const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null
    const email = body?.email?.trim()
    const password = body?.password

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    let result
    try {
        result = await registerWithPassword(email, password)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to create account.'
        const status = message === 'Supabase environment variables are missing.' ? 500 : 400
        logger.warn('Register failed', { email, message, status })
        return NextResponse.json({ error: message }, { status })
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
