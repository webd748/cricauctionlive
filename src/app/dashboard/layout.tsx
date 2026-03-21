'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ClientOnly } from '@/components/ClientOnly'

const TABS = [
    {
        href: '/dashboard/live',
        label: 'Live Auction',
        exact: true,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
        ),
        live: true,
    },
    {
        href: '/dashboard/teams',
        label: 'Teams',
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        href: '/dashboard/players',
        label: 'Players',
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        href: '/dashboard/admin',
        label: 'Admin',
        exact: true,
        adminOnly: true,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
    {
        href: '/dashboard/admin/payments',
        label: 'Payments',
        exact: true,
        adminOnly: true,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 9V7a5 5 0 00-10 0v2m-2 0h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
            </svg>
        ),
    },
    {
        href: '/dashboard/settings',
        label: 'Settings',
        adminOnly: true,
        icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ClientOnly fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <Shell>{children}</Shell>
        </ClientOnly>
    )
}

function Shell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        let active = true
        const loadSession = async () => {
            try {
                const response = await fetch('/api/auth/session', {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                })
                if (!response.ok) return
                const payload = (await response.json().catch(() => null)) as
                    | { data?: { isAdmin?: boolean } }
                    | null
                if (active) {
                    setIsAdmin(Boolean(payload?.data?.isAdmin))
                }
            } catch {
                if (active) {
                    setIsAdmin(false)
                }
            }
        }
        void loadSession()
        return () => {
            active = false
        }
    }, [])

    const visibleTabs = useMemo(
        () => TABS.filter((tab) => !tab.adminOnly || isAdmin),
        [isAdmin],
    )

    const isActive = (tab: typeof TABS[number]) =>
        tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        window.location.href = '/login'
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col">

            {/* ── Top Navigation Bar ── */}
            <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
                <div className="max-w-screen-xl mx-auto px-6">
                    <div className="flex items-center gap-8 h-16">

                        {/* Brand */}
                        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/30">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <span className="text-sm font-bold text-white tracking-tight">Cricket Auction</span>
                        </Link>

                        {/* Divider */}
                        <div className="w-px h-6 bg-slate-700" />

                        {/* Tabs */}
                        <nav className="flex items-center gap-1 flex-1">
                            {visibleTabs.map(tab => {
                                const active = isActive(tab)
                                return (
                                    <Link key={tab.href} href={tab.href}
                                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active
                                            ? 'text-white bg-slate-800'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                            }`}>

                                        {/* Active underline bar */}
                                        {active && (
                                            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-sky-500 rounded-full" />
                                        )}

                                        <span className={active ? 'text-sky-400' : ''}>{tab.icon}</span>
                                        {tab.label}

                                        {/* Live pulse */}
                                        {tab.live && (
                                            <span className="relative flex h-2 w-2 ml-0.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                                            </span>
                                        )}
                                    </Link>
                                )
                            })}
                        </nav>

                        {/* Right side — status chip */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live
                            </span>
                            <button
                                onClick={handleLogout}
                                className="text-xs font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white px-3 py-1.5 rounded-full transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Page Content ── */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>

        </div>
    )
}
