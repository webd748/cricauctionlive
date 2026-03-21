import Link from 'next/link'

export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-lg w-full text-center rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
                <h1 className="text-2xl font-bold text-white">Access denied</h1>
                <p className="mt-3 text-slate-400">
                    Your account is authenticated but does not have admin permissions for this page.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                    <Link
                        href="/dashboard/live"
                        className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 text-sm font-semibold"
                    >
                        Go to dashboard
                    </Link>
                    <Link
                        href="/login"
                        className="rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 px-4 py-2 text-sm font-semibold"
                    >
                        Switch account
                    </Link>
                </div>
            </div>
        </div>
    )
}
