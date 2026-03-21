export type FeatureCardContent = {
    label: string
    title: string
    description: string
    stat: string
}

export type WorkflowStep = {
    step: string
    title: string
    description: string
}

export type Testimonial = {
    quote: string
    name: string
    role: string
    league: string
}

export type FaqItem = {
    question: string
    answer: string
}

export const TRUSTED_LEAGUES = [
    'City Cricket League',
    'College Premier Cup',
    'Weekend Super XI',
    'Community T20 Series',
    'Franchise Trials',
    'Corporate Cricket Masters',
]

export const FEATURE_CARDS: FeatureCardContent[] = [
    {
        label: 'Live Engine',
        title: 'Real-time bidding with clean round control',
        description:
            'Raise, lock, and close bids with instant updates across admin and live room screens.',
        stat: '< 120ms bid sync',
    },
    {
        label: 'Purse Intelligence',
        title: 'Track remaining purse and max bid value',
        description:
            'Every team card shows purse pressure, squad slots left, and bidding headroom in one view.',
        stat: 'Wallet + MBV view',
    },
    {
        label: 'Player Pool',
        title: 'Import, normalize, and manage players fast',
        description:
            'Use CSV import, role tagging, and quick edits to keep the player pool auction-ready.',
        stat: 'Bulk-ready setup',
    },
    {
        label: 'Auction Fairness',
        title: 'Consistent increments and transparent outcomes',
        description:
            'Bid tiers, round states, and sold/unsold decisions are controlled with auditable actions.',
        stat: 'Rule-based control',
    },
    {
        label: 'Organizer Console',
        title: 'One command center for setup to final hammer',
        description:
            'Move from plan, payment, and setup to live auction without switching tools.',
        stat: 'End-to-end workflow',
    },
    {
        label: 'Broadcast View',
        title: 'Premium live board for room and stream',
        description:
            'Display current player, highest bidder, and market momentum in a polished live format.',
        stat: 'Audience ready',
    },
]

export const WORKFLOW_STEPS: WorkflowStep[] = [
    {
        step: '01',
        title: 'Create league and choose plan',
        description:
            'Select your team capacity, activate billing, and unlock the auction workspace.',
    },
    {
        step: '02',
        title: 'Load teams, players, and rules',
        description:
            'Configure purse, base price, bid tiers, squad size, and participant teams.',
    },
    {
        step: '03',
        title: 'Run live rounds with admin control',
        description:
            'Control current player, bid increments, sold/unsold status, and round flow in real time.',
    },
    {
        step: '04',
        title: 'Review outcomes and team strategy',
        description:
            'Track sold lists, purse usage, and roster balance for transparent post-auction analysis.',
    },
]

export const TESTIMONIALS: Testimonial[] = [
    {
        quote:
            'The room felt like a professional franchise auction. Every captain trusted the bid flow.',
        name: 'Rahul M',
        role: 'Auction Host',
        league: 'Sunday Elite League',
    },
    {
        quote:
            'Purse and squad slot visibility changed our strategy. We made smarter decisions under pressure.',
        name: 'Afiya S',
        role: 'Team Owner',
        league: 'City Cricket League',
    },
    {
        quote:
            'Setup took less than an hour, and the live dashboard kept both hall and stream audiences engaged.',
        name: 'Nikhil P',
        role: 'Organizer',
        league: 'Corporate Cricket Cup',
    },
]

export const FAQS: FaqItem[] = [
    {
        question: 'Can we run indoor auction hall and live stream together?',
        answer:
            'Yes. Use the admin command console for operations and project the live board for hall and stream viewers simultaneously.',
    },
    {
        question: 'How does bidding fairness stay consistent?',
        answer:
            'Bid increments, auction state transitions, and sold/unsold actions follow controlled server-side logic and role checks.',
    },
    {
        question: 'Do we support Google sign-in for organizers?',
        answer:
            'Yes. Organizers can register with Google and continue to plan selection and payment verification.',
    },
    {
        question: 'Can we import players from Google Forms exports?',
        answer:
            'Yes. Upload CSV with required headers and the platform maps player details into the auction pool.',
    },
    {
        question: 'Is this suitable for small and large leagues?',
        answer:
            'Yes. Plans are capacity-based and the interface scales from compact club auctions to larger multi-team events.',
    },
]
