import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/server/rateLimit'
import { getRequestIp } from '@/lib/server/request'

export async function checkReadRateLimit(
    req: NextRequest,
    scope: string,
    userId: string,
    limit = 120,
    windowMs = 60 * 1000,
): Promise<boolean> {
    const ip = getRequestIp(req)
    const key = `read:${scope}:${userId}:${ip}`
    return checkRateLimit(key, limit, windowMs)
}
