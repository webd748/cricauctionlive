import type { Testimonial } from '@/components/landing/data'

type TestimonialCardProps = {
    item: Testimonial
}

export function TestimonialCard({ item }: TestimonialCardProps) {
    return (
        <article className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_22px_44px_-35px_rgba(15,23,42,0.3)] backdrop-blur">
            <p className="text-slate-700 leading-relaxed">“{item.quote}”</p>
            <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="font-bold text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">{item.role}</p>
                <p className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {item.league}
                </p>
            </div>
        </article>
    )
}
