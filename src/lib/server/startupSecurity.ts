import { getServiceRoleClient } from '@/lib/server/serviceSupabase'
import { logger } from '@/lib/logger'

type SecurityBaselineResponse = {
    ok?: boolean
    checks?: Record<string, boolean>
}

let lastCheckedAt = 0
let lastCheckOk = false
let inFlightCheck: Promise<void> | null = null

const CHECK_INTERVAL_MS = 60 * 1000

function shouldStrictlyEnforce(): boolean {
    if (process.env.APP_STRICT_STARTUP_HEALTHCHECK === 'false') {
        return false
    }
    return process.env.NODE_ENV === 'production'
}

async function runSecurityBaselineCheck() {
    const client = getServiceRoleClient()
    const { data, error } = await client.rpc('security_baseline_health')
    if (error) {
        throw new Error('Startup security baseline check failed.')
    }

    const payload = (data ?? null) as SecurityBaselineResponse | null
    if (!payload?.ok) {
        logger.error('Security baseline mismatch detected', {
            checks: payload?.checks ?? null,
        })
        throw new Error('Security baseline mismatch.')
    }
}

export async function assertSecurityBaseline() {
    const now = Date.now()
    if (lastCheckOk && now - lastCheckedAt < CHECK_INTERVAL_MS) {
        return
    }

    if (inFlightCheck) {
        return inFlightCheck
    }

    inFlightCheck = (async () => {
        try {
            await runSecurityBaselineCheck()
            lastCheckOk = true
            lastCheckedAt = Date.now()
        } catch (error) {
            lastCheckOk = false
            lastCheckedAt = Date.now()
            const message = error instanceof Error ? error.message : 'Security baseline check failed.'
            if (shouldStrictlyEnforce()) {
                throw new Error(message)
            }
            logger.warn('Security baseline check warning', { message })
        } finally {
            inFlightCheck = null
        }
    })()

    return inFlightCheck
}
