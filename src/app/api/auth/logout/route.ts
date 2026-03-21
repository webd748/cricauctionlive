import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/server/modules/authService'
import { logger } from '@/lib/logger'

export async function POST() {
    const response = NextResponse.json({ data: { ok: true } })
    clearSessionCookies(response)
    logger.info('Logout completed')
    return response
}
