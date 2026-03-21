export type ApiResult<T> = {
    data: T
}

async function parseResponse<T>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        const message = (payload as { error?: string } | null)?.error ?? 'Request failed'
        throw new Error(message)
    }
    return payload as T
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return parseResponse<T>(response)
}

export async function deleteJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
    })
    return parseResponse<T>(response)
}
