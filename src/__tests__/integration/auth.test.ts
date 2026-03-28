import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { 
    requireAuthenticatedAccess, 
    requireAdminAccess, 
    requireActiveSubscriptionAccess 
} from '@/lib/server/modules/authModule'
import * as auth from '@/lib/server/auth'
import * as subAccess from '@/lib/server/modules/subscriptionAccess'
import * as startupSecurity from '@/lib/server/startupSecurity'

vi.mock('@/lib/server/auth', () => ({
    getAccessTokenFromRequest: vi.fn(),
    getRefreshTokenFromRequest: vi.fn(),
    getAuthenticatedUser: vi.fn(),
    isAdminUser: vi.fn(),
    createScopedServerClient: vi.fn(),
    refreshSessionWithToken: vi.fn(),
}))

vi.mock('@/lib/server/modules/subscriptionAccess', () => ({
    assertActiveSubscription: vi.fn(),
}))

vi.mock('@/lib/server/startupSecurity', () => ({
    assertSecurityBaseline: vi.fn().mockResolvedValue(undefined),
}))

describe('Auth & Subscription Boundaries Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const createReq = () => new NextRequest('http://localhost')

    it('requires valid session for authenticated access', async () => {
        const req = createReq()
        vi.mocked(auth.getAccessTokenFromRequest).mockReturnValue(null)
        vi.mocked(auth.getRefreshTokenFromRequest).mockReturnValue(null)

        await expect(requireAuthenticatedAccess(req)).rejects.toThrow('Not authenticated.')
    })

    it('returns access result if user is authenticated with valid access token', async () => {
        const req = createReq()
        vi.mocked(auth.getAccessTokenFromRequest).mockReturnValue('valid-token')
        const fakeUser = { id: 'usr_1' } as any
        vi.mocked(auth.getAuthenticatedUser).mockResolvedValue(fakeUser)
        vi.mocked(auth.isAdminUser).mockReturnValue(false)
        const fakeClient = {} as any
        vi.mocked(auth.createScopedServerClient).mockReturnValue(fakeClient)

        const result = await requireAuthenticatedAccess(req)
        expect(result.user).toBe(fakeUser)
        expect(result.isAdmin).toBe(false)
        expect(result.client).toBe(fakeClient)
        expect(result.accessToken).toBe('valid-token')
    })

    it('fails admin access if user is not admin', async () => {
        const req = createReq()
        vi.mocked(auth.getAccessTokenFromRequest).mockReturnValue('valid-token')
        vi.mocked(auth.getAuthenticatedUser).mockResolvedValue({ id: 'usr_1' } as any)
        vi.mocked(auth.isAdminUser).mockReturnValue(false)

        await expect(requireAdminAccess(req)).rejects.toThrow('Admin access required.')
    })

    it('allows admin access if user is admin', async () => {
        const req = createReq()
        vi.mocked(auth.getAccessTokenFromRequest).mockReturnValue('valid-token')
        vi.mocked(auth.getAuthenticatedUser).mockResolvedValue({ id: 'usr_1' } as any)
        vi.mocked(auth.isAdminUser).mockReturnValue(true)

        const result = await requireAdminAccess(req)
        expect(result.isAdmin).toBe(true)
    })

    it('requires active subscription for subscription access', async () => {
        const req = createReq()
        vi.mocked(auth.getAccessTokenFromRequest).mockReturnValue('valid-token')
        vi.mocked(auth.getAuthenticatedUser).mockResolvedValue({ id: 'usr_1' } as any)
        
        vi.mocked(subAccess.assertActiveSubscription).mockRejectedValue(new Error('Active subscription required.'))

        await expect(requireActiveSubscriptionAccess(req)).rejects.toThrow('Active subscription required.')
    })

    it('returns subscription data if active', async () => {
        const req = createReq()
        vi.mocked(auth.getAccessTokenFromRequest).mockReturnValue('valid-token')
        vi.mocked(auth.getAuthenticatedUser).mockResolvedValue({ id: 'usr_1' } as any)
        const fakeSub = { status: 'active', planCode: 'free', maxTeams: 4, expiresAt: null } as any
        vi.mocked(subAccess.assertActiveSubscription).mockResolvedValue(fakeSub)

        const result = await requireActiveSubscriptionAccess(req)
        expect(result.subscription).toBe(fakeSub)
    })
})
