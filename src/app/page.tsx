import Link from 'next/link'
import { HeroAuctionBoard } from '@/components/landing/HeroAuctionBoard'
import { SectionHeading } from '@/components/landing/SectionHeading'
import { FeatureCard } from '@/components/landing/FeatureCard'
import { WorkflowShowcase } from '@/components/landing/WorkflowShowcase'
import { TestimonialCard } from '@/components/landing/TestimonialCard'
import { FaqList } from '@/components/landing/FaqList'
import {
    FAQS,
    FEATURE_CARDS,
    TESTIMONIALS,
    TRUSTED_LEAGUES,
    WORKFLOW_STEPS,
} from '@/components/landing/data'
import { TrustedRow } from '@/components/landing/TrustedRow'

export default function HomePage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_5%_0%,#d9e8ff,transparent_40%),radial-gradient(circle_at_95%_12%,#ffe6d7,transparent_38%),radial-gradient(circle_at_50%_100%,#dcfce7,transparent_34%),linear-gradient(180deg,#f8fbff_0%,#fefefe_56%,#ffffff_100%)] text-slate-900">
            <div className="mx-auto max-w-7xl px-4 md:px-8 pb-16 md:pb-24">
                <header className="pt-6 md:pt-8">
                    <nav className="rounded-2xl border border-white/85 bg-white/80 backdrop-blur-xl shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)]">
                        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3.5">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-[linear-gradient(135deg,#0ea5e9,#2563eb)] text-white font-black grid place-items-center shadow-lg shadow-sky-500/30">
                                    CA
                                </div>
                                <div>
                                    <p className="text-[15px] leading-tight font-bold">Cricket Auction</p>
                                    <p className="text-[11px] text-slate-500">Premium Live Auction Platform</p>
                                </div>
                            </div>

                            <div className="hidden md:flex items-center gap-6 text-sm text-slate-600 font-medium">
                                <a href="#features" className="hover:text-slate-900 transition-colors">
                                    Features
                                </a>
                                <a href="#workflow" className="hover:text-slate-900 transition-colors">
                                    Workflow
                                </a>
                                <a href="#testimonials" className="hover:text-slate-900 transition-colors">
                                    Reviews
                                </a>
                                <a href="#faq" className="hover:text-slate-900 transition-colors">
                                    FAQ
                                </a>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    href="/login"
                                    className="px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                                >
                                    Sign in
                                </Link>
                                <Link
                                    href="/register?next=/plans"
                                    className="px-4 md:px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-black transition-colors shadow-lg shadow-slate-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                >
                                    Register
                                </Link>
                            </div>
                        </div>
                    </nav>
                </header>

                <section className="mt-8 md:mt-10 rounded-[38px] border border-white/90 bg-[linear-gradient(160deg,#eef5ff_0%,#f5f9ff_24%,#fff6f1_62%,#f4fffb_100%)] shadow-[0_38px_100px_-56px_rgba(15,23,42,0.55)] overflow-hidden">
                    <div className="px-5 md:px-10 lg:px-14 pt-10 md:pt-14 pb-10 md:pb-14">
                        <div className="grid lg:grid-cols-[0.95fr_1.05fr] items-center gap-10 lg:gap-12">
                            <div>
                                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Auction Room Ready
                                </p>
                                <h1 className="mt-5 text-4xl md:text-5xl lg:text-[60px] leading-[1.02] font-black tracking-tight text-slate-900">
                                    Run high-stakes
                                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-600">
                                        cricket player auctions
                                    </span>
                                    with precision and pace.
                                </h1>
                                <p className="mt-5 text-slate-600 text-base md:text-lg max-w-xl leading-relaxed">
                                    From live player bidding to purse tracking and squad balance, this platform gives
                                    organizers and team owners a premium auction room experience.
                                </p>
                                <div className="mt-7 flex flex-wrap gap-3">
                                    <Link
                                        href="/register?next=/plans"
                                        className="px-6 py-3 rounded-xl bg-slate-900 text-white text-sm md:text-base font-semibold hover:bg-black transition-colors shadow-lg shadow-slate-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                                    >
                                        Start Auction Setup
                                    </Link>
                                    <Link
                                        href="/dashboard/live"
                                        className="px-6 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm md:text-base font-semibold hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                                    >
                                        Open Live Bid Room
                                    </Link>
                                    <Link
                                        href="/sample_players.csv"
                                        className="px-6 py-3 rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-800 text-sm md:text-base font-semibold hover:bg-cyan-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                                    >
                                        Download Sample CSV
                                    </Link>
                                </div>
                                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs md:text-sm text-slate-500">
                                    <span>Live player auction rounds</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span>Team demand and purse strategy</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span>Transparent fast decisions</span>
                                </div>
                            </div>

                            <HeroAuctionBoard />
                        </div>
                    </div>
                </section>

                <TrustedRow items={TRUSTED_LEAGUES} />

                <section id="features" className="mt-16">
                    <SectionHeading
                        eyebrow="Benefits"
                        title="Why leagues choose this auction platform"
                        description="Built with premium room presentation, operational clarity, and pressure-ready controls for organizers and teams."
                    />
                    <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {FEATURE_CARDS.map((item) => (
                            <FeatureCard key={item.title} item={item} />
                        ))}
                    </div>
                </section>

                <section id="workflow" className="mt-16">
                    <SectionHeading
                        eyebrow="Workflow"
                        title="A polished path from registration to live hammer"
                        description="The platform is structured to guide organizers through setup, payment, and live auction rounds without chaos."
                    />
                    <WorkflowShowcase steps={WORKFLOW_STEPS} />
                </section>

                <section id="testimonials" className="mt-16">
                    <SectionHeading
                        eyebrow="What Organizers Say"
                        title="Trusted in real competitive auction rooms"
                        description="Leagues use the platform to run clean, exciting, and transparent bidding experiences."
                        center
                    />
                    <div className="mt-7 grid gap-4 md:grid-cols-3">
                        {TESTIMONIALS.map((item) => (
                            <TestimonialCard key={item.name + item.league} item={item} />
                        ))}
                    </div>
                </section>

                <section id="faq" className="mt-16 grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
                    <div className="rounded-[30px] border border-cyan-200 bg-[linear-gradient(165deg,#f0f9ff_0%,#f8fafc_50%,#eefdf8_100%)] p-6 md:p-7 shadow-[0_25px_56px_-40px_rgba(14,116,144,0.45)]">
                        <p className="inline-flex rounded-full border border-cyan-200 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700">
                            FAQ
                        </p>
                        <h3 className="mt-3 text-3xl md:text-[40px] leading-[1.1] font-black text-slate-900">
                            Everything you need before auction night
                        </h3>
                        <p className="mt-3 text-slate-600">
                            Start with signup, complete plan and payment, set your teams and players, then run rounds
                            in a premium live room.
                        </p>
                        <Link
                            href="/register?next=/plans"
                            className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        >
                            Get Started
                        </Link>
                    </div>
                    <FaqList items={FAQS} />
                </section>

                <section className="mt-16 rounded-[34px] border border-white/90 bg-[linear-gradient(145deg,#0f172a,#1e293b_46%,#0f766e)] p-7 md:p-10 text-white shadow-[0_35px_85px_-50px_rgba(2,132,199,0.72)]">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Final CTA</p>
                            <h3 className="mt-2 text-3xl md:text-4xl font-black leading-tight max-w-2xl">
                                Make your next auction feel like a premium professional event.
                            </h3>
                            <p className="mt-3 text-cyan-100/90 max-w-xl">
                                Create your workspace, verify payment, configure teams and players, and go live with
                                confidence.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/register?next=/plans"
                                className="px-5 py-3 rounded-xl bg-white text-slate-900 font-bold text-sm md:text-base hover:bg-cyan-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                            >
                                Register Now
                            </Link>
                            <Link
                                href="/plans"
                                className="px-5 py-3 rounded-xl border border-cyan-300 text-cyan-50 font-bold text-sm md:text-base hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                            >
                                View Plans
                            </Link>
                        </div>
                    </div>
                </section>

                <footer className="mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-slate-500">
                    <p>© {new Date().getFullYear()} Cricket Auction Platform</p>
                    <div className="flex items-center gap-4">
                        <Link href="/login" className="hover:text-slate-700 transition-colors">
                            Sign in
                        </Link>
                        <Link href="/register?next=/plans" className="hover:text-slate-700 transition-colors">
                            Create account
                        </Link>
                        <Link href="/sample_players.csv" className="hover:text-slate-700 transition-colors">
                            Sample CSV
                        </Link>
                    </div>
                </footer>
            </div>
        </main>
    )
}
