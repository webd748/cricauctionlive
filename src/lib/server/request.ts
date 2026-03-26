import type { NextRequest } from 'next/server'

export function getRequestIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
        const [first] = forwarded.split(',')
        if (first?.trim()) return first.trim()
    }
    return req.headers.get('x-real-ip') ?? 'unknown'
}

function normalizeOrigin(value: string | null | undefined): string | null {
    if (!value) return null
    const raw = value.trim()
    if (!raw) return null

    try {
        const withProtocol = raw.includes('://') ? raw : `https://${raw}`
        const parsed = new URL(withProtocol)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null
        }
        return `${parsed.protocol}//${parsed.host}`
    } catch {
        return null
    }
}

export function getPublicOrigin(req: NextRequest): string {
    const envOrigin =
        normalizeOrigin(process.env.APP_BASE_URL) ??
        normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
        normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
    if (envOrigin) return envOrigin

    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? ''
    const host = forwardedHost || req.headers.get('host')?.split(',')[0]?.trim() || ''
    if (host) {
        const protoHeader = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? ''
        const protoFromReq = req.nextUrl.protocol.replace(':', '')
        const protocol =
            protoHeader === 'http' || protoHeader === 'https'
                ? protoHeader
                : protoFromReq === 'http' || protoFromReq === 'https'
                  ? protoFromReq
                  : 'https'
        return `${protocol}://${host}`
    }

    const nextOrigin = normalizeOrigin(req.nextUrl.origin)
    if (nextOrigin) return nextOrigin

    const requestOrigin = normalizeOrigin(req.url)
    if (requestOrigin) return requestOrigin

    return 'http://localhost:3000'
}

export function buildAbsoluteUrl(req: NextRequest, pathname: string): URL {
    return new URL(pathname, getPublicOrigin(req))
}
