'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { postJson } from '@/lib/apiClient'

type RegisterResult = {
    data: {
        user: { id: string; email: string | null }
        requiresEmailVerification: boolean
    }
}

export default function RegisterPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                    <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <RegisterPageContent />
        </Suspense>
    )
}

function RegisterPageContent() {
    const router = useRouter()
    const search = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const next = search.get('next') || '/plans'
    const googleHref = useMemo(
        () => `/api/auth/google/start?next=${encodeURIComponent(next)}`,
        [next],
    )

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setBusy(true)
        try {
            const result = await postJson<RegisterResult>('/api/auth/register', { email, password })
            if (result.data.requiresEmailVerification) {
                setSuccess('Account created. Please verify your email, then sign in.')
                return
            }
            const safeNext = next.startsWith('/') ? next : '/plans'
            router.replace(safeNext)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to register.'
            setError(message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur p-6 shadow-xl">
                <h1 className="text-2xl font-bold text-white">Create account</h1>
                <p className="mt-1 text-sm text-slate-400">Start your auction workspace in minutes.</p>

                <a
                    href={googleHref}
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-white text-slate-900 font-semibold py-2.5 hover:bg-slate-100 transition-colors"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.7 3.3 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.9-.1-1.3H12z" />
                    </svg>
                    Continue with Google
                </a>

                <div className="mt-4 flex items-center gap-3 text-slate-500 text-xs">
                    <div className="h-px flex-1 bg-slate-800" />
                    or use email
                    <div className="h-px flex-1 bg-slate-800" />
                </div>

                <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold tracking-wide uppercase text-slate-400">Email</label>
                        <input
                            type="email"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold tracking-wide uppercase text-slate-400">Password</label>
                        <input
                            type="password"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold tracking-wide uppercase text-slate-400">Confirm Password</label>
                        <input
                            type="password"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <p className="rounded-lg border border-rose-900/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-300">
                            {error}
                        </p>
                    )}
                    {success && (
                        <p className="rounded-lg border border-emerald-900/60 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
                            {success}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-semibold py-2.5 transition-colors"
                    >
                        {busy ? 'Creating account...' : 'Create account'}
                    </button>
                </form>

                <p className="mt-5 text-sm text-slate-400 text-center">
                    Already have an account?{' '}
                    <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sky-400 hover:text-sky-300 font-semibold">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    )
}
