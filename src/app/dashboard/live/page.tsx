'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ClientOnly } from '@/components/ClientOnly'
import { normalizePhotoUrl } from '@/lib/photoUrl'
import { decodeObject } from '@/lib/decode'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'

const ROLE_STYLES: Record<Role, string> = {
    Batsman: 'bg-blue-50 text-blue-600 border-blue-200',
    Bowler: 'bg-orange-50 text-orange-600 border-orange-200',
    'All-Rounder': 'bg-purple-50 text-purple-600 border-purple-200',
    'Wicket-Keeper': 'bg-teal-50 text-teal-600 border-teal-200',
}

const ROLE_BG: Record<Role, string> = {
    Batsman: 'from-blue-400 to-blue-600',
    Bowler: 'from-orange-400 to-orange-600',
    'All-Rounder': 'from-purple-400 to-purple-600',
    'Wicket-Keeper': 'from-teal-400 to-teal-600',
}

const TEAM_DOT_COLORS = [
    'bg-blue-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-cyan-500',
]

interface AuctionState {
    id?: string
    current_player_id: string | null
    current_bid: number
    current_team_id: string | null
    is_live: boolean
}

interface BidTier {
    from: number
    to: number
    increment: number
}

interface Player {
    id: string; name: string; role: Role
    place?: string; photo_url?: string
}

interface Team {
    id: string; name: string; acronym: string
    logo_url?: string; wallet_balance: number; player_count?: number
}

interface SoldRecord {
    id: string; sold_price: number; sold_at: string; team_id?: string
    players: { name: string; role: Role } | null
    teams: { name: string; acronym: string } | null
}

function fmt(val: number) {
    if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(2)} Cr`
    if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)} L`
    return `₹${val.toLocaleString('en-IN')}`
}

function timeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
}

const COUNTDOWN_STEPS = ['Going Once…', 'Going Twice…', 'SOLD! 🏏'] as const

// ─── Page Shell ───────────────────────────────────────────────────────────────

