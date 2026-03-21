'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ClientOnly } from '@/components/ClientOnly'
import { postJson } from '@/lib/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BidTier {
    from: number   // Start of range (inclusive)
    to: number     // End of range (exclusive); use 999_999_999 for "infinity"
    increment: number
}

interface FormState {
    auction_name: string
    num_teams: number
    min_squad_size: number
    wallet_per_team: number
    base_price: number
    is_active: boolean
    bid_tiers: BidTier[]
}

const DEFAULT_TIERS: BidTier[] = [
    { from: 0, to: 1000, increment: 100 },
    { from: 1000, to: 3000, increment: 200 },
    { from: 3000, to: 999_999_999, increment: 300 },
]

const EMPTY_FORM: FormState = {
    auction_name: '',
    num_teams: 0,
    min_squad_size: 0,
    wallet_per_team: 0,
    base_price: 0,
    is_active: true,
    bid_tiers: DEFAULT_TIERS,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(val: number) {
    if (!val) return ''
    if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(2)} Cr`
    if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)} L`
    return `₹${val.toLocaleString('en-IN')}`
}

const toNum = (s: string) => Number(s.replace(/\D/g, '')) || 0

const INPUT_CLS =
    'w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 ' +
    'rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'

const TIER_INPUT =
    'w-full bg-slate-950 border border-slate-700/50 text-white placeholder-slate-600 ' +
    'rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all'

