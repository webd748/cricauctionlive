type FloatingMetric = {
    label: string
    value: string
    tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate'
    className: string
}

const FLOATING_METRICS: FloatingMetric[] = [
    {
        label: 'Highest Bid',
        value: '₹7.8L',
        tone: 'emerald',
        className: 'top-6 -left-8 -rotate-6',
    },
    {
        label: 'Remaining Purse',
        value: '₹42.0L',
        tone: 'sky',
        className: '-top-6 right-12 rotate-6',
    },
    {
        label: 'Round Status',
        value: 'Round 4 · Live',
        tone: 'rose',
        className: 'bottom-24 -left-10 rotate-[-4deg]',
    },
    {
        label: 'Bid Increment',
        value: '+₹20,000',
        tone: 'amber',
        className: '-bottom-7 right-8 rotate-[5deg]',
    },
]

function toneClass(tone: FloatingMetric['tone']) {
    if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    if (tone === 'sky') return 'border-sky-200 bg-sky-50 text-sky-800'
    if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-800'
    if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-800'
    return 'border-slate-200 bg-slate-50 text-slate-800'
}

function FloatingCard({ metric }: { metric: FloatingMetric }) {
    return (
        <div
            className={`hidden lg:block absolute rounded-2xl border px-3.5 py-2 shadow-[0_20px_35px_-24px_rgba(15,23,42,0.55)] backdrop-blur ${toneClass(metric.tone)} ${metric.className}`}
        >
            <p className="text-[10px] uppercase tracking-wide font-bold opacity-75">{metric.label}</p>
            <p className="text-sm font-black mt-0.5">{metric.value}</p>
        </div>
    )
}

export function HeroAuctionBoard() {
    return (
        <div className="relative mx-auto w-full max-w-[620px]">
            {FLOATING_METRICS.map((metric) => (
                <FloatingCard key={metric.label} metric={metric} />
            ))}

            <div className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 md:p-6 shadow-[0_42px_90px_-52px_rgba(15,23,42,0.55)] backdrop-blur">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">Live Bid Room</p>
                            <p className="text-sm font-bold text-slate-900">Elite Auction · Evening Slot</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            LIVE
                        </span>
                    </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs text-slate-500">Current Player</p>
                        <div className="mt-3 flex items-start gap-3">
                            <div className="h-14 w-14 rounded-2xl bg-[linear-gradient(140deg,#c7d2fe,#99f6e4)] border border-white shadow-inner" />
                            <div className="min-w-0">
                                <h3 className="text-lg font-black text-slate-900 leading-tight">R. Sharma</h3>
                                <p className="text-sm text-slate-500">All-Rounder · Delhi</p>
                                <span className="mt-2 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-600">
                                    Base Price: ₹2.0L
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                            <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold">Current Highest Bid</p>
                            <p className="mt-1 text-3xl font-black text-emerald-700 leading-none">₹7.8L</p>
                        </div>
                    </article>

                    <div className="space-y-3">
                        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs text-slate-500">Leading Team</p>
                            <p className="mt-1 text-base font-bold text-slate-900">Delhi Dynamos</p>
                            <p className="text-xs text-slate-500">Squad Slots Left: 4</p>
                        </article>

                        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs text-slate-500">Auction Health</p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                    <p className="text-[11px] text-slate-500">Sold</p>
                                    <p className="text-lg font-black text-slate-800">46</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                    <p className="text-[11px] text-slate-500">Unsold</p>
                                    <p className="text-lg font-black text-slate-800">9</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                    <p className="text-[11px] text-slate-500">Teams Active</p>
                                    <p className="text-lg font-black text-slate-800">10</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                    <p className="text-[11px] text-slate-500">Round</p>
                                    <p className="text-lg font-black text-slate-800">4</p>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Team demand momentum</span>
                        <span>Bid window: 00:18</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full w-[72%] bg-gradient-to-r from-cyan-500 via-emerald-500 to-indigo-500" />
                    </div>
                </div>
            </div>
        </div>
    )
}
