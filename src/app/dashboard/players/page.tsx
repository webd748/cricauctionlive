'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ClientOnly } from '@/components/ClientOnly'
import { normalizePhotoUrl } from '@/lib/photoUrl'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'

interface Player {
    id: string
    name: string
    role: Role
    place?: string
    photo_url?: string
    is_sold: boolean
    created_at: string
}

interface SoldEntry {
    player_id: string
    sold_price: number
    teams: { name: string; acronym: string; logo_url?: string } | null
}

interface EnrichedPlayer extends Player {
    sold_price?: number
    team?: { name: string; acronym: string; logo_url?: string } | null
}

function fmt(val: number) {
    if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(2)} Cr`
    if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)} L`
    return `₹${val.toLocaleString('en-IN')}`
}

const ROLE_COLORS: Record<Role, { badge: string; dot: string }> = {
    Batsman: { badge: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500' },
    Bowler: { badge: 'bg-orange-50 text-orange-600 border-orange-100', dot: 'bg-orange-500' },
    'All-Rounder': { badge: 'bg-purple-50 text-purple-600 border-purple-100', dot: 'bg-purple-500' },
    'Wicket-Keeper': { badge: 'bg-teal-50 text-teal-600 border-teal-100', dot: 'bg-teal-500' },
}

const ROLES: Role[] = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper']

const BOTTOM_NAV = [
    { href: '/dashboard/live', label: 'Auction', icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm7-7H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1.75 9c0 .23-.02.46-.05.68l1.48 1.16c.13.1.17.29.08.44l-1.4 2.42c-.09.15-.27.21-.43.15l-1.74-.7c-.36.28-.76.51-1.18.69l-.26 1.85c-.03.17-.18.3-.35.3h-2.8c-.17 0-.32-.13-.35-.3l-.26-1.85c-.43-.18-.82-.41-1.18-.69l-1.74.7c-.16.06-.34 0-.43-.15l-1.4-2.42c-.09-.15-.05-.34.08-.44l1.48-1.16c-.03-.23-.05-.46-.05-.69s.02-.46.05-.68L3.86 9.48c-.13-.1-.17-.29-.08-.44l1.4-2.42c.09-.15.27-.21.43-.15l1.74.7c.36-.28.76-.51 1.18-.69l.26-1.85C8.82 4.46 8.97 4.33 9.14 4.33h2.8c.17 0 .32.13.35.3l.26 1.85c.43.18.82.41 1.18.69l1.74-.7c.16-.06.34 0 .43.15l1.4 2.42c.09.15.05.34-.08.44l-1.48 1.16c.03.22.05.45.05.68z" /></svg> },
    { href: '/dashboard/teams', label: 'Teams', icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg> },
    { href: '/dashboard/players', label: 'Players', icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg> },
    { href: '/dashboard/admin', label: 'Admin', icon: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg> },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayersPage() {
    return (
        <ClientOnly fallback={
            <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-[#f8fafc]">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <PlayersContent />
        </ClientOnly>
    )
}

function PlayersContent() {
    const pathname = usePathname()
    const [players, setPlayers] = useState<EnrichedPlayer[]>([])
    const [loading, setLoading] = useState(true)
    const [filterRole, setFilterRole] = useState<string>('All')
    const [filterStatus, setFilterStatus] = useState<string>('All')
    const [search, setSearch] = useState('')
    const [defaultBasePrice, setDefaultBasePrice] = useState<number>(0)

    const fetchData = useCallback(async () => {
        const [{ data: playersData }, { data: soldData }, { data: settingsData }] = await Promise.all([
            supabase.from('players').select('id, name, role, place, photo_url, is_sold, created_at').order('created_at', { ascending: true }),
            supabase.from('sold_players').select('player_id, sold_price, teams(name, acronym, logo_url)'),
            supabase.from('auction_settings').select('base_price').limit(1).single(),
        ])

        if (settingsData?.base_price) setDefaultBasePrice(settingsData.base_price)

        const soldMap = new Map<string, SoldEntry>()
            ; (soldData ?? []).forEach((s: unknown) => {
                const entry = s as SoldEntry
                soldMap.set(entry.player_id, entry)
            })

        const enriched: EnrichedPlayer[] = (playersData ?? []).map(p => {
            const sold = soldMap.get(p.id)
            return {
                ...p,
                sold_price: sold?.sold_price,
                team: sold?.teams ?? null,
            }
        })
        setPlayers(enriched)
        setLoading(false)
    }, [])

    useEffect(() => {
        const kickoff = window.setTimeout(() => {
            void fetchData()
        }, 0)
        return () => window.clearTimeout(kickoff)
    }, [fetchData])

    const filtered = players.filter(p => {
        const matchRole = filterRole === 'All' || p.role === filterRole
        const matchStatus = filterStatus === 'All' || (filterStatus === 'Sold' ? p.is_sold : !p.is_sold)
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
        return matchRole && matchStatus && matchSearch
    })

    const totalSold = players.filter(p => p.is_sold).length
    const totalAvailable = players.filter(p => !p.is_sold).length

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-[#f8fafc] gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading players…</p>
        </div>
    )

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#f8fafc]">

            {/* ══════════ MOBILE ══════════ */}
            <div className="md:hidden pb-28">
                <div className="p-4 space-y-4 max-w-md mx-auto">

                    {/* Header summary */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <h2 className="font-bold text-slate-800">Players Database</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{players.length} total players · {totalSold} sold</p>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                            {[
                                { label: 'Total', value: players.length, color: 'text-slate-800' },
                                { label: 'Sold', value: totalSold, color: 'text-orange-500' },
                                { label: 'Available', value: totalAvailable, color: 'text-emerald-600' },
                            ].map(s => (
                                <div key={s.label} className="text-center bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                                    <p className="text-[10px] text-slate-400">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shadow-sm" />
                    </div>

                    {/* Role filter — dropdown */}
                    <div className="relative">
                        <select
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                            className="w-full appearance-none bg-white border border-slate-200 rounded-2xl px-4 py-2.5 pr-8 text-sm text-slate-700 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            {['All', ...ROLES].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {/* Status filter */}
                    <div className="flex gap-2">
                        {['All', 'Available', 'Sold'].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${filterStatus === s
                                    ? s === 'Sold' ? 'bg-orange-50 text-orange-600 border-orange-200'
                                        : s === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                            : 'bg-slate-700 text-white border-slate-700'
                                    : 'bg-white text-slate-500 border-slate-200'
                                    }`}>{s}</button>
                        ))}
                    </div>

                    {/* Player count */}
                    <p className="text-xs text-slate-400">Showing {filtered.length} of {players.length} players</p>

                    {/* Player cards */}
                    <div className="space-y-3">
                        {filtered.map(player => (
                            <div key={player.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${player.is_sold ? 'border-orange-100' : 'border-slate-100'
                                }`}>
                                <div className="p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                                            {player.photo_url
                                                ? <Image src={normalizePhotoUrl(player.photo_url) ?? player.photo_url} alt={player.name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                                                : <span className="text-base font-black text-slate-400">{player.name.charAt(0)}</span>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="font-bold text-slate-900 truncate">{player.name}</h3>
                                                {player.is_sold
                                                    ? <span className="flex-shrink-0 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">SOLD</span>
                                                    : <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">AVAILABLE</span>
                                                }
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                {player.place && <span className="text-[10px] text-slate-400">{player.place}</span>}
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ROLE_COLORS[player.role]?.badge ?? ''}`}>
                                                    {player.role}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Price row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                            <p className="text-[10px] text-slate-400 font-medium">Base Price</p>
                                            <p className="text-sm font-bold text-slate-800">
                                                {fmt(defaultBasePrice)}
                                            </p>
                                        </div>
                                        <div className={`rounded-xl p-2.5 border ${player.is_sold ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <p className="text-[10px] text-slate-400 font-medium">Final Price</p>
                                            <p className={`text-sm font-bold ${player.is_sold ? 'text-orange-600' : 'text-slate-400'}`}>
                                                {player.is_sold && player.sold_price ? fmt(player.sold_price) : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Team (if sold) */}
                                    {player.is_sold && player.team && (
                                        <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {player.team.logo_url
                                                    ? <Image src={player.team.logo_url} alt={player.team.name} width={24} height={24} className="w-full h-full object-contain" unoptimized />
                                                    : <span className="text-[8px] font-black text-slate-500">{player.team.acronym}</span>
                                                }
                                            </div>
                                            <p className="text-xs text-slate-600 font-medium">{player.team.name}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filtered.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <p className="text-4xl mb-2">🏏</p>
                                <p className="font-semibold">No players found</p>
                                <p className="text-xs mt-1">Try changing your filters</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile bottom nav */}
                <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-6 py-3 pb-6 flex items-center justify-between z-50">
                    {BOTTOM_NAV.map(item => {
                        const active = pathname === item.href
                        return (
                            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 ${active ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {item.icon}
                                <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* ══════════ DESKTOP ══════════ */}
            <div className="hidden md:block">
                <div className="max-w-7xl mx-auto p-6">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Players Database</h1>
                            <p className="text-slate-500 text-sm mt-1">Manage and track all participating players in the current season.</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                            <span>Showing</span>
                            <span className="font-bold text-slate-800">{filtered.length}</span>
                            <span>of</span>
                            <span className="font-bold text-slate-800">{players.length}</span>
                            <span>players</span>
                        </div>
                    </div>

                    {/* Filters bar */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-6 flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="relative flex-1 min-w-48">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…"
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        </div>

                        {/* Role filter — dropdown */}
                        <div className="relative">
                            <select
                                value={filterRole}
                                onChange={e => setFilterRole(e.target.value)}
                                className="appearance-none bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            >
                                {['All', ...ROLES].map(r => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>)}
                            </select>
                            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>

                        {/* Status */}
                        <div className="flex gap-2">
                            {['All', 'Available', 'Sold'].map(s => (
                                <button key={s} onClick={() => setFilterStatus(s)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${filterStatus === s
                                        ? s === 'Sold' ? 'bg-orange-50 text-orange-600 border-orange-200'
                                            : s === 'Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                : 'bg-slate-800 text-white border-slate-800'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                        }`}>{s}</button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Player</th>
                                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Price</th>
                                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Final Price</th>
                                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Team</th>
                                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((player, i) => (
                                    <tr key={player.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-xs text-slate-400">{i + 1}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                                                    {player.photo_url
                                                        ? <Image src={normalizePhotoUrl(player.photo_url) ?? player.photo_url} alt={player.name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                                                        : <span className="text-sm font-black text-slate-400">{player.name.charAt(0)}</span>
                                                    }
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{player.name}</p>
                                                    {player.place && <p className="text-xs text-slate-400">{player.place}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${ROLE_COLORS[player.role]?.badge ?? ''}`}>
                                                {player.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                                            {fmt(defaultBasePrice)}
                                        </td>
                                        <td className="px-4 py-4">
                                            {player.is_sold && player.sold_price
                                                ? <span className="text-sm font-bold text-orange-600">{fmt(player.sold_price)}</span>
                                                : <span className="text-sm text-slate-300">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-4">
                                            {player.team ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 flex-shrink-0">
                                                        {player.team.logo_url
                                                            ? <Image src={player.team.logo_url} alt={player.team.name} width={28} height={28} className="w-full h-full object-contain" unoptimized />
                                                            : <span className="text-[9px] font-black text-slate-500">{player.team.acronym}</span>
                                                        }
                                                    </div>
                                                    <span className="text-xs text-slate-600 font-medium truncate max-w-[100px]">{player.team.name}</span>
                                                </div>
                                            ) : <span className="text-slate-300 text-sm">—</span>}
                                        </td>
                                        <td className="px-4 py-4">
                                            {player.is_sold
                                                ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Sold
                                                </span>
                                                : <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Available
                                                </span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filtered.length === 0 && (
                            <div className="text-center py-16 text-slate-400">
                                <p className="text-4xl mb-3">🏏</p>
                                <p className="font-semibold text-slate-600">No players found</p>
                                <p className="text-sm mt-1">Try adjusting your search or filters</p>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs text-slate-400">Showing {filtered.length} of {players.length} players</p>
                            <div className="flex gap-2">
                                {[
                                    { label: 'Total', value: players.length, cls: 'text-slate-700' },
                                    { label: 'Sold', value: totalSold, cls: 'text-orange-600' },
                                    { label: 'Available', value: totalAvailable, cls: 'text-emerald-600' },
                                ].map(s => (
                                    <span key={s.label} className="text-xs font-medium text-slate-400">
                                        {s.label}: <span className={`font-bold ${s.cls}`}>{s.value}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
