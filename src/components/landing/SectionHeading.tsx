type SectionHeadingProps = {
    eyebrow: string
    title: string
    description: string
    center?: boolean
}

export function SectionHeading({ eyebrow, title, description, center = false }: SectionHeadingProps) {
    return (
        <header className={center ? 'text-center' : ''}>
            <p className="inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                {eyebrow}
            </p>
            <h2 className="mt-3 text-3xl md:text-[42px] leading-[1.1] font-black tracking-tight text-slate-900">
                {title}
            </h2>
            <p className={`mt-3 text-slate-600 text-base leading-relaxed ${center ? 'max-w-2xl mx-auto' : 'max-w-2xl'}`}>
                {description}
            </p>
        </header>
    )
}