function Field({ label, hint, children, sub }: { label: string; hint?: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                {label}
                {hint && <span className="text-slate-500 text-xs font-normal">{hint}</span>}
            </label>
            {children}
            {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    return (
        <ClientOnly
            fallback={
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-slate-950">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <SettingsContent />
        </ClientOnly>
    )
}

// ─── Content ──────────────────────────────────────────────────────────────────

function SettingsContent() {
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [existingId, setExistingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [resetting, setResetting] = useState(false)

    // ── Fetch ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('auction_settings')
                .select('*')
                .limit(1)
                .single()

            if (data) {
                setExistingId(data.id)
                setForm({
                    auction_name: data.auction_name ?? '',
                    num_teams: data.num_teams ?? 0,
                    min_squad_size: data.min_squad_size ?? 0,
                    wallet_per_team: data.wallet_per_team ?? 0,
                    base_price: data.base_price ?? 0,
                    is_active: data.is_active ?? true,
                    bid_tiers: Array.isArray(data.bid_tiers) && data.bid_tiers.length > 0
                        ? data.bid_tiers
                        : DEFAULT_TIERS,
                })
            } else if (error && error.code !== 'PGRST116') {
                setError(error.message)
            }
            setLoading(false)
        }
        load()
    }, [])

    // ── Bid Tier Helpers ─────────────────────────────────────────────────────
    const addTier = () => {
        const tiers = [...form.bid_tiers]
        // The last tier is always the "final" (to = Infinity). Insert a new tier before it.
        if (tiers.length < 1) return
        const last = tiers[tiers.length - 1]
        // New tier: from = last.from, to = last.to, last.from = newTo
        const midTo = Math.round((last.from + (last.to < 999_999_999 ? last.to : last.from * 2 || 1000)) / 2)
        const newTier: BidTier = { from: last.from, to: midTo, increment: last.increment }
        tiers.splice(tiers.length - 1, 0, newTier)
        tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], from: midTo }
        setForm({ ...form, bid_tiers: tiers })
    }

    const removeTier = (i: number) => {
        if (form.bid_tiers.length <= 1) return
        const tiers = form.bid_tiers.filter((_, idx) => idx !== i)
        // Re-stitch: each tier's from = previous tier's to
        for (let j = 1; j < tiers.length; j++) {
            tiers[j] = { ...tiers[j], from: tiers[j - 1].to }
        }
        // Ensure last tier runs to infinity
        tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], to: 999_999_999 }
        setForm({ ...form, bid_tiers: tiers })
    }

    const updateTier = (i: number, patch: Partial<BidTier>) => {
        const tiers = form.bid_tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t)
        // If 'to' changes on tier i, auto-update next tier's 'from'
        if ('to' in patch && i + 1 < tiers.length) {
            tiers[i + 1] = { ...tiers[i + 1], from: patch.to! }
        }
        setForm({ ...form, bid_tiers: tiers })
    }

    // ── Live Preview ─────────────────────────────────────────────────────────
    const preview = (() => {
        const wallet = form.wallet_per_team
        const base = form.base_price || 0
        if (!wallet || !base) return []
        const bids: number[] = [base]
        let current = base
        // Sync first tier's from to base_price
        const tiers = form.bid_tiers.map((t, i) => i === 0 ? { ...t, from: base } : t)
        for (let step = 0; step < 12; step++) {
            const tier = tiers.find(t => current >= t.from && current < t.to)
            const inc = tier?.increment ?? 0
            if (!inc) break
            current += inc
            if (current > wallet) break
            bids.push(current)
            if (bids.length >= 9) break
        }
        return bids
    })()

    // ── Save ─────────────────────────────────────────────────────────────────
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(false)

        // Sync first tier from = base_price before saving
        const syncedTiers = form.bid_tiers.map((t, i) =>
            i === 0 ? { ...t, from: form.base_price } : t
        )

        for (const [i, t] of syncedTiers.entries()) {
            if (!t.increment || t.increment <= 0) {
                setError(`Tier ${i + 1}: Increment must be greater than 0`); setSaving(false); return
            }
            if (i < syncedTiers.length - 1 && t.to <= t.from) {
                setError(`Tier ${i + 1}: "To" must be greater than "From"`); setSaving(false); return
            }
        }

        const payload = {
            auction_name: form.auction_name,
            num_teams: form.num_teams,
            min_squad_size: form.min_squad_size,
            wallet_per_team: form.wallet_per_team,
            base_price: form.base_price,
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
            setSuccess(true)
            setTimeout(() => setSuccess(false), 4000)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save settings.'
            setError(message)
        }
        setSaving(false)
    }

    // ── Reset Auction ────────────────────────────────────────────────────────
    const handleReset = async () => {
        if (!window.confirm("🚨 WARNING: This will permanently delete ALL TEAMS, ALL PLAYERS, and all auction history. Are you absolutely sure?")) {
            return
        }

        setResetting(true)
        try {
            await postJson('/api/settings', { action: 'reset' })

            alert("✅ Auction successfully reset. All teams and players have been removed.")
            // Force a full reload so any cached data in the local app drops
            window.location.reload()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reset auction.'
            alert(`Failed to reset auction: ${message}`)
        } finally {
            setResetting(false)
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-slate-950">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }


    const SectionHeader = ({ num, color, label }: { num: number; color: string; label: string }) => (
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${color}`}>{num}</span>
            {label}
        </h2>
    )

    // compute from-values display style for first tier
    const baseLabel = form.base_price ? `₹${form.base_price.toLocaleString('en-IN')} (base)` : 'Base Price'

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-950 p-6">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
                    <p className="text-slate-400 text-sm mt-1">Manage auction configuration</p>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-sm">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        ✓ Settings saved successfully
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-5">

                    {/* ── Section 1: General ── */}
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                        <SectionHeader num={1} color="bg-indigo-600/30 border-indigo-500/40 text-indigo-400" label="General" />

                        <Field label="Auction Name">
                            <input type="text" required value={form.auction_name}
                                onChange={e => setForm({ ...form, auction_name: e.target.value })}
                                placeholder="e.g. IPL Mega Auction 2026" className={INPUT_CLS} />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Number of Teams">
                                <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                    value={form.num_teams || ''}
                                    onChange={e => setForm({ ...form, num_teams: toNum(e.target.value) })}
                                    placeholder="e.g. 8" className={INPUT_CLS} />
                            </Field>
                            <Field label="Squad Size Limit">
                                <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                    value={form.min_squad_size || ''}
                                    onChange={e => setForm({ ...form, min_squad_size: toNum(e.target.value) })}
                                    placeholder="e.g. 15" className={INPUT_CLS} />
                            </Field>
                        </div>
                    </div>

                    {/* ── Section 2: Budget & Pricing ── */}
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                        <SectionHeader num={2} color="bg-emerald-600/30 border-emerald-500/40 text-emerald-400" label="Budget & Pricing" />

                        <Field label="Wallet Per Team" hint={fmtINR(form.wallet_per_team)}
                            sub="Each team starts with this base budget before overrides">
                            <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                value={form.wallet_per_team || ''}
                                onChange={e => setForm({ ...form, wallet_per_team: toNum(e.target.value) })}
                                placeholder="Enter wallet amount (e.g. 10000)" className={INPUT_CLS} />
                        </Field>

                        <Field label="Default Base Price" hint={fmtINR(form.base_price)}
                            sub="Players without a custom price use this value">
                            <input type="text" inputMode="numeric" pattern="[0-9]*" required
                                value={form.base_price || ''}
                                onChange={e => setForm({ ...form, base_price: toNum(e.target.value) })}
                                placeholder="Starting bid per player (e.g. 300)" className={INPUT_CLS} />
                        </Field>
                    </div>

                    {/* ── Section 3: Bid Increment Rules ── */}
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <SectionHeader num={3} color="bg-amber-600/30 border-amber-500/40 text-amber-400" label="Bid Increment Rules" />
                            <button type="button" onClick={addTier}
                                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1.5 rounded-lg transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Tier
                            </button>
                        </div>

                        <div className="space-y-3">
                            {form.bid_tiers.map((tier, i) => {
                                const isFinal = tier.to >= 999_999_999
                                const tierLabel = isFinal ? 'FINAL TIER' : `TIER ${i + 1}`
                                return (
                                    <div key={i} className={`rounded-xl border p-4 ${isFinal ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-slate-950 border-slate-700/50'}`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isFinal ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                                                {tierLabel}
                                            </span>
                                            {form.bid_tiers.length > 1 && (
                                                <button type="button" onClick={() => removeTier(i)}
                                                    className="ml-auto text-slate-600 hover:text-red-400 transition-colors">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            {/* FROM */}
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 font-medium">From (₹)</label>
                                                {i === 0 ? (
                                                    <div className="px-3 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700/30 text-emerald-400 text-xs font-semibold">
                                                        {baseLabel}
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700/30 text-slate-400 text-sm">
                                                        {tier.from > 0 ? `₹${tier.from.toLocaleString('en-IN')}` : '—'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* TO */}
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 font-medium">To (₹)</label>
                                                {isFinal ? (
                                                    <div className="px-3 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700/30 text-indigo-400 text-sm font-semibold">
                                                        ∞
                                                    </div>
                                                ) : (
                                                    <input type="text" inputMode="numeric" pattern="[0-9]*"
                                                        value={tier.to || ''}
                                                        onChange={e => updateTier(i, { to: toNum(e.target.value) })}
                                                        placeholder="e.g. 1000" className={TIER_INPUT} />
                                                )}
                                            </div>

                                            {/* INCREMENT */}
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 font-medium">Increment (+)</label>
                                                <input type="text" inputMode="numeric" pattern="[0-9]*"
                                                    value={tier.increment || ''}
                                                    onChange={e => updateTier(i, { increment: toNum(e.target.value) })}
                                                    placeholder="e.g. 100" className={TIER_INPUT} />
                                            </div>
                                        </div>

                                        {/* Visual range bar */}
                                        {!isFinal && tier.to > tier.from && (
                                            <p className="text-[10px] text-slate-500 mt-2">
                                                Range: <span className="text-slate-400 font-medium">
                                                    ₹{tier.from.toLocaleString('en-IN')} → ₹{tier.to.toLocaleString('en-IN')}
                                                </span> · step <span className="text-emerald-500 font-medium">+₹{tier.increment.toLocaleString('en-IN')}</span>
                                            </p>
                                        )}
                                        {isFinal && (
                                            <p className="text-[10px] text-slate-500 mt-2">
                                                Range: <span className="text-slate-400 font-medium">
                                                    ₹{tier.from.toLocaleString('en-IN')} → ∞
                                                </span> · step <span className="text-indigo-400 font-medium">+₹{tier.increment.toLocaleString('en-IN')}</span>
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Live preview */}
                        {preview.length > 1 && (
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                <p className="text-xs text-slate-500 font-medium mb-3 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    Bid sequence preview
                                </p>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {preview.map((bid, i) => (
                                        <span key={i} className={`font-mono text-xs px-2.5 py-1 rounded-lg border font-medium ${i === 0 ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400'}`}>
                                            ₹{bid.toLocaleString('en-IN')}
                                        </span>
                                    ))}
                                    <span className="text-slate-600 text-xs">…</span>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-slate-500">
                            Tip: The first tier&apos;s &ldquo;From&rdquo; is auto-set to the base price. The final tier runs to ∞.
                            Changing a tier&apos;s &ldquo;To&rdquo; automatically updates the next tier&apos;s &ldquo;From&rdquo;.
                        </p>
                    </div>

                    {/* ── Section 4: Auction Status ── */}
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <SectionHeader num={4} color="bg-rose-600/30 border-rose-500/40 text-rose-400" label="Auction Status" />
                                <p className="text-xs text-slate-500 mt-2">Allow teams to participate in bidding</p>
                            </div>
                            <button type="button"
                                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.is_active ? 'bg-indigo-600' : 'bg-slate-600'
                                    }`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>
                        <div className="mt-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${form.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${form.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                    }`} />
                                {form.is_active ? 'Auction is Active' : 'Auction is Inactive'}
                            </span>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div className="px-1">
                        {existingId ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                Editing existing record
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-sky-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                New record will be created on save
                            </span>
                        )}
                    </div>

                    {/* Save */}
                    <button type="submit" disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-4 text-sm transition-all shadow-lg shadow-indigo-500/20">
                        {saving ? (
                            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                        ) : (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>{existingId ? 'Save Changes' : 'Create Auction Settings'}</>
                        )}
                    </button>
                </form>

                {/* ── Danger Zone ── */}
                <div className="mt-8 pt-8 border-t border-rose-900/30">
                    <SectionHeader num={5} color="bg-rose-900/50 border-rose-500/30 text-rose-500" label="Danger Zone" />
                    <p className="mt-2 text-xs text-slate-500 max-w-xl">
                        This action is irreversible. Resetting the auction will permanently delete all configured Teams, all uploaded Players, and all bidding history. Your current Settings (like base price and squad size) will remain saved.
                    </p>
                    <button
                        onClick={handleReset}
                        disabled={resetting}
                        className="mt-5 flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-rose-900/20"
                    >
                        {resetting ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        )}
                        Reset Auction Data
                    </button>
                </div>
            </div>
        </div>
    )
}
