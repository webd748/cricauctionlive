export type BillingPlanCode =
    | 'league-6'
    | 'league-8'
    | 'league-10'
    | 'league-12'

export type BillingPlan = {
    code: BillingPlanCode
    name: string
    maxTeams: number
    amountInr: number
    tagline: string
    features: string[]
}

export const BILLING_PLANS: BillingPlan[] = [
    {
        code: 'league-6',
        name: 'Starter 6',
        maxTeams: 6,
        amountInr: 1499,
        tagline: 'Perfect for compact club auctions',
        features: ['Up to 6 teams', 'Live admin controls', 'Player & team setup'],
    },
    {
        code: 'league-8',
        name: 'Pro 8',
        maxTeams: 8,
        amountInr: 2499,
        tagline: 'Ideal for mid-size competitive leagues',
        features: ['Up to 8 teams', 'Realtime live dashboard', 'Bid tier controls'],
    },
    {
        code: 'league-10',
        name: 'Elite 10',
        maxTeams: 10,
        amountInr: 3499,
        tagline: 'For serious tournament organizers',
        features: ['Up to 10 teams', 'Advanced live command flow', 'Setup + review tools'],
    },
    {
        code: 'league-12',
        name: 'Premier 12',
        maxTeams: 12,
        amountInr: 4499,
        tagline: 'Full-scale auction night experience',
        features: ['Up to 12 teams', 'High-intensity bidding support', 'Priority support workflow'],
    },
]

export function getBillingPlan(planCode: string): BillingPlan | null {
    return BILLING_PLANS.find((plan) => plan.code === planCode) ?? null
}
