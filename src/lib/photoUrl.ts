const QUOTED_URL = /^['"]|['"]$/g

function safeTrim(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim().replace(QUOTED_URL, '').trim()
    return trimmed.length > 0 ? trimmed : null
}

export function extractGoogleDriveId(url: string | null | undefined): string | null {
    const clean = safeTrim(url)
    if (!clean) return null

    try {
        const parsed = new URL(clean)
        const idFromQuery = parsed.searchParams.get('id')
        if (idFromQuery) return idFromQuery

        const filePathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/)
        if (filePathMatch?.[1]) return filePathMatch[1]

        const genericPathMatch = parsed.pathname.match(/\/d\/([^/=]+)/)
        if (genericPathMatch?.[1]) return genericPathMatch[1]
    } catch {
        // URL parsing can fail for malformed input; fallback regex below.
    }

    const idMatch =
        clean.match(/[?&]id=([^&]+)/)?.[1] ??
        clean.match(/\/file\/d\/([^/]+)/)?.[1] ??
        clean.match(/\/d\/([^/=]+)/)?.[1] ??
        null

    return idMatch
}

function normalizeHttpUrl(raw: string): string | null {
    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw)
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return null
            }
            return parsed.toString()
        } catch {
            return null
        }
    }

    if (/^www\./i.test(raw)) {
        try {
            return new URL(`https://${raw}`).toString()
        } catch {
            return null
        }
    }

    return null
}

export function normalizePhotoUrl(url: string | null | undefined): string | null {
    const clean = safeTrim(url)
    if (!clean) return null

    const driveId = extractGoogleDriveId(clean)
    if (driveId) {
        return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`
    }

    if (/^[a-zA-Z0-9_-]{20,}$/.test(clean)) {
        return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(clean)}`
    }

    return normalizeHttpUrl(clean)
}
