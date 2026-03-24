import { NextResponse } from 'next/server'

export function authStatus(errorMessage: string): number {
    if (errorMessage === 'Not authenticated.' || errorMessage === 'Invalid session.') {
        return 401
    }
    if (errorMessage === 'Admin access required.') {
        return 403
    }
    if (errorMessage === 'Active subscription required.') {
        return 402
    }
    return 400
}

const SAFE_EXPOSED_ERRORS = new Set([
    'Invalid request body.',
    'Action is required.',
    'planCode is required.',
    'proofId and action are required.',
    'Payment screenshot is required.',
    'Name and acronym are required.',
    'Acronym must be 2-4 uppercase letters or numbers.',
    'Team logo must be 2MB or less.',
    'Team logo must be PNG, JPG, or WEBP.',
    'Team logo content is invalid. Upload a valid PNG, JPG, or WEBP image.',
    'Team logo type does not match file content.',
    'At least one player is required.',
    'You can import at most 500 players at a time.',
    'No valid players in payload. Check name, role, and optional photo URL values.',
    'Player id is required.',
    'Screenshot file must be 10MB or less.',
    'Screenshot must be a PNG, JPG, or WEBP image.',
    'Screenshot content is invalid. Upload a valid PNG, JPG, or WEBP image.',
    'Screenshot type does not match file content.',
    'Proof id is required.',
    'Invalid billing plan.',
    'Server is not fully configured.',
    'Failed to load subscription status.',
    'Active subscription required.',
])

export function safePublicErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : fallback
    if (SAFE_EXPOSED_ERRORS.has(message)) {
        return message
    }
    return fallback
}

export function errorJson(message: string, status: number) {
    return NextResponse.json({ error: message }, { status })
}
