'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

import { ClientOnly } from '@/components/ClientOnly'
import { postJson } from '@/lib/apiClient'
import { normalizePhotoUrl } from '@/lib/photoUrl'
import { decodeObject } from '@/lib/decode'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Role = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper'
type PlayerStatus = 'Available' | 'Live' | 'Sold' | 'Unsold'

const ROLE_COLORS: Record<Role, string> = {
    Batsman: 'bg-blue-100 text-blue-700 border-blue-200',
    Bowler: 'bg-orange-100 text-orange-700 border-orange-200',
    'All-Rounder': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Wicket-Keeper': 'bg-violet-100 text-violet-700 border-violet-200',
}

interface BidTier {
    from: number
    to: number     // 999_999_999 = infinity
    increment: number
}

interface AuctionSettings {
    id: string
    auction_name: string
    base_price: number
    min_squad_size: number
    bid_tiers: BidTier[]
}

interface AuctionState {
    id: string
    current_player_id: string | null
    current_bid: number
    current_team_id: string | null
    is_live: boolean
}

interface Player {
    id: string
    name: string
    role: Role
    place?: string
    photo_url?: string
    is_sold: boolean
    status?: PlayerStatus
}

interface Team {
    id: string
    name: string
    acronym: string
    logo_url?: string
    wallet_balance: number
    player_count?: number
}

