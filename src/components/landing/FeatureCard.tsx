import type { FeatureCardContent } from '@/components/landing/data'

type FeatureCardProps = {
    item: FeatureCardContent
}

export function FeatureCard({ item }: FeatureCardProps) {
    return (
        <article className="rounded-3xl border border-slate-200/90 bg-white/80 p-6 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.35)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_55px_-35px_rgba(15,23,42,0.38)]">
            <p className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {item.label}
            </p>
            <h3 className="mt-4 text-xl leading-tight font-bold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-slate-600 leading-relaxed">{item.description}</p>
            <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-700">{item.stat}</p>
            </div>
        </article>
    )
}
