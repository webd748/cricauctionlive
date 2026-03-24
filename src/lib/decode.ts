export function decodeHtml(html: string): string {
    if (typeof html !== 'string') return html
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
}

export function decodeObject<T>(obj: T): T {
    if (typeof obj === 'string') {
        return decodeHtml(obj) as unknown as T
    }
    if (Array.isArray(obj)) {
        return obj.map(decodeObject) as unknown as T
    }
    if (obj !== null && typeof obj === 'object') {
        const decoded: any = {}
        for (const [key, value] of Object.entries(obj)) {
            decoded[key] = decodeObject(value)
        }
        return decoded as T
    }
    return obj
}
