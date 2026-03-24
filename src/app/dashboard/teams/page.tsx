'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ClientOnly } from '@/components/ClientOnly'
import { postJson } from '@/lib/apiClient'
import { getErrorMessage } from '@/lib/errors'
import { normalizePhotoUrl } from '@/lib/photoUrl'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
    id: string
    name: string
    acronym: string
    logo_url?: string
    wallet_balance: number
    total_budget?: number
}

interface SoldPlayer {
    id: string
    player_id: string
    sold_price: number
    team_id: string
    players: { id: string; name: string; role: string; photo_url?: string } | null
}

interface TeamWithPlayers extends Team {
    soldPlayers: SoldPlayer[]
    spent: number
}

function fmt(val: number) {
    if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(2)} Cr`
    if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)} L`
    return `₹${val.toLocaleString('en-IN')}`
}

const ROLE_COLORS: Record<string, string> = {
    Batsman: 'bg-blue-100 text-blue-700 border-blue-200',
    Bowler: 'bg-orange-100 text-orange-700 border-orange-200',
    'All-Rounder': 'bg-purple-100 text-purple-700 border-purple-200',
    'Wicket-Keeper': 'bg-teal-100 text-teal-700 border-teal-200',
}

const TEAM_GRADIENTS = [
    'from-blue-500 to-blue-700',
    'from-red-500 to-red-700',
    'from-amber-500 to-amber-600',
    'from-emerald-500 to-emerald-700',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-violet-700',
    'from-orange-500 to-orange-700',
    'from-teal-500 to-cyan-700',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
    return (
        <ClientOnly fallback={
            <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-[#f8fafc]">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <TeamsContent />
        </ClientOnly>
    )
}

function TeamsContent() {
    const [teams, setTeams] = useState<TeamWithPlayers[]>([])
    const [loading, setLoading] = useState(true)
    const [actionError, setActionError] = useState<string | null>(null)
    const [minSquadSize, setMinSquadSize] = useState<number>(11)
    const [basePrice, setBasePrice] = useState<number>(0)
    const [viewSquadTeam, setViewSquadTeam] = useState<TeamWithPlayers | null>(null)
    const [editingPlayer, setEditingPlayer] = useState<SoldPlayer | null>(null)
    const [editBusy, setEditBusy] = useState(false)
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch('/api/teams?view=dashboard', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as
                | {
                    data?: {
                        teams?: Team[]
                        soldPlayers?: SoldPlayer[]
                        settings?: { min_squad_size?: number; base_price?: number } | null
                    }
                    error?: string
                }
                | null
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to load teams dashboard')
            }

            if (typeof payload?.data?.settings?.min_squad_size === 'number') {
                setMinSquadSize(payload.data.settings.min_squad_size)
            }
            if (typeof payload?.data?.settings?.base_price === 'number') {
                setBasePrice(payload.data.settings.base_price)
            }

            const soldList = (payload?.data?.soldPlayers ?? []) as SoldPlayer[]
            const teamsList = (payload?.data?.teams ?? []) as Team[]
            const enriched: TeamWithPlayers[] = teamsList.map((team) => {
                const teamSold = soldList.filter((soldItem) => soldItem.team_id === team.id)
                const spent = teamSold.reduce((sum, soldItem) => sum + soldItem.sold_price, 0)
                return {
                    ...team,
                    wallet_balance: team.wallet_balance ?? 0,
                    total_budget: (team.wallet_balance ?? 0) + spent,
                    soldPlayers: teamSold,
                    spent,
                }
            })
            setTeams(enriched)
        } catch (error) {
            setActionError(getErrorMessage(error, 'Failed to load teams dashboard.'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const runFetch = () => {
            void fetchData()
        }
        const kickoff = window.setTimeout(runFetch, 0)
        refreshIntervalRef.current = setInterval(runFetch, 20000)
        return () => {
            window.clearTimeout(kickoff)
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current)
            }
        }
    }, [fetchData])

    const totalBudget = teams.reduce((s, t) => s + (t.total_budget ?? 0), 0)
    const totalSpent = teams.reduce((s, t) => s + t.spent, 0)
    const totalPlayers = teams.reduce((s, t) => s + t.soldPlayers.length, 0)
    const remainingPurse = totalBudget - totalSpent

    const getMBV = (team: TeamWithPlayers) => {
        const spotsLeft = minSquadSize - team.soldPlayers.length
        return spotsLeft > 1 ? Math.max(0, team.wallet_balance - (spotsLeft - 1) * basePrice) : team.wallet_balance
    }

    const handleRemovePlayer = async (sp: SoldPlayer) => {
        if (!confirm('Remove player and return to available pool? Team wallet will be refunded.')) return
        setActionError(null)
        setEditBusy(true)
        try {
            await postJson('/api/auction', {
                action: 'remove_sale',
                payload: { soldPlayerId: sp.id },
            })
            setEditingPlayer(null)
            void fetchData()
        } catch (error) {
            setActionError(getErrorMessage(error, 'Failed to remove player.'))
        }
        setEditBusy(false)
    }

    const handleUpdatePrice = async (sp: SoldPlayer, newPrice: number) => {
        if (newPrice < 0) {
            setActionError('Price cannot be negative.')
            return
        }
        setActionError(null)
        setEditBusy(true)
        try {
            await postJson('/api/auction', {
                action: 'update_sale_price',
                payload: { soldPlayerId: sp.id, newPrice },
            })
            setEditingPlayer(null)
            void fetchData()
        } catch (error) {
            setActionError(getErrorMessage(error, 'Failed to update player price.'))
        }
        setEditBusy(false)
    }

    const handleTransfer = async (sp: SoldPlayer, newTeamId: string) => {
        if (!newTeamId) return
        setActionError(null)
        setEditBusy(true)
        try {
            await postJson('/api/auction', {
                action: 'transfer_player',
                payload: { soldPlayerId: sp.id, newTeamId },
            })
            setEditingPlayer(null)
            void fetchData()
        } catch (error) {
            setActionError(getErrorMessage(error, 'Failed to transfer player.'))
        }
        setEditBusy(false)
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-[#f8fafc] gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading teams…</p>
        </div>
    )

    return (
        <>
            <div className="min-h-[calc(100vh-64px)] bg-[#f1f5f9] flex flex-col">
                {actionError && (
                    <div className="mx-auto mt-4 w-full max-w-[1600px] px-6">
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                            {actionError}
                        </div>
                    </div>
                )}

                {/* ── Top Stats Bar ── */}
                <div className="bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-6">
                        <div>
                            <h1 className="text-slate-900 font-bold text-lg leading-tight">Teams Overview</h1>
                            <p className="text-slate-400 text-xs">{teams.length} franchises · auto-refreshing</p>
                        </div>

                        <div className="flex items-center gap-1">
                            {[
                                { label: 'Teams', value: String(teams.length), color: 'text-slate-800' },
                                { label: 'Players Sold', value: String(totalPlayers), color: 'text-blue-600' },
                                { label: 'Total Budget', value: fmt(totalBudget), color: 'text-slate-700' },
                                { label: 'Total Spent', value: fmt(totalSpent), color: 'text-orange-500' },
                                { label: 'Remaining', value: fmt(remainingPurse), color: 'text-emerald-600' },
                            ].map((s, idx) => (
                                <div key={s.label} className="flex items-center gap-1">
                                    {idx > 0 && <div className="w-px h-7 bg-slate-200 mx-2" />}
                                    <div className="text-center px-2">
                                        <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                                        <p className="text-[10px] text-slate-400">{s.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-700 text-xs font-semibold">Live</span>
                        </div>
                    </div>
                </div>

                {/* ── Team Grid ── */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-[1600px] mx-auto px-6 py-5">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {teams.map((team, i) => {
                                const gradient = TEAM_GRADIENTS[i % TEAM_GRADIENTS.length]
                                const pct = team.total_budget ? Math.round((team.spent / team.total_budget) * 100) : 0
                                const mbv = getMBV(team)
                                const spotsLeft = minSquadSize - team.soldPlayers.length

                                return (
                                    <div key={team.id}
                                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                                    >
                                        {/* Team gradient header */}
                                        <div className={`bg-gradient-to-r ${gradient} p-4 relative overflow-hidden`}>
                                            <div className="absolute inset-0 bg-black/10" />
                                            <div className="relative flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-xl bg-white/25 border border-white/30 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
                                                    {team.logo_url
                                                        ? <Image src={team.logo_url} alt={team.name} width={44} height={44} className="w-full h-full object-contain" unoptimized />
                                                        : <span className="text-sm font-black text-white">{team.acronym}</span>
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-white text-sm leading-tight truncate">{team.name}</h3>
                                                    <p className="text-white/70 text-[10px] mt-0.5">{team.soldPlayers.length} / {minSquadSize} players</p>
                                                </div>
                                                {/* Percentage badge */}
                                                <div className="flex-shrink-0 bg-black/20 backdrop-blur-sm border border-white/20 rounded-full px-2 py-0.5">
                                                    <span className="text-[10px] font-bold text-white">{pct}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card body */}
                                        <div className="p-4 space-y-3">

                                            {/* Purse row */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Purse</p>
                                                    <p className="text-lg font-bold text-emerald-600 leading-tight">{fmt(team.wallet_balance)}</p>
                                                    <p className="text-[9px] text-amber-600 font-semibold mt-0.5">
                                                        MBV <span className="font-bold">{fmt(mbv)}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">Spent</p>
                                                    <p className="text-base font-bold text-orange-500 leading-tight">{fmt(team.spent)}</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">{spotsLeft} spots left</p>
                                                </div>
                                            </div>

                                            {/* Budget bar */}
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-700`}
                                                    style={{ width: `${Math.min(pct, 100)}%` }} />
                                            </div>

                                            {/* Role pills */}
                                            <div className="flex gap-1 flex-wrap">
                                                {(['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'] as const).map(role => {
                                                    const clean = (s: string) => (s || '').toLowerCase().replace(/[-_ ]/g, '')
                                                    const count = team.soldPlayers.filter(sp => clean(sp.players?.role || '') === clean(role)).length
                                                    const short = { Batsman: 'BAT', Bowler: 'BOWL', 'All-Rounder': 'AR', 'Wicket-Keeper': 'WK' }[role]
                                                    return (
                                                        <span key={role} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ROLE_COLORS[role] ?? ''}`}>
                                                            {short} {count}
                                                        </span>
                                                    )
                                                })}
                                            </div>

                                            {/* View Squad button */}
                                            <button
                                                onClick={() => setViewSquadTeam(team)}
                                                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl py-2 transition-all">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                View Squad {team.soldPlayers.length > 0 ? `(${team.soldPlayers.length})` : ''}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════ SQUAD MODAL ══════════ */}
            {viewSquadTeam && (() => {
                const idx = teams.indexOf(viewSquadTeam)
                const gradient = TEAM_GRADIENTS[idx >= 0 ? idx % TEAM_GRADIENTS.length : 0]
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewSquadTeam(null)}>
                        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

                        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

                            {/* Modal header */}
                            <div className={`bg-gradient-to-r ${gradient} p-5 relative overflow-hidden`}>
                                <div className="absolute inset-0 bg-black/15" />
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/25 border border-white/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {viewSquadTeam.logo_url
                                                ? <Image src={viewSquadTeam.logo_url} alt={viewSquadTeam.name} width={48} height={48} className="w-full h-full object-contain" unoptimized />
                                                : <span className="text-base font-black text-white">{viewSquadTeam.acronym}</span>
                                            }
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg leading-tight">{viewSquadTeam.name}</h3>
                                            <p className="text-white/70 text-xs mt-0.5">{viewSquadTeam.soldPlayers.length} / {minSquadSize} players acquired</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setViewSquadTeam(null)}
                                        className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center transition-colors border border-white/20">
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Stats row */}
                                <div className="relative flex items-center gap-4 mt-4 pt-3 border-t border-white/20">
                                    <div>
                                        <p className="text-white/60 text-[9px] uppercase tracking-widest font-semibold">Purse</p>
                                        <p className="text-white font-bold text-sm">{fmt(viewSquadTeam.wallet_balance)}</p>
                                    </div>
                                    <div className="w-px h-7 bg-white/20" />
                                    <div>
                                        <p className="text-white/60 text-[9px] uppercase tracking-widest font-semibold">Spent</p>
                                        <p className="text-white font-bold text-sm">{fmt(viewSquadTeam.spent)}</p>
                                    </div>
                                    <div className="w-px h-7 bg-white/20" />
                                    <div>
                                        <p className="text-white/60 text-[9px] uppercase tracking-widest font-semibold">MBV</p>
                                        <p className="text-white font-bold text-sm">{fmt(getMBV(viewSquadTeam))}</p>
                                    </div>
                                    <div className="ml-auto flex gap-1 flex-wrap">
                                        {(['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'] as const).map(role => {
                                            const clean = (s: string) => (s || '').toLowerCase().replace(/[-_ ]/g, '')
                                            const count = viewSquadTeam.soldPlayers.filter(sp => clean(sp.players?.role || '') === clean(role)).length
                                            const short = { Batsman: 'BAT', Bowler: 'BOWL', 'All-Rounder': 'AR', 'Wicket-Keeper': 'WK' }[role]
                                            return (
                                                <span key={role} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white border border-white/25">
                                                    {short} {count}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Player list */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                                {viewSquadTeam.soldPlayers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-14 text-center">
                                        <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <p className="text-slate-500 text-sm font-medium">No players acquired yet</p>
                                        <p className="text-slate-400 text-xs mt-1">Players will appear here once they are sold</p>
                                    </div>
                                ) : (
                                    viewSquadTeam.soldPlayers.map((sp, pidx) => (
                                        <div key={sp.id} className="flex flex-col gap-2 p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-slate-400 w-5 text-center flex-shrink-0">{pidx + 1}</span>
                                                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {sp.players?.photo_url
                                                        ? <Image src={normalizePhotoUrl(sp.players.photo_url) ?? sp.players.photo_url} alt={sp.players.name ?? ''} width={36} height={36} className="w-full h-full object-cover" unoptimized />
                                                        : <span className="text-sm font-bold text-slate-500">{sp.players?.name?.charAt(0) ?? '?'}</span>
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{sp.players?.name ?? '—'}</p>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[sp.players?.role ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                                                        {sp.players?.role ?? '—'}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-600 flex-shrink-0">{fmt(sp.sold_price)}</p>
                                                {editingPlayer?.id === sp.id ? (
                                                    <button onClick={() => setEditingPlayer(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded bg-slate-100 transition-colors">Close</button>
                                                ) : (
                                                    <button onClick={() => setEditingPlayer(sp)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">Edit</button>
                                                )}
                                            </div>

                                            {editingPlayer?.id === sp.id && (
                                                <div className="pt-3 mt-1 border-t border-slate-100 grid grid-cols-1 gap-3">
                                                    <div className="flex items-end gap-2">
                                                        <label className="text-xs text-slate-600 font-semibold flex-1">
                                                            Update Price
                                                            <div className="flex items-center mt-1">
                                                                <span className="bg-slate-100 border border-r-0 border-slate-300 px-2 py-1.5 rounded-l text-sm text-slate-600">₹</span>
                                                                <input type="number" defaultValue={sp.sold_price} id={`price-${sp.id}`} className="w-full bg-white border border-slate-300 rounded-r px-2 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400" />
                                                            </div>
                                                        </label>
                                                        <button onClick={() => handleUpdatePrice(sp, Number((document.getElementById(`price-${sp.id}`) as HTMLInputElement).value))} disabled={editBusy} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">Save</button>
                                                    </div>
                                                    
                                                    <div className="flex items-end gap-2">
                                                        <label className="text-xs text-slate-600 font-semibold flex-1">
                                                            Transfer To Team
                                                            <select id={`transfer-${sp.id}`} defaultValue="" className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400">
                                                                <option value="" disabled>Select Team...</option>
                                                                {teams.filter(t => t.id !== sp.team_id).map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                        <button onClick={() => {
                                                              const t = (document.getElementById(`transfer-${sp.id}`) as HTMLSelectElement).value;
                                                              if(t) handleTransfer(sp, t);
                                                        }} disabled={editBusy} className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">Move</button>
                                                    </div>

                                                    <div className="pt-2">
                                                        <button onClick={() => handleRemovePlayer(sp)} disabled={editBusy} className="w-full bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            Remove Player & Refund Wallet
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Modal footer */}
                            <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
                                <span className="text-xs text-slate-500">Purse remaining: <span className="font-bold text-emerald-600">{fmt(viewSquadTeam.wallet_balance)}</span></span>
                                <span className="text-xs text-slate-500">Spent: <span className="font-bold text-orange-500">{fmt(viewSquadTeam.spent)}</span></span>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </>
    )
}
