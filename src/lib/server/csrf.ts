import type { NextRequest } from 'next/server'

function getRequestOrigin(req: NextRequest): string | null {
    const originHeader = req.headers.get('origin')
    if (!originHeader) return null
    try {
        const origin = new URL(originHeader)
        return `${origin.protocol}//${origin.host}`
    } catch {
        return null
    }
}

function getExpectedOrigin(req: NextRequest): string | null {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    if (!host) return null
    const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
    const protocol = proto === 'http' || proto === 'https' ? proto : 'https'
    return `${protocol}://${host}`
}

export function hasValidSameOrigin(req: NextRequest): boolean {
    const fetchSite = req.headers.get('sec-fetch-site')

    if (fetchSite === 'same-origin') {
        return true
    }
    if (fetchSite === 'cross-site' || fetchSite === 'same-site') {
        return false
    }

    const requestOrigin = getRequestOrigin(req)
    if (!requestOrigin) {
        // Non-browser clients may omit Origin or Sec-Fetch-Site. Route auth still applies.
        return true
    }

    const expectedOrigin = getExpectedOrigin(req)
    if (!expectedOrigin) return false
    return requestOrigin === expectedOrigin
}
