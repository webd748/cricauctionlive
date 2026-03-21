import { NextRequest, NextResponse } from 'next/server'
import { applyRefreshedSessionCookies, requireAdminAccess } from '@/lib/server/modules/authModule'
import { createPlayers, deletePlayer, type PlayerInsert } from '@/lib/server/modules/playerManagement'
import { logger } from '@/lib/logger'

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
        logger.warn('Players API auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const body = (await req.json().catch(() => null)) as { players?: PlayerInsert[] } | null
    try {
        const data = await createPlayers(auth.client, body?.players ?? [])
        logger.info('Players created', { userId: auth.user.id, count: data.length })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create players.'
        logger.error('Players create failed', { message, userId: auth.user.id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

export async function DELETE(req: NextRequest) {
    let auth
    try {
        auth = await requireAdminAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Players API auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const id = req.nextUrl.searchParams.get('id')
    try {
        const data = await deletePlayer(auth.client, id ?? '')
        logger.info('Player deleted', { userId: auth.user.id, playerId: id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete player.'
        logger.error('Players delete failed', { message, userId: auth.user.id, playerId: id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
