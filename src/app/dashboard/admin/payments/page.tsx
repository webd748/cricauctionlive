'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/errors'
import { postJson } from '@/lib/apiClient'

type ReviewStatus = 'submitted' | 'approved' | 'rejected'

type PaymentProof = {
    id: string
    user_id: string
    subscription_id: string
    plan_code: string
    amount_inr: number
    upi_ref: string | null
    screenshot_path: string | null
    status: ReviewStatus
    review_note: string | null
    created_at: string
    reviewed_at: string | null
    reviewed_by: string | null
    screenshot_signed_url?: string | null
}

type ReviewListResult = {
    data: PaymentProof[]
}

const STATUS_FILTERS: Array<'all' | ReviewStatus> = ['all', 'submitted', 'approved', 'rejected']

function formatInr(value: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value)
}

export default function PaymentReviewPage() {
    const [status, setStatus] = useState<'all' | ReviewStatus>('submitted')
    const [proofs, setProofs] = useState<PaymentProof[]>([])
    const [loading, setLoading] = useState(true)
    const [busyProofId, setBusyProofId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const loadProofs = useCallback(async (filter: 'all' | ReviewStatus) => {
        setLoading(true)
        setError(null)
        try {
            const query = filter === 'all' ? '' : `?status=${filter}`
            const response = await fetch(`/api/billing/review${query}`, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as ReviewListResult | { error?: string } | null
            if (!response.ok) {
                throw new Error((payload as { error?: string } | null)?.error ?? 'Failed to load payment proofs')
            }
            setProofs((payload as ReviewListResult).data)
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load payment proofs'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadProofs(status)
    }, [status, loadProofs])

    const handleApprove = async (proofId: string) => {
        const daysRaw = window.prompt('Activate for how many days?', '30')
        if (!daysRaw) return
        const validDays = Number(daysRaw)
        if (!Number.isFinite(validDays) || validDays <= 0 || validDays > 365) {
            setError('Please enter a valid number of days between 1 and 365.')
            return
        }

        setBusyProofId(proofId)
        setError(null)
        try {
            await postJson('/api/billing/review', {
                proofId,
                action: 'approve',
                validDays,
            })
            await loadProofs(status)
        } catch (err) {
            setError(getErrorMessage(err, 'Approval failed'))
        } finally {
            setBusyProofId(null)
        }
    }

    const handleReject = async (proofId: string) => {
        const reason = window.prompt('Reason for rejection (optional):', '')
        setBusyProofId(proofId)
        setError(null)
        try {
            await postJson('/api/billing/review', {
                proofId,
                action: 'reject',
                reason: reason ?? '',
            })
            await loadProofs(status)
        } catch (err) {
            setError(getErrorMessage(err, 'Rejection failed'))
        } finally {
            setBusyProofId(null)
        }
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-950 p-6">
            <div className="max-w-6xl mx-auto">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-white">Payment Review</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Approve or reject payment proofs to activate league subscriptions.
                    </p>
                </header>

                {error && (
                    <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                <div className="mb-5 flex flex-wrap gap-2">
                    {STATUS_FILTERS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setStatus(value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${status === value
                                    ? 'bg-cyan-400 text-slate-900'
                                    : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                                }`}
                        >
                            {value}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => void loadProofs(status)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="h-64 grid place-items-center">
                        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : proofs.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-300">
                        No payment proofs in this filter.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {proofs.map((proof) => {
                            const isBusy = busyProofId === proof.id
                            const isSubmitted = proof.status === 'submitted'
                            return (
                                <article
                                    key={proof.id}
                                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-slate-400">User</p>
                                            <p className="text-sm font-semibold text-white break-all">{proof.user_id}</p>
                                        </div>
                                        <span
                                            className={`text-[11px] uppercase tracking-wide font-bold px-2 py-1 rounded-full ${proof.status === 'submitted'
                                                    ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                                                    : proof.status === 'approved'
                                                        ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/40'
                                                        : 'bg-rose-400/20 text-rose-200 border border-rose-400/40'
                                                }`}
                                        >
                                            {proof.status}
                                        </span>
                                    </div>

                                    <div className="text-sm text-slate-200">
                                        <p>
                                            Plan: <span className="font-semibold">{proof.plan_code}</span>
                                        </p>
                                        <p>
                                            Amount: <span className="font-semibold">{formatInr(proof.amount_inr)}</span>
                                        </p>
                                        <p>
                                            UPI ref: <span className="font-semibold">{proof.upi_ref || '-'}</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Submitted: {new Date(proof.created_at).toLocaleString('en-IN')}
                                        </p>
                                        {proof.review_note && (
                                            <p className="text-xs text-amber-200 mt-2">Note: {proof.review_note}</p>
                                        )}
                                    </div>

                                    {proof.screenshot_signed_url ? (
                                        <a
                                            href={proof.screenshot_signed_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block rounded-xl overflow-hidden border border-slate-700 bg-slate-950"
                                        >
                                            <Image
                                                src={proof.screenshot_signed_url}
                                                alt={`Proof ${proof.id}`}
                                                width={960}
                                                height={540}
                                                className="w-full h-44 object-cover"
                                                unoptimized
                                            />
                                        </a>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 h-44 grid place-items-center text-slate-500 text-sm">
                                            No screenshot available
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => void handleApprove(proof.id)}
                                            disabled={!isSubmitted || isBusy}
                                            className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-bold disabled:opacity-40"
                                        >
                                            {isBusy ? 'Processing...' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleReject(proof.id)}
                                            disabled={!isSubmitted || isBusy}
                                            className="px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-bold disabled:opacity-40"
                                        >
                                            {isBusy ? 'Processing...' : 'Reject'}
                                        </button>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
