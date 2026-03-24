export function sanitizeNextPath(next: string | null | undefined, fallback = '/plans'): string {
    if (!next) return fallback
    const trimmed = next.trim()
    if (!trimmed.startsWith('/')) return fallback
    if (trimmed.startsWith('//')) return fallback
    if (trimmed.includes('\\')) return fallback
    return trimmed
}

export function resolvePostAuthPath(next: string | null | undefined, isAdmin: boolean): string {
    const normalized = sanitizeNextPath(next, '/plans')
    if (isAdmin && (normalized === '/plans' || normalized === '/dashboard' || normalized === '/dashboard/live')) {
        return '/auction/auction-setup'
    }
    return normalized
}