export default function LiveAuctionPage() {
    return (
        <ClientOnly fallback={
            <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-[#f1f5f9]">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LiveAuctionContent />
        </ClientOnly>
    )
}

function LiveAuctionContent() {
    const [auctionState, setAuctionState] = useState<AuctionState | null>(null)
    const [player, setPlayer] = useState<Player | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [sold, setSold] = useState<SoldRecord[]>([])
    const [bidTiers, setBidTiers] = useState<BidTier[]>([])
    const [minSquadSize, setMinSquadSize] = useState(15)
    const [basePrice, setBasePrice] = useState(0)
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const [countdownIdx, setCountdownIdx] = useState(0)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const cdRef = useRef<NodeJS.Timeout | null>(null)
    const etagRef = useRef<string | null>(null)

    const fetchAll = useCallback(async () => {
        try {
            const headers: Record<string, string> = {}
            if (etagRef.current) {
                headers['If-None-Match'] = etagRef.current
            }

            const response = await fetch('/api/auction?view=live', {
                method: 'GET',
                headers,
                credentials: 'include',
            })

            if (response.status === 304) {
                return
            }

            const newEtag = response.headers.get('ETag')
            if (newEtag) {
                etagRef.current = newEtag
            }

            const payload = (await response.json().catch(() => null)) as
                | {
                    data?: {
                        auctionState?: AuctionState | null
                        currentPlayer?: Player | null
                        teams?: Team[]
                        sold?: SoldRecord[]
                        settings?: { bid_tiers?: BidTier[]; min_squad_size?: number; base_price?: number } | null
                    }
                    error?: string
                }
                | null
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to load live auction')
            }

            const decodedData = decodeObject(payload?.data)

            const state =
                decodedData?.auctionState ??
                ({ current_player_id: null, current_bid: 0, current_team_id: null, is_live: false } as AuctionState)
            setAuctionState(state)
            setPlayer(decodedData?.currentPlayer ?? null)
            setSold((decodedData?.sold ?? []) as SoldRecord[])
            setTeams((decodedData?.teams ?? []).map((team) => ({
                ...team,
                wallet_balance: team.wallet_balance ?? 0,
                player_count: team.player_count ?? 0,
            })))

            const settings = decodedData?.settings
            if (settings) {
                if (Array.isArray(settings.bid_tiers)) setBidTiers(settings.bid_tiers)
                setMinSquadSize(settings.min_squad_size ?? 15)
                setBasePrice(settings.base_price ?? 0)
            }
        } finally {
            setLoading(false)
            setLastRefresh(new Date())
        }
    }, [])

    useEffect(() => {
        const runFetch = () => {
            void fetchAll()
        }
        const kickoff = window.setTimeout(runFetch, 0)
        intervalRef.current = setInterval(runFetch, 3000)
        return () => {
            window.clearTimeout(kickoff)
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [fetchAll])

    useEffect(() => {
        if (!auctionState?.is_live) return
        cdRef.current = setInterval(() => setCountdownIdx(i => (i + 1) % 3), 8000)
        return () => { if (cdRef.current) clearInterval(cdRef.current) }
    }, [auctionState?.is_live])

    const isLive = auctionState?.is_live ?? false
    const currentTeam = teams.find(t => t.id === auctionState?.current_team_id) ?? null

    const calculateIncrement = (currentBid: number) => {
        if (!bidTiers.length) return currentBid < 1000 ? 100 : 200 // safe fallback
        const tier = bidTiers.find(t => currentBid >= t.from && currentBid < t.to)
            ?? bidTiers.at(-1)
        return tier?.increment ?? 100
    }
    const increment = calculateIncrement(auctionState?.current_bid ?? 0)
    const countdown = COUNTDOWN_STEPS[countdownIdx]
    const recentBids = sold.slice(0, 10)
    const recentSold = sold.slice(0, 6)

    const getMBV = (team: Team) => team.wallet_balance - Math.max(0, minSquadSize - (team.player_count ?? 0) - 1) * basePrice
    // Sort teams by Max Bid Value in descending order
    const sortedTeams = [...teams].sort((a, b) => getMBV(b) - getMBV(a))

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-[#f1f5f9] gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading auction…</p>
        </div>
    )

    return (
        <div className="h-[calc(100vh-64px)] bg-[#f1f5f9] p-4 md:p-6 lg:p-8 flex overflow-hidden">
            <div className="w-full h-full max-w-[1920px] mx-auto bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-200 flex overflow-hidden">
                {/* ══ LEFT PANEL — Max Bid Value (fixed width) ══ */}
                <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col z-10">
                    {/* Header */}
                    <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                            </svg>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Max Bid Value</span>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{teams.length} teams</span>
                    </div>

                    {/* Team list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                        {sortedTeams.map((team, i) => {
                            const isWinner = team.id === auctionState?.current_team_id
                            return (
                                <div key={team.id}
                                    className={`rounded-xl border p-3 transition-all duration-200 ${isWinner
                                        ? 'bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100'
                                        : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-full border-2 border-white shadow-sm bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {team.logo_url
                                                ? <Image src={team.logo_url} alt={team.name} width={36} height={36} className="w-full h-full object-contain" unoptimized />
                                                : <span className="text-[9px] font-black text-slate-500">{team.acronym}</span>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 justify-between">
                                                <p className="text-xs font-bold text-slate-800 truncate leading-tight">{team.name}</p>
                                                <span className="text-[9px] font-black text-slate-300 shrink-0">#{i + 1}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${TEAM_DOT_COLORS[i % TEAM_DOT_COLORS.length]}`} />
                                                <span className="text-[10px] text-slate-500">{team.player_count ?? 0} players</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-200/60">
                                        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">MBV</span>
                                        <span className={`text-sm font-bold ${isWinner ? 'text-emerald-600' : 'text-emerald-500'}`}>{fmt(getMBV(team))}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Wallet</span>
                                        <span className="text-[10px] font-medium text-slate-500">{fmt(team.wallet_balance)}</span>
                                    </div>
                                    {isWinner && (
                                        <div className="mt-1.5">
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                ● Highest Bidder
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Footer time */}
                    <div className="px-4 py-2 border-t border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400">Updated {lastRefresh.toLocaleTimeString('en-IN', { hour12: false })}</p>
                    </div>
                </aside>

                {/* ══ CENTER PANEL — Current Player ══ */}
                <main className="flex-1 flex flex-col overflow-hidden">

                    {/* Center top bar */}
                    <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M1 21h12v2H1zM5.245 8.07l2.83-2.827 14.14 14.142-2.828 2.828zM12.317 1l5.657 5.656-2.83 2.83-5.654-5.66zM3.825 9.514l5.657 5.657-2.828 2.828-5.657-5.657z" />
                            </svg>
                            <div>
                                <h1 className="font-bold text-slate-900 text-sm">Live Auction</h1>
                                <p className="text-[10px] text-slate-400">{sold.length} players sold · auto-refreshing</p>
                            </div>
                        </div>

                        {isLive ? (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-3 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    LIVE
                                </span>
                                {auctionState && (
                                    <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200">
                                        {countdown}
                                    </span>
                                )}
                            </div>
                        ) : auctionState?.current_player_id ? (
                            <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-600 text-xs font-bold px-3 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                PAUSED
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold px-3 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                Offline
                            </span>
                        )}
                    </div>

                    {/* Player spotlight */}
                    <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
                        {!isLive && !auctionState?.current_player_id ? (
                            <div className="flex flex-col items-center justify-center gap-6 text-center max-w-sm">
                                <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                                    <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-700">Auction Not Live</h2>
                                    <p className="text-slate-400 text-sm mt-2">Waiting for the admin to start the auction…</p>
                                </div>
                            </div>
                        ) : !player ? (
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-emerald-500 animate-spin" />
                                <div>
                                    <h2 className="text-xl font-bold text-slate-700">Selecting Next Player</h2>
                                    <p className="text-slate-400 text-sm mt-1">Admin is choosing next player…</p>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full max-w-3xl">
                                {/* Player card */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                                    {/* Gradient bar based on role */}
                                    <div className={`h-2 w-full bg-gradient-to-r ${ROLE_BG[player.role] ?? 'from-slate-400 to-slate-600'}`} />

                                    <div className="p-8 flex gap-8">
                                        {/* Player photo */}
                                        <div className="flex-shrink-0">
                                            <div className="w-44 h-52 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-lg bg-slate-100 relative">
                                                {player.photo_url
                                                    ? <Image src={normalizePhotoUrl(player.photo_url) ?? player.photo_url} alt={player.name} width={176} height={208} className="w-full h-full object-cover" unoptimized />
                                                    : <div className="w-full h-full flex items-center justify-center">
                                                        <span className="text-8xl font-black text-slate-200">{player.name.charAt(0)}</span>
                                                    </div>
                                                }
                                                {/* Role badge on photo */}
                                                <div className={`absolute bottom-2 left-2 right-2 text-center py-1 rounded-lg text-[10px] font-bold border ${ROLE_STYLES[player.role]}`}>
                                                    {player.role}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Player details */}
                                        <div className="flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h2 className="text-4xl font-black text-slate-900 leading-tight">{player.name}</h2>
                                                        {player.place && (
                                                            <div className="flex items-center gap-1.5 mt-1.5 text-slate-500">
                                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" /></svg>
                                                                <span className="text-sm font-medium">{player.place}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
                                                        Base: <span className="text-slate-700 font-bold">{fmt(basePrice)}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Bid section */}
                                            <div className="space-y-4">
                                                {/* Current bid hero */}
                                                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                                                    <div className="flex-shrink-0">
                                                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Current Bid</p>
                                                        <p className="text-4xl lg:text-5xl font-black text-emerald-600 leading-none truncate">{fmt(auctionState?.current_bid ?? 0)}</p>
                                                    </div>
                                                    <div className="text-right min-w-0 flex flex-col items-end">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Highest Bidder</p>
                                                        {currentTeam ? (
                                                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm max-w-[200px] lg:max-w-[240px]">
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                                                                    {currentTeam.logo_url
                                                                        ? <Image src={currentTeam.logo_url} alt={currentTeam.name} width={32} height={32} className="w-full h-full object-contain" unoptimized />
                                                                        : <span className="text-[8px] font-black text-slate-500 flex items-center justify-center h-full">{currentTeam.acronym}</span>
                                                                    }
                                                                </div>
                                                                <span className="font-bold text-sm text-slate-800 truncate" title={currentTeam.name}>{currentTeam.name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-sm italic">No bids yet</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Increment + countdown */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] text-slate-400 font-semibold uppercase">Increment</p>
                                                            <p className="font-bold text-slate-800">{fmt(increment)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-4 h-4 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] text-slate-400 font-semibold uppercase">Countdown</p>
                                                            <p className="font-bold text-orange-600">{isLive ? countdown : 'Paused'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="flex gap-2">
                                                    {COUNTDOWN_STEPS.map((s, i) => (
                                                        <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${isLive && countdownIdx >= i ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {/* ══ RIGHT PANEL — Bid History + Recently Sold ══ */}
                <aside className="w-72 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">

                    {/* Live Bid History */}
                    <div className="flex flex-col" style={{ height: '55%' }}>
                        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M1 21h12v2H1zM5.245 8.07l2.83-2.827 14.14 14.142-2.828 2.828zM12.317 1l5.657 5.656-2.83 2.83-5.654-5.66zM3.825 9.514l5.657 5.657-2.828 2.828-5.657-5.657z" />
                                </svg>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Bid History</span>
                            </div>
                            {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ scrollbarWidth: 'thin' }}>
                            {recentBids.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                    <p className="text-slate-400 text-xs">No bids yet</p>
                                </div>
                            ) : recentBids.map((s, i) => (
                                <div key={`${s.id}-${i}`}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${i === 0 ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-slate-50'}`}>
                                    <div>
                                        <p className={`font-bold text-xs ${i === 0 ? 'text-emerald-800' : 'text-slate-800'}`}>{s.teams?.name ?? '—'}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(s.sold_at)}</p>
                                    </div>
                                    <span className={`font-black text-sm ${i === 0 ? 'text-emerald-600' : 'text-emerald-500'}`}>{fmt(s.sold_price)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-2 border-t border-slate-100 text-center flex-shrink-0">
                            <p className="text-[10px] text-slate-400">Auto-refreshing every 3s</p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-200" />

                    {/* Recently Sold */}
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
                            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V18H9v2h6v-2h-2v-2.1a5.01 5.01 0 003.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zm-2 3c0 1.65-1.35 3-3 3s-3-1.35-3-3V5h6v3zM5 8V7h2v3.82C5.84 10.4 5 9.29 5 8zm14 0c0 1.29-.84 2.4-2 2.82V7h2v1z" />
                            </svg>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recently Sold</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                            {recentSold.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                    <p className="text-slate-400 text-xs">No sales yet</p>
                                </div>
                            ) : recentSold.map((s, i) => (
                                <div key={`sold-${s.id}-${i}`}
                                    className={`p-3 rounded-xl border ${i === 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-xs text-slate-900 leading-tight">{s.players?.name ?? '—'}</p>
                                        <p className={`font-black text-xs ml-2 flex-shrink-0 ${i === 0 ? 'text-amber-600' : 'text-orange-500'}`}>{fmt(s.sold_price)}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        {s.players?.role && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${ROLE_STYLES[s.players.role]}`}>
                                                {s.players.role}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-500">{s.teams?.name ?? '—'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    )
}
