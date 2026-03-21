'use client'

import { useSyncExternalStore } from 'react'

/**
 * Renders children only after the component has mounted on the client.
 * Use this to wrap pages/components that are purely interactive so that
 * browser-extension-injected attributes (Bitdefender bis_skin_checked,
 * Grammarly, etc.) never cause React hydration mismatches.
 */
export function ClientOnly({ children, fallback = null }: {
    children: React.ReactNode
    fallback?: React.ReactNode
}) {
    const mounted = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false,
    )
    if (!mounted) return <>{fallback}</>
    return <>{children}</>
}
