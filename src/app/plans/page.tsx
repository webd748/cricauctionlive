'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BILLING_PLANS, type BillingPlanCode } from '@/lib/billing'
import { postJson } from '@/lib/apiClient'
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
    max_teams: number
    amount_inr: number
    status: BillingSubscriptionStatus
    expires_at: string | null
}

type BillingState = {
    subscription: BillingSubscription | null
    latestProof:
        | {
            status: 'submitted' | 'approved' | 'rejected'
            review_note: string | null
        }
        | null
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

function getContinuePath(subscription: BillingSubscription | null): string {
    if (!subscription) return '/plans'
    if (subscription.status === 'active') return '/auction/auction-setup'
    return '/payment'
}

export default function PlansPage() {
    const router = useRouter()
    const [state, setState] = useState<BillingState | null>(null)
    const [loading, setLoading] = useState(true)
    const [savingPlanCode, setSavingPlanCode] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const activePlanCode = state?.subscription?.plan_code ?? null
    const isActiveSubscription = state?.subscription?.status === 'active'

    const selectedPlan = useMemo(
        () => BILLING_PLANS.find((plan) => plan.code === activePlanCode) ?? null,
        [activePlanCode],
    )

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
                throw new Error((payload as { error?: string } | null)?.error ?? 'Failed to load plans')
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

    const handleChoosePlan = async (planCode: BillingPlanCode) => {
        if (isActiveSubscription && planCode !== activePlanCode) {
            const proceed = window.confirm(
                'Changing plan will move your subscription to pending payment. Continue?',
            )
            if (!proceed) return
        }

        setError(null)
        setSavingPlanCode(planCode)
        try {
            const result = await postJson<BillingStatusResult>('/api/billing/plan', { planCode })
            setState(result.data)
            router.push('/payment')
        } catch (err) {
            setError(getErrorMessage(err, 'Unable to select plan'))
        } finally {
            setSavingPlanCode(null)
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
        <main className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#0b2540,transparent_45%),radial-gradient(circle_at_100%_10%,#09315b,transparent_40%),linear-gradient(180deg,#020617,#020617)] text-white">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
                <header className="text-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80 font-bold">Step 3</p>
                    <h1 className="mt-3 text-4xl md:text-5xl font-black tracking-tight">Choose Your Auction Plan</h1>
                    <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
                        Pick a league size, activate payment, then unlock setup and live auction control.
                    </p>
                </header>

                {error && (
                    <div className="mt-8 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                {state?.subscription && (
                    <section className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5 md:p-6">
                        <p className="text-sm text-cyan-200">
                            Current subscription:{' '}
                            <span className="font-bold">
                                {selectedPlan?.name ?? state.subscription.plan_code}
                            </span>{' '}
                            ({state.subscription.status.replace('_', ' ')})
                        </p>
                        {state.subscription.expires_at && state.subscription.status === 'active' && (
                            <p className="mt-1 text-xs text-cyan-100/80">
                                Expires on {new Date(state.subscription.expires_at).toLocaleDateString('en-IN')}
                            </p>
                        )}
                        {state.latestProof?.status === 'rejected' && state.latestProof.review_note && (
                            <p className="mt-2 text-sm text-amber-200">
                                Last review note: {state.latestProof.review_note}
                            </p>
                        )}
                    </section>
                )}

                <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {BILLING_PLANS.map((plan) => {
                        const isCurrent = activePlanCode === plan.code
                        const isBusy = savingPlanCode === plan.code
                        return (
                            <article
                                key={plan.code}
                                className={`rounded-2xl border p-5 bg-slate-900/60 backdrop-blur ${isCurrent
                                        ? 'border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]'
                                        : 'border-slate-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <h2 className="text-xl font-bold">{plan.name}</h2>
                                    {isCurrent && (
                                        <span className="text-[11px] font-bold rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-200 px-2 py-1">
                                            Selected
                                        </span>
                                    )}
                                </div>
                                <p className="mt-2 text-sm text-slate-300">{plan.tagline}</p>
                                <p className="mt-4 text-3xl font-black">{formatInr(plan.amountInr)}</p>
                                <p className="text-xs text-slate-400">up to {plan.maxTeams} teams</p>
                                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2">
                                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    onClick={() => void handleChoosePlan(plan.code)}
                                    disabled={Boolean(savingPlanCode)}
                                    className="mt-6 w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold py-2.5 transition-colors"
                                >
                                    {isBusy ? 'Selecting...' : isCurrent ? 'Selected' : 'Choose plan'}
                                </button>
                            </article>
                        )
                    })}
                </section>

                <section className="mt-8 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push(getContinuePath(state?.subscription ?? null))}
                        className="rounded-xl bg-white text-slate-900 px-5 py-2.5 font-semibold hover:bg-slate-100 transition-colors"
                    >
                        Continue
                    </button>
                    <Link
                        href="/payment"
                        className="rounded-xl border border-slate-600 px-5 py-2.5 text-slate-200 hover:bg-slate-800/70 transition-colors"
                    >
                        Go to payment step
                    </Link>
                    <button
                        type="button"
                        onClick={() => void loadBillingStatus()}
                        className="rounded-xl border border-slate-600 px-5 py-2.5 text-slate-200 hover:bg-slate-800/70 transition-colors"
                    >
                        Refresh status
                    </button>
                </section>
            </div>
        </main>
    )
}
