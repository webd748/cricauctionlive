import { NextRequest, NextResponse } from 'next/server'
import { executeAuctionAction, type AuctionAction } from '@/lib/server/modules/auctionEngine'
import { applyRefreshedSessionCookies, requireAdminAccess } from '@/lib/server/modules/authModule'
import { logger } from '@/lib/logger'

type AuctionBody = {
    action?: AuctionAction
    payload?: Record<string, unknown>
}

function authStatus(errorMessage: string): number {
    if (errorMessage === 'Not authenticated.' || errorMessage === 'Invalid session.') {
        return 401
    }
    if (errorMessage === 'Admin access required.') {
        return 403
    }
    return 400
}

export async function POST(req: NextRequest) {
    let auth
    try {
        auth = await requireAdminAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Auction API auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const body = (await req.json().catch(() => null)) as AuctionBody | null
    const action = body?.action
    const payload = body?.payload ?? {}
    if (!action) {
        return NextResponse.json({ error: 'Action is required.' }, { status: 400 })
    }

    try {
        logger.info('Auction action requested', { action, userId: auth.user.id })
        const data = await executeAuctionAction(auth.client, action, payload)
        logger.info('Auction action completed', { action, userId: auth.user.id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed.'
        logger.error('Auction action failed', { action, message, userId: auth.user.id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
