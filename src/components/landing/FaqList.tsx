import type { FaqItem } from '@/components/landing/data'

type FaqListProps = {
    items: FaqItem[]
}

export function FaqList({ items }: FaqListProps) {
    return (
        <div className="space-y-3">
            {items.map((item) => (
                <details
                    key={item.question}
                    className="group rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition-colors hover:bg-white"
                >
                    <summary className="list-none cursor-pointer font-semibold text-slate-900 flex items-center justify-between gap-4">
                        {item.question}
                        <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 text-slate-600 leading-relaxed">{item.answer}</p>
                </details>
            ))}
        </div>
    )
}
