type TrustedRowProps = {
    items: string[]
}

export function TrustedRow({ items }: TrustedRowProps) {
    return (
        <section className="mt-10 md:mt-12">
            <p className="text-center text-sm font-medium text-slate-500">
                Trusted by organizers running competitive cricket auction nights
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {items.map((item) => (
                    <div
                        key={item}
                        className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs md:text-sm text-slate-600 shadow-sm"
                    >
                        {item}
                    </div>
                ))}
            </div>
        </section>
    )
}
