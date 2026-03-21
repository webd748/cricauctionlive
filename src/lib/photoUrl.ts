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

export function normalizePhotoUrl(url: string | null | undefined): string | null {
    const clean = safeTrim(url)
    if (!clean) return null

    const driveId = extractGoogleDriveId(clean)
    if (driveId) {
        // Drive IDs are best rendered using a stable googleusercontent image endpoint.
        return `https://lh3.googleusercontent.com/d/${driveId}=w1000`
    }

    return clean
}
