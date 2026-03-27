export const PLANS = {
  free: {
    maxAgents: 3,
    maxAutomations: 5,
    maxTeamMembers: 1,
    maxWhatsAppConnections: 1,
    maxEvalSuites: 1,
    weeklyCredits: 0,
    extraSeatPrice: 0,
  },
  starter: {
    maxAgents: Infinity,
    maxAutomations: Infinity,
    maxTeamMembers: 5,
    maxWhatsAppConnections: 5,
    maxEvalSuites: Infinity,
    weeklyCredits: 7_500_000,
    extraSeatPrice: 500,
  },
  pro: {
    maxAgents: Infinity,
    maxAutomations: Infinity,
    maxTeamMembers: 20,
    maxWhatsAppConnections: Infinity,
    maxEvalSuites: Infinity,
    weeklyCredits: 75_000_000,
    extraSeatPrice: 500,
  },
} as const

export type PlanId = keyof typeof PLANS

export const PRODUCT_TO_PLAN: Record<string, PlanId> = {
  [process.env.POLAR_STARTER_PRODUCT_ID ?? "7f4214be-233e-4993-bc2f-71bab22d52fb"]: "starter",
  [process.env.POLAR_PRO_PRODUCT_ID ?? "383b0ab1-6ad0-4cdf-9664-b051457c9e29"]: "pro",
}

export function getProductPlan(productId: string): PlanId {
  return PRODUCT_TO_PLAN[productId] ?? "free"
}

export function getPlanLimits(plan: string) {
  if (plan in PLANS) return PLANS[plan as PlanId]
  return PLANS.free
}
