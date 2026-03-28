export type BillingPlanCode = 'free' | 'p2' | 'p3' | 'p4' | 'p5'

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
        code: 'free',
        name: 'Free',
        maxTeams: 4,
        amountInr: 0,
        tagline: 'Get started with a compact auction room',
        features: ['Up to 4 teams', 'Core live controls', 'Player & team setup'],
    },
    {
        code: 'p2',
        name: 'P2',
        maxTeams: 8,
        amountInr: 1999,
        tagline: 'Balanced setup for growing leagues',
        features: ['Up to 8 teams', 'Realtime live dashboard', 'Bid tier controls'],
    },
    {
        code: 'p3',
        name: 'P3',
        maxTeams: 12,
        amountInr: 2599,
        tagline: 'Expanded capacity for larger tournaments',
        features: ['Up to 12 teams', 'Advanced live command flow', 'Setup + review tools'],
    },
    {
        code: 'p4',
        name: 'P4',
        maxTeams: 16,
        amountInr: 2999,
        tagline: 'High-capacity package for serious events',
        features: ['Up to 16 teams', 'High-intensity bidding support', 'Priority support workflow'],
    },
    {
        code: 'p5',
        name: 'P5',
        maxTeams: 32,
        amountInr: 4599,
        tagline: 'Enterprise-scale control for mega auctions',
        features: ['Up to 32 teams', 'All premium workflow controls', 'Priority operations support'],
    },
]

export function getBillingPlan(planCode: string): BillingPlan | null {
    return BILLING_PLANS.find((plan) => plan.code === planCode) ?? null
}