interface PlayerStats {
    sold: number
    unsold: number
    available: number
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmt(val: number) {
    if (val >= 10_000_000) return `â‚¹${(val / 10_000_000).toFixed(2)} Cr`
    if (val >= 100_000) return `â‚¹${(val / 100_000).toFixed(1)} L`
    return `â‚¹${val.toLocaleString('en-IN')}`
}

// Removed hardcoded bidIncrement

// â”€â”€â”€ Inline Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TrendingUp = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
)
const TrendingDown = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
    </svg>
)
const Check = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
)
const XIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
)
const SkipForward = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7M18 5v14" />
    </svg>
)
const DollarSign = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)
const Pause = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)
const Play = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AdminPage() {
    return (
        <ClientOnly fallback={
            <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-slate-50">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <AdminContent />
        </ClientOnly>
    )
}

function AdminContent() {
    const [auctionState, setAuctionState] = useState<AuctionState | null>(null)
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
    const [stats, setStats] = useState<PlayerStats>({ sold: 0, unsold: 0, available: 0 })
    const [settings, setSettings] = useState<AuctionSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const toastRef = useRef<NodeJS.Timeout | null>(null)

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type })
        if (toastRef.current) clearTimeout(toastRef.current)
        toastRef.current = setTimeout(() => setToast(null), 3500)
    }

    const fetchAll = useCallback(async () => {
        try {
            const response = await fetch('/api/auction?view=admin', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as
                | {
                    data?: {
                        auctionState?: AuctionState | null
                        settings?: AuctionSettings | null
                        currentPlayer?: Player | null
                        teams?: Team[]
                        availablePlayers?: Player[]
                        stats?: PlayerStats
                    }
                    error?: string
                }
                | null
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to load admin auction data.')
            }

            const decodedData = decodeObject(payload?.data)

            setAuctionState(decodedData?.auctionState ?? null)
            setSettings(decodedData?.settings ?? null)
            setCurrentPlayer(decodedData?.currentPlayer ?? null)
            setTeams(
                (decodedData?.teams ?? []).map((team) => ({
                    ...team,
                    wallet_balance: team.wallet_balance ?? 0,
                    player_count: team.player_count ?? 0,
                })),
            )
            setAvailablePlayers(decodedData?.availablePlayers ?? [])
            setStats(
                decodedData?.stats ?? {
                    sold: 0,
                    unsold: 0,
                    available: 0,
                },
            )
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to load admin auction data.', 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const runFetch = () => {
            void fetchAll()
        }
        const kickoff = window.setTimeout(runFetch, 0)
        intervalRef.current = setInterval(runFetch, 20000)
        return () => {
            window.clearTimeout(kickoff)
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (toastRef.current) clearTimeout(toastRef.current)
        }
    }, [fetchAll])

    const callAuction = async (action: string, payload?: Record<string, unknown>) => {
        return postJson<{ data: unknown }>('/api/auction', { action, payload })
    }

    const handleBidUp = async () => {
        if (!auctionState?.current_team_id) {
            showToast('Select a team before increasing the bid.', 'error')
            return
        }
        setBusy('bid-up')
        try {
            await callAuction('place_bid', { teamId: auctionState.current_team_id })
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to increase bid.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleBidDown = async () => {
        setBusy('bid-down')
        try {
            await callAuction('adjust_bid', { direction: 'down' })
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to decrease bid.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleToggleLive = async () => {
        setBusy('live')
        try {
            await callAuction('toggle_live')
            await fetchAll()
            showToast((auctionState?.is_live ?? false) ? 'Auction paused' : 'Auction is LIVE')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to toggle auction state.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleSold = async () => {
        if (!auctionState?.current_player_id || !auctionState.current_team_id) {
            showToast('Select a winning team first', 'error')
            return
        }
        setBusy('sold')
        try {
            await callAuction('sell_player')
            showToast(`${currentPlayer?.name ?? 'Player'} sold successfully`)
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to mark player sold.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleUnsold = async () => {
        if (!auctionState?.current_player_id) return
        setBusy('unsold')
        try {
            await callAuction('mark_unsold')
            showToast(`${currentPlayer?.name ?? 'Player'} marked unsold`)
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to mark player unsold.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleNextPlayer = async () => {
        const next = availablePlayers.find((player) => player.id !== auctionState?.current_player_id)
        if (!next) {
            showToast('No more players', 'error')
            return
        }
        setBusy('next')
        try {
            await callAuction('set_current_player', { playerId: next.id, isLive: auctionState?.is_live ?? true })
            showToast(`Now: ${next.name}`)
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to select next player.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleSelectPlayer = async (playerId: string) => {
        if (!playerId) return
        setBusy('next')
        try {
            await callAuction('set_current_player', { playerId, isLive: auctionState?.is_live ?? true })
            const nextPlayer = availablePlayers.find((player) => player.id === playerId)
            showToast(`Now: ${nextPlayer?.name ?? 'Selected player'}`)
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to select player.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleSelectTeam = async (teamId: string) => {
        if (!auctionState?.current_player_id) return
        setBusy('bid-up')
        try {
            await callAuction('place_bid', { teamId })
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to place bid.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleStartAuction = async () => {
        if (availablePlayers.length === 0) {
            showToast('No available players to auction', 'error')
            return
        }
        setBusy('start')
        try {
            await callAuction('start_random_player')
            showToast('Auction started')
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start auction.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleEndAuction = async () => {
        if (!window.confirm('End the auction session? This will clear the current player and go offline.')) return
        setBusy('end')
        try {
            await callAuction('end_auction')
            showToast('Auction session ended')
            await fetchAll()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to end auction.'
            showToast(message, 'error')
        } finally {
            setBusy(null)
        }
    }

    const isLive = auctionState?.is_live ?? false
    const winningTeam = teams.find(t => t.id === auctionState?.current_team_id)
    const activeTeams = teams.filter(t => t.wallet_balance > 0)
    const auctionNotStarted = !isLive && !auctionState?.current_player_id

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-slate-50 gap-3">
                <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Loading admin panelâ€¦</p>
            </div>
        )
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-100 p-4 md:p-6 relative">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border text-sm font-semibold shadow-xl ${toast.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-red-50 border-red-300 text-red-800'
                    }`}>
                    {toast.msg}
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-4">

                {/* â”€â”€ Start Auction Banner (shown when not started) â”€â”€ */}
                {auctionNotStarted && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-bold text-white">Ready to Start?</p>
                                <p className="text-emerald-100 text-xs">{availablePlayers.length} players available Â· Click to go live</p>
                            </div>
                        </div>
                        <button onClick={handleStartAuction}
                            disabled={!!busy || availablePlayers.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-emerald-50 disabled:opacity-50 text-emerald-700 font-bold rounded-xl transition-all text-sm shadow-sm">
                            {busy === 'start'
                                ? <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" /></svg>
                            }
                            Start Auction
                        </button>
                    </div>
                )}

                {/* â”€â”€ Auction Status Banner (shown when a player is active) â”€â”€ */}
                {auctionState?.current_player_id && (
                    <div className={`flex items-center justify-between p-3 border rounded-2xl ${isLive ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center gap-2">
                            {isLive ? (
                                <>
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                                    </span>
                                    <p className="text-sm font-semibold text-rose-700">Auction is LIVE</p>
                                </>
                            ) : (
                                <>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                                    <p className="text-sm font-semibold text-amber-700">Auction is PAUSED</p>
                                </>
                            )}
                            <span className={`text-xs ${isLive ? 'text-rose-400' : 'text-amber-500'}`}>{availablePlayers.length} players remaining</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleToggleLive} disabled={busy === 'live'}
                                className={`flex items-center gap-1.5 px-4 py-1.5 ${isLive ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'} disabled:opacity-50 text-xs font-semibold rounded-lg transition-all`}>
                                {busy === 'live' ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (isLive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />)}
                                {isLive ? 'Pause Auction' : 'Resume Auction'}
                            </button>
                            <button onClick={handleEndAuction} disabled={busy === 'end'}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all">
                                {busy === 'end' ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                                End Auction
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

                    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              LEFT â€” Teams Bidding + Controls
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                    <div className="lg:col-span-8 space-y-4 md:space-y-6">
                        <div className="p-4 md:p-6 bg-white shadow-sm rounded-2xl border border-slate-200">

                            {/* Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-emerald-600" />
                                    <h2 className="text-lg font-semibold text-slate-900">Teams Bidding</h2>
                                </div>
                                <span className="text-sm text-slate-500">{activeTeams.length} Active</span>
                            </div>

                            {/* Teams Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                                {teams.map(team => {
                                    const isWinner = team.id === auctionState?.current_team_id
                                    const teamMBV = team.wallet_balance - Math.max(0, (settings?.min_squad_size ?? 0) - (team.player_count ?? 0) - 1) * (settings?.base_price ?? 0)
                                    const currentBid = auctionState?.current_bid ?? 0
                                    const isMaxReached = currentBid >= teamMBV
                                    const isSquadFull = (team.player_count ?? 0) >= (settings?.min_squad_size ?? 0)
                                    const disableClick = currentBid > teamMBV || isSquadFull

                                    return (
                                        <button key={team.id} onClick={() => handleSelectTeam(team.id)}
                                            disabled={disableClick}
                                            className={`p-3 rounded-xl border text-left transition-all ${isMaxReached || isSquadFull
                                                ? 'bg-red-50 border-red-300 ring-2 ring-red-500'
                                                : isWinner
                                                    ? 'bg-emerald-50 border-emerald-300 shadow-sm ring-1 ring-emerald-300'
                                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                } ${disableClick ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                            {/* Team logo + name */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {team.logo_url
                                                        ? <Image src={team.logo_url} alt={team.name} width={32} height={32} className="w-full h-full object-contain" unoptimized />
                                                        : <span className="text-[10px] font-black text-slate-500">{team.acronym}</span>
                                                    }
                                                </div>
                                                <p className="text-xs font-semibold text-slate-900 truncate">{team.name}</p>
                                            </div>
                                            {/* Wallet & MBV */}
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[10px] text-slate-400 font-semibold uppercase">MBV:</span>
                                                <span className={`text-xs font-bold ${isWinner ? 'text-emerald-600' : 'text-emerald-600'}`}>
                                                    {fmt(
                                                        team.wallet_balance -
                                                        Math.max(0, (settings?.min_squad_size ?? 0) - (team.player_count ?? 0) - 1) * (settings?.base_price ?? 0)
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Wallet:</span>
                                                <span className="text-[10px] font-medium text-slate-500">
                                                    {fmt(team.wallet_balance)}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {isWinner && (
                                                    <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full">
                                                        Leading
                                                    </span>
                                                )}
                                                {isMaxReached && !isSquadFull && (
                                                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full">
                                                        Max Bid Reached
                                                    </span>
                                                )}
                                                {isSquadFull && (
                                                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full">
                                                        Squad Full
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Bid Controls */}
                            <div className="pt-5 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-700 mb-3">Bid Controls</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={handleBidUp} disabled={!!busy}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-medium shadow-sm shadow-emerald-200 transition-all text-sm">
                                        {busy === 'bid-up'
                                            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            : <TrendingUp className="w-4 h-4" />
                                        }
                                        Bid Up
                                    </button>
                                    <button onClick={handleBidDown} disabled={!!busy || (auctionState?.current_bid ?? 0) <= 0}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-medium shadow-sm transition-all text-sm">
                                        {busy === 'bid-down'
                                            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            : <TrendingDown className="w-4 h-4" />
                                        }
                                        Bid Down
                                    </button>
                                    <button onClick={handleToggleLive} disabled={busy === 'live'}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium border-2 transition-all text-sm ${isLive
                                            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                                            : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                            }`}>
                                        {busy === 'live'
                                            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            : isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />
                                        }
                                        {isLive ? 'Pause Auction' : 'Resume Auction'}
                                    </button>
                                </div>
                            </div>

                            {/* Player Stats */}
                            <div className="pt-5 mt-1 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-700 mb-3">Player Stats</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-200">
                                        <p className="text-xs text-slate-500 mb-1">Sold Players</p>
                                        <p className="text-2xl font-bold text-emerald-600">{stats.sold}</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">Unsold Players</p>
                                        <p className="text-2xl font-bold text-slate-600">{stats.unsold}</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200">
                                        <p className="text-xs text-slate-500 mb-1">Available Players</p>
                                        <p className="text-2xl font-bold text-blue-600">{stats.available}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
              RIGHT â€” Player + Bid + Actions
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                    <div className="lg:col-span-4">
                        <div className="p-4 md:p-6 bg-white shadow-sm rounded-2xl border border-slate-200 sticky top-6">

                            {!currentPlayer ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                                        <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">No Active Auction</p>
                                        <p className="text-sm text-slate-500 mt-0.5">Select a player to begin</p>
                                    </div>

                                    <div className="w-full space-y-3">
                                        <select
                                            onChange={(e) => handleSelectPlayer(e.target.value)}
                                            defaultValue=""
                                            disabled={!!busy || availablePlayers.length === 0}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        >
                                            <option value="" disabled>Search & Select Player...</option>
                                            {availablePlayers.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                                            ))}
                                        </select>

                                        <div className="relative flex items-center py-2">
                                            <div className="flex-grow border-t border-slate-200"></div>
                                            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase">OR</span>
                                            <div className="flex-grow border-t border-slate-200"></div>
                                        </div>

                                        <button onClick={handleNextPlayer} disabled={busy === 'next' || availablePlayers.length === 0}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-all">
                                            {busy === 'next' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SkipForward className="w-4 h-4" />}
                                            Pick Next Available
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">

                                    {/* Player Info */}
                                    <div className="relative flex items-start gap-4 p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
                                        {/* Live badge */}
                                        {isLive && (
                                            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-rose-100 border border-rose-200 rounded-full">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                <span className="text-xs font-bold text-rose-600">Live</span>
                                            </div>
                                        )}

                                        {/* Photo */}
                                        <div className="w-24 h-28 rounded-xl overflow-hidden ring-2 ring-slate-200 shadow-md flex-shrink-0 bg-slate-100">
                                            {currentPlayer.photo_url
                                                ? <Image src={normalizePhotoUrl(currentPlayer.photo_url) ?? currentPlayer.photo_url} alt={currentPlayer.name} width={96} height={112}
                                                    className="w-full h-full object-cover" unoptimized />
                                                : <div className="w-full h-full flex items-center justify-center">
                                                    <span className="text-3xl font-black text-slate-400">{currentPlayer.name.charAt(0)}</span>
                                                </div>
                                            }
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0 pr-8">
                                            <h3 className="text-lg font-semibold text-slate-900 leading-tight">{currentPlayer.name}</h3>
                                            {currentPlayer.place && (
                                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                                    <span>ðŸ´</span>{currentPlayer.place}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${ROLE_COLORS[currentPlayer.role]}`}>
                                                    â­ {currentPlayer.role}
                                                </span>
                                                <p className="text-xs text-slate-500">
                                                    Base: <span className="font-semibold text-slate-800">{fmt(settings?.base_price || 0)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Current Bid */}
                                    <div className="p-5 bg-gradient-to-br from-emerald-50 to-white rounded-xl border-2 border-emerald-200">
                                        <div className="text-center mb-4">
                                            <p className="text-xs text-slate-500 font-medium mb-1">Current Bid</p>
                                            <p className="text-4xl font-bold text-emerald-600">{fmt(auctionState?.current_bid ?? 0)}</p>
                                        </div>

                                        {/* Highest Bidder */}
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                                            <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {winningTeam?.logo_url
                                                    ? <Image src={winningTeam.logo_url} alt={winningTeam.name} width={44} height={44} className="w-full h-full object-contain" unoptimized />
                                                    : <span className="text-xs font-black text-slate-500">{winningTeam?.acronym ?? 'â€”'}</span>
                                                }
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-0.5">Highest Bidder</p>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {winningTeam?.name ?? <span className="text-slate-400 font-normal">No bids yet</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sold / Unsold */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={handleSold} disabled={!!busy || !auctionState?.current_team_id}
                                            className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-sm shadow-emerald-200 transition-all text-sm">
                                            {busy === 'sold' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                                            Sold
                                        </button>
                                        <button onClick={handleUnsold} disabled={!!busy}
                                            className="flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-medium shadow-sm transition-all text-sm">
                                            {busy === 'unsold' ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <XIcon className="w-4 h-4" />}
                                            Unsold
                                        </button>
                                    </div>

                                    {/* Next Player */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-slate-700">Select Next Player</p>
                                        </div>
                                        <select
                                            onChange={(e) => {
                                                handleSelectPlayer(e.target.value);
                                                e.target.value = ""; // reset after selection
                                            }}
                                            defaultValue=""
                                            disabled={!!busy || availablePlayers.length <= 1}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                                        >
                                            <option value="" disabled>Specific Player...</option>
                                            {availablePlayers.filter(p => p.id !== currentPlayer.id).map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                                            ))}
                                        </select>
                                        <button onClick={handleNextPlayer} disabled={!!busy || availablePlayers.length <= 1}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-xl font-medium border-2 border-slate-200 transition-all text-sm">
                                            {busy === 'next' ? <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" /> : <SkipForward className="w-4 h-4" />}
                                            Pick Next Available
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
