import type { NextRequest } from 'next/server'

export function getRequestIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
        const [first] = forwarded.split(',')
        if (first?.trim()) return first.trim()
    }
    return req.headers.get('x-real-ip') ?? 'unknown'
}
