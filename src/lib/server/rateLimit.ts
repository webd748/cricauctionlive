const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const HAS_UPSTASH_CONFIG = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

type UpstashPipelineResult = Array<{ result?: unknown; error?: string }>

async function upstashRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const pipelineUrl = `${UPSTASH_URL}/pipeline`
    const response = await fetch(pipelineUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([
            ['INCR', key],
            ['PEXPIRE', key, String(windowMs), 'NX'],
        ]),
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(`Rate limit backend error: ${response.status}`)
    }

    const payload = (await response.json().catch(() => null)) as UpstashPipelineResult | null
    const countRaw = payload?.[0]?.result
    const count = typeof countRaw === 'number' ? countRaw : Number(countRaw)

    if (!Number.isFinite(count)) {
        throw new Error('Rate limit backend returned invalid counter.')
    }

    return count <= limit
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    if (!HAS_UPSTASH_CONFIG) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Upstash Redis is required for rate limiting in production. Please configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.')
        }
        // In development without Upstash, just bypass rate limit to allow local testing
        return true
    }

    const namespacedKey = `ratelimit:${key}`
    return await upstashRateLimit(namespacedKey, limit, windowMs)
}
