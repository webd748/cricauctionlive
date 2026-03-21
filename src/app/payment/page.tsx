'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BILLING_PLANS } from '@/lib/billing'
import { getErrorMessage } from '@/lib/errors'

type BillingSubscriptionStatus =
    | 'pending_payment'
    | 'pending_review'
    | 'active'
    | 'rejected'
    | 'expired'

type BillingSubscription = {
    id: string
    plan_code: string
    amount_inr: number
    max_teams: number
    status: BillingSubscriptionStatus
    expires_at: string | null
}

type BillingProof = {
    id: string
    status: 'submitted' | 'approved' | 'rejected'
    upi_ref: string | null
    review_note: string | null
    created_at: string
    screenshot_signed_url?: string | null
}

type BillingState = {
    subscription: BillingSubscription | null
    latestProof: BillingProof | null
}

type BillingStatusResult = {
    data: BillingState
}

function formatInr(value: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value)
}

const UPI_ID = process.env.NEXT_PUBLIC_BILLING_UPI_ID ?? 'auction@upi'

export default function PaymentPage() {
    const router = useRouter()
    const [state, setState] = useState<BillingState | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [upiRef, setUpiRef] = useState('')
    const [note, setNote] = useState('')
    const [screenshotFile, setScreenshotFile] = useState<File | null>(null)

    const plan = useMemo(() => {
        const planCode = state?.subscription?.plan_code
        if (!planCode) return null
        return BILLING_PLANS.find((entry) => entry.code === planCode) ?? null
    }, [state?.subscription?.plan_code])

    const loadBillingStatus = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/billing/status', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as BillingStatusResult | { error?: string } | null
            if (!response.ok) {
                throw new Error((payload as { error?: string } | null)?.error ?? 'Failed to load payment status')
            }
            setState((payload as BillingStatusResult).data)
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load billing status'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadBillingStatus()
    }, [])

    const handleSubmitProof = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!state?.subscription) {
            setError('Select a plan before submitting payment.')
            return
        }
        if (!screenshotFile) {
            setError('Upload your payment screenshot.')
            return
        }

        setError(null)
        setSuccess(null)
        setSubmitting(true)

        const formData = new FormData()
        formData.append('upiRef', upiRef.trim())
        formData.append('note', note.trim())
        formData.append('screenshot', screenshotFile)

        try {
            const response = await fetch('/api/billing/payment', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            })
            const payload = (await response.json().catch(() => null)) as BillingStatusResult | { error?: string } | null
            if (!response.ok) {
                throw new Error((payload as { error?: string } | null)?.error ?? 'Payment submission failed')
            }

            setSuccess('Payment proof submitted. We will review it shortly.')
            setUpiRef('')
            setNote('')
            setScreenshotFile(null)
            setState((payload as BillingStatusResult).data)
        } catch (err) {
            setError(getErrorMessage(err, 'Payment submission failed'))
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#0f3057,transparent_45%),radial-gradient(circle_at_85%_10%,#1e3a8a,transparent_35%),linear-gradient(180deg,#020617,#020617)] text-white">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-14">
                <header className="text-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80 font-bold">Step 4</p>
                    <h1 className="mt-3 text-4xl md:text-5xl font-black tracking-tight">Payment Verification</h1>
                    <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
                        Submit manual payment proof to unlock auction setup and go live.
                    </p>
                </header>

                {error && (
                    <div className="mt-8 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mt-8 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                        {success}
                    </div>
                )}

                {!state?.subscription && (
                    <section className="mt-8 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-6">
                        <h2 className="text-lg font-bold text-amber-100">No plan selected yet</h2>
                        <p className="mt-2 text-sm text-amber-50/90">Please choose a plan first, then return to payment.</p>
                        <Link
                            href="/plans"
                            className="mt-4 inline-flex rounded-xl bg-amber-200 text-slate-900 px-4 py-2 font-semibold"
                        >
                            Go to Step 3
                        </Link>
                    </section>
                )}

                {state?.subscription && (
                    <section className="mt-8 grid gap-6 md:grid-cols-5">
                        <div className="md:col-span-2 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                            <p className="text-sm text-slate-400">Selected plan</p>
                            <h2 className="mt-1 text-2xl font-bold">{plan?.name ?? state.subscription.plan_code}</h2>
                            <p className="mt-2 text-cyan-200 font-semibold">{formatInr(state.subscription.amount_inr)}</p>
                            <p className="mt-1 text-xs text-slate-400">Max teams: {state.subscription.max_teams}</p>

                            <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                                <p className="text-xs uppercase tracking-wide text-cyan-300/80 font-bold">Pay to UPI</p>
                                <p className="mt-2 text-lg font-black">{UPI_ID}</p>
                                <p className="mt-2 text-xs text-slate-300">
                                    Complete payment from any UPI app and upload screenshot here.
                                </p>
                            </div>

                            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Current status</p>
                                <p className="mt-2 text-base font-semibold">
                                    {state.subscription.status.replace('_', ' ')}
                                </p>
                                {state.subscription.status === 'active' && state.subscription.expires_at && (
                                    <p className="mt-1 text-xs text-emerald-300">
                                        Active until {new Date(state.subscription.expires_at).toLocaleDateString('en-IN')}
                                    </p>
                                )}
                                {state.latestProof?.review_note && (
                                    <p className="mt-2 text-xs text-amber-200">Review note: {state.latestProof.review_note}</p>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                            {state.subscription.status === 'active' ? (
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-bold text-emerald-300">Payment approved</h3>
                                    <p className="text-slate-200">
                                        Your subscription is active. Continue to setup teams, players, and auction rules.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => router.push('/auction/auction-setup')}
                                        className="rounded-xl bg-emerald-400 text-slate-950 px-5 py-2.5 font-bold hover:bg-emerald-300 transition-colors"
                                    >
                                        Continue to setup
                                    </button>
                                </div>
                            ) : state.subscription.status === 'pending_review' ? (
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-bold text-cyan-300">Proof under review</h3>
                                    <p className="text-slate-200">
                                        Your screenshot is submitted. Admin review is pending. You can refresh this page for status updates.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={() => void loadBillingStatus()}
                                            className="rounded-xl bg-white text-slate-900 px-5 py-2.5 font-semibold hover:bg-slate-100 transition-colors"
                                        >
                                            Refresh status
                                        </button>
                                        <Link
                                            href="/plans"
                                            className="rounded-xl border border-slate-500 px-5 py-2.5 text-slate-200 hover:bg-slate-800/60 transition-colors"
                                        >
                                            Change plan
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmitProof} className="space-y-4">
                                    <h3 className="text-2xl font-bold">Upload payment screenshot</h3>
                                    <p className="text-sm text-slate-300">
                                        Step 1: send {formatInr(state.subscription.amount_inr)} to <span className="font-semibold">{UPI_ID}</span>.
                                    </p>
                                    <p className="text-sm text-slate-300">
                                        Step 2: upload screenshot and optional UPI transaction reference.
                                    </p>

                                    <div className="space-y-1.5">
                                        <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                                            UPI transaction reference (optional)
                                        </label>
                                        <input
                                            value={upiRef}
                                            onChange={(e) => setUpiRef(e.target.value)}
                                            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
                                            placeholder="e.g. 340928372911"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                                            Screenshot file
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
                                            className="w-full rounded-xl border border-dashed border-cyan-500/50 bg-slate-950 px-3 py-2.5 text-sm"
                                            required
                                        />
                                        <p className="text-xs text-slate-400">Max size: 10MB</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                                            Note for admin (optional)
                                        </label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            rows={3}
                                            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
                                            placeholder="Team name, payment app used, or any relevant info"
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="rounded-xl bg-cyan-400 text-slate-950 px-5 py-2.5 font-bold hover:bg-cyan-300 disabled:opacity-60"
                                        >
                                            {submitting ? 'Submitting...' : 'Submit proof'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void loadBillingStatus()}
                                            className="rounded-xl border border-slate-500 px-5 py-2.5 text-slate-200 hover:bg-slate-800/60 transition-colors"
                                        >
                                            Refresh status
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
