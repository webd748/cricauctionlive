'use client'

import { useEffect, useState } from 'react'
import { ClientOnly } from '@/components/ClientOnly'
import { postJson } from '@/lib/apiClient'
import { getErrorMessage } from '@/lib/errors'

interface BidTier {
    from: number
    to: number     // 999_999_999 = infinity
    increment: number
}

interface FormState {
    auction_name: string
    num_teams: number
    wallet_per_team: number
    base_price: number
    min_squad_size: number
    is_active: boolean
    bid_tiers: BidTier[]
}

const DEFAULT_TIERS: BidTier[] = [
    { from: 0, to: 1000, increment: 100 },
    { from: 1000, to: 3000, increment: 200 },
    { from: 3000, to: 999_999_999, increment: 300 },
]

const defaultForm: FormState = {
    auction_name: '',
    num_teams: 8,
    wallet_per_team: 0,
    base_price: 0,
    min_squad_size: 15,
    is_active: true,
    bid_tiers: DEFAULT_TIERS,
}

function fmtNum(val: number) {
    if (!val) return ''
    if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(2)} Cr`
    if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)} L`
    return `₹${val.toLocaleString('en-IN')}`
}

const INPUT = 'w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm'
const TIER_INPUT = 'w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm'

const num = (s: string) => Number(s.replace(/\D/g, '')) || 0

