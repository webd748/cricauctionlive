import type { WorkflowStep } from '@/components/landing/data'

type WorkflowShowcaseProps = {
    steps: WorkflowStep[]
}

export function WorkflowShowcase({ steps }: WorkflowShowcaseProps) {
    return (
        <section className="mt-16 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[30px] border border-slate-200 bg-white/85 p-6 md:p-7 shadow-[0_24px_55px_-36px_rgba(15,23,42,0.32)] backdrop-blur">
                <h3 className="text-2xl font-black text-slate-900">Auction workflow built for fast organizers</h3>
                <p className="mt-2 text-slate-600">
                    Move from setup to live control with a clear step rhythm designed for pressure moments.
                </p>
                <ol className="mt-6 space-y-4">
                    {steps.map((step) => (
                        <li
                            key={step.step}
                            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:bg-white"
                        >
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-black text-slate-600">
                                    {step.step}
                                </span>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900">{step.title}</h4>
                                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">{step.description}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="relative rounded-[30px] border border-slate-200 bg-[linear-gradient(145deg,#eff6ff,#fdf2f8_45%,#f0fdfa)] p-5 md:p-6 shadow-[0_24px_55px_-36px_rgba(15,23,42,0.35)]">
                <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Organizer Console</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] text-slate-500">Teams Added</p>
                            <p className="text-xl font-black text-slate-900">10/10</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] text-slate-500">Players Ready</p>
                            <p className="text-xl font-black text-slate-900">120</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] text-slate-500">Bid Tiers</p>
                            <p className="text-xl font-black text-slate-900">4</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] text-slate-500">Active Round</p>
                            <p className="text-xl font-black text-slate-900">Round 4</p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900">Live Activity Feed</p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                        </span>
                    </div>
                    <ul className="mt-3 space-y-2.5 text-sm">
                        <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                            Delhi Dynamos bid ₹7.8L on R. Sharma
                        </li>
                        <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                            Increment moved to +₹20,000 tier
                        </li>
                        <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                            3 teams still active in current race
                        </li>
                    </ul>
                </div>

                <div className="pointer-events-none absolute right-6 -top-4 hidden md:block rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 shadow-md">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-indigo-600">Role Focus</p>
                    <p className="text-sm font-black text-indigo-800">All-Rounder Demand ↑</p>
                </div>
            </div>
        </section>
    )
}
