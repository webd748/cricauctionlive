import { NextRequest, NextResponse } from 'next/server'
import { applyRefreshedSessionCookies, requireAdminAccess } from '@/lib/server/modules/authModule'
import { createTeam, deleteTeam } from '@/lib/server/modules/teamManagement'
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
        logger.warn('Teams API auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const formData = await req.formData()
    const name = String(formData.get('name') ?? '')
    const acronym = String(formData.get('acronym') ?? '')
    const logoValue = formData.get('logo')
    const logo = logoValue instanceof File ? logoValue : null

    try {
        const data = await createTeam(auth.client, { name, acronym, logo })
        logger.info('Team created', { userId: auth.user.id, teamId: data.id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create team.'
        logger.error('Team create failed', { message, userId: auth.user.id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

export async function DELETE(req: NextRequest) {
    let auth
    try {
        auth = await requireAdminAccess(req)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Not authenticated.'
        logger.warn('Teams API auth failed', { message })
        return NextResponse.json({ error: message }, { status: authStatus(message) })
    }

    const id = req.nextUrl.searchParams.get('id')
    try {
        const data = await deleteTeam(auth.client, id ?? '')
        logger.info('Team deleted', { userId: auth.user.id, teamId: id })
        const response = NextResponse.json({ data })
        applyRefreshedSessionCookies(response, auth)
        return response
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete team.'
        logger.error('Team delete failed', { message, userId: auth.user.id, teamId: id })
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