export default function AuctionSetupPage() {
    return (
        <ClientOnly fallback={
            <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <AuctionSetupContent />
        </ClientOnly>
    )
}

function AuctionSetupContent() {
    const [form, setForm] = useState<FormState>(defaultForm)
    const [existingId, setExistingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const response = await fetch('/api/settings', {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                })
                const payload = (await response.json().catch(() => null)) as
                    | { data?: Record<string, unknown> | null; error?: string }
                    | null
                if (!response.ok) {
                    throw new Error(payload?.error ?? 'Failed to load auction settings.')
                }

                const data = payload?.data as
                    | {
                        id: string
                        auction_name?: string
                        num_teams?: number
                        wallet_per_team?: number
                        base_price?: number
                        min_squad_size?: number
                        is_active?: boolean
                        bid_tiers?: BidTier[]
                    }
                    | null

                if (data) {
                    setExistingId(data.id)
                    setForm({
                        auction_name: data.auction_name ?? '',
                        num_teams: data.num_teams ?? 8,
                        wallet_per_team: data.wallet_per_team ?? 0,
                        base_price: data.base_price ?? 0,
                        min_squad_size: data.min_squad_size ?? 15,
                        is_active: data.is_active ?? true,
                        bid_tiers: data.bid_tiers ?? DEFAULT_TIERS,
                    })
                }
            } catch (error) {
                setError(getErrorMessage(error, 'Network error: Failed to reach database.'))
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    // ── Tier helpers ──────────────────────────────────────────────────────────

    const addTier = () => {
        const tiers = [...form.bid_tiers]
        if (tiers.length < 1) return
        const last = tiers[tiers.length - 1]
        const midTo = Math.round((last.from + (last.to < 999_999_999 ? last.to : last.from * 2 || 1000)) / 2)
        const newTier: BidTier = { from: last.from, to: midTo, increment: last.increment }
        tiers.splice(tiers.length - 1, 0, newTier)
        tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], from: midTo }
        setForm({ ...form, bid_tiers: tiers })
    }

    const removeTier = (i: number) => {
        if (form.bid_tiers.length <= 1) return
        const tiers = form.bid_tiers.filter((_, idx) => idx !== i)
        for (let j = 1; j < tiers.length; j++) tiers[j] = { ...tiers[j], from: tiers[j - 1].to }
        tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], to: 999_999_999 }
        setForm({ ...form, bid_tiers: tiers })
    }

    const updateTier = (i: number, patch: Partial<BidTier>) => {
        const tiers = form.bid_tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t)
        if ('to' in patch && i + 1 < tiers.length) tiers[i + 1] = { ...tiers[i + 1], from: patch.to! }
        setForm({ ...form, bid_tiers: tiers })
    }

    // ── Preview ───────────────────────────────────────────────────────────────
    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true); setError(null); setSuccess(null)

        const syncedTiers = form.bid_tiers.map((t, i) =>
            i === 0 ? { ...t, from: form.base_price } : t
        )

        for (const [i, t] of syncedTiers.entries()) {
            if (!t.increment || t.increment <= 0) {
                setError(`Tier ${i + 1}: Bid increment must be > 0`); setSaving(false); return
            }
            if (i < syncedTiers.length - 1 && t.to <= t.from) {
                setError(`Tier ${i + 1}: "To" must be greater than "From"`); setSaving(false); return
            }
        }

        const payload = {
            auction_name: form.auction_name,
            num_teams: form.num_teams,
            wallet_per_team: form.wallet_per_team,
            base_price: form.base_price,
            min_squad_size: form.min_squad_size,
            is_active: form.is_active,
            bid_tiers: syncedTiers,
        }

        try {
            const response = await postJson<{ data: { id: string } }>('/api/settings', {
                action: 'save',
                payload: {
                    existingId,
                    ...payload,
                },
            })
            if (response.data?.id) {
                setExistingId(response.data.id)
            }
            if (response.data) setSuccess(existingId ? 'Settings updated!' : 'Auction created!')
            else setSuccess(existingId ? '✓ Settings updated!' : '✓ Auction created!')
        } catch (error) {
            setError(getErrorMessage(error, 'Network error saving settings'))
        }
        
        setSaving(false)
    }

    if (loading) return (
        <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    const baseLabel = form.base_price ? `₹${form.base_price.toLocaleString('en-IN')} (base)` : 'Base Price'

    return (
        <div className="min-h-screen bg-[#f1f5f9] p-6 pb-20">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="mb-8 text-center pt-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 border border-indigo-200 rounded-2xl mb-4 shadow-sm">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Auction Setup</h1>
                    <p className="mt-2 text-slate-500">Configure your cricket auction settings</p>
                </div>

                {/* Progress */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">1</span>
                        <span className="text-indigo-600">Settings</span>
                        <div className="w-8 h-0.5 bg-slate-200 mx-2"/>
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">2</span>
                        <span className="text-slate-400">Teams</span>
                        <div className="w-8 h-0.5 bg-slate-200 mx-2"/>
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">3</span>
                        <span className="text-slate-400">Players</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Alerts */}
                    {error && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm shadow-sm">
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>{error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm shadow-sm">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>{success}
                        </div>
                    )}

                    {/* ── Section 1: General ── */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 text-xs font-bold">1</span>
                            General
                        </h2>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Auction Name</label>
                            <input type="text" required value={form.auction_name}
                                onChange={e => setForm({ ...form, auction_name: e.target.value })}
                                placeholder="e.g. IPL Mega Auction 2026"
                                className={INPUT} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Number of Teams</label>
                                <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                    value={form.num_teams || ''}
                                    onChange={e => setForm({ ...form, num_teams: num(e.target.value) })}
                                    placeholder="e.g. 8"
                                    className={INPUT} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Squad Size Limit</label>
                                <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                    value={form.min_squad_size || ''}
                                    onChange={e => setForm({ ...form, min_squad_size: num(e.target.value) })}
                                    placeholder="e.g. 15"
                                    className={INPUT} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    Total Wallet per Team
                                    <span className="text-slate-400 text-xs font-normal">(Total purse)</span>
                                </label>
                                <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                    value={form.wallet_per_team || ''}
                                    onChange={e => setForm({ ...form, wallet_per_team: num(e.target.value) })}
                                    placeholder="e.g. 100000000"
                                    className={INPUT} />
                                <p className="text-xs text-slate-500">{fmtNum(form.wallet_per_team)}</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    Base Price Reserve
                                    <span className="text-slate-400 text-xs font-normal">(Default if player has none)</span>
                                </label>
                                <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                    value={form.base_price || ''}
                                    onChange={e => setForm({ ...form, base_price: num(e.target.value) })}
                                    placeholder="e.g. 2000000"
                                    className={INPUT} />
                                <p className="text-xs text-slate-500">{fmtNum(form.base_price)}</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Section 2: Bid Tiers ── */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 text-xs font-bold">2</span>
                                Bid Increment Tiers
                            </h2>
                            <button type="button" onClick={addTier}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold rounded-lg transition-colors border border-indigo-200">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Tier
                            </button>
                        </div>

                        <div className="space-y-3 mb-6">
                            {form.bid_tiers.map((tier, i) => {
                                const isFirst = i === 0
                                const isFinal = i === form.bid_tiers.length - 1

                                return (
                                    <div key={i} className="flex flex-col p-4 bg-slate-50 border border-slate-200 rounded-xl relative group transition-all">
                                        <div className="flex items-start gap-4">
                                            {/* From block */}
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From (₹)</label>
                                                {isFirst ? (
                                                    <div className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center h-[42px]">
                                                        <span className="text-sm font-medium text-slate-500">{baseLabel}</span>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl flex items-center h-[42px] cursor-not-allowed">
                                                        <span className="text-sm font-medium text-slate-500">{tier.from.toLocaleString('en-IN')}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* To block */}
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To (₹)</label>
                                                {isFinal ? (
                                                    <div className="px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center h-[42px] relative overflow-hidden">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />
                                                        <span className="text-sm font-bold text-indigo-400">Infinity (∞)</span>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                                            value={tier.to || ''}
                                                            onChange={e => updateTier(i, { to: num(e.target.value) })}
                                                            placeholder="Amount" className={TIER_INPUT} />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">Auto-syncs Next From</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Increment block */}
                                            <div className="flex-[0.8] space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Increment (+₹)</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                                        value={tier.increment || ''}
                                                        onChange={e => updateTier(i, { increment: num(e.target.value) })}
                                                        placeholder="e.g. 100" className={TIER_INPUT} />
                                                    {!isFirst && !isFinal && (
                                                        <button type="button" onClick={() => removeTier(i)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 flex-shrink-0" title="Remove Tier">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Button Row */}
                    <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex-1 text-xs text-slate-500">
                            {existingId ? 'Settings will be saved instantly.' : 'Complete this step to proceed.'}
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button type="submit" disabled={saving}
                                className="w-full md:w-auto px-6 py-3 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
                                {saving ? (
                                    <><span className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> Saving...</>
                                ) : (
                                    <>Save Settings</>
                                )}
                            </button>
                            <a href="/auction/team-setup"
                                className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] transition-all flex items-center justify-center gap-2">
                                Next Step
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
