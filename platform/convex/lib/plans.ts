export const PLANS = {
  starter: {
    maxAgents: 15,
    weeklyCredits: 7_500_000,
    modelTierAccess: ["efficient", "standard"] as const,
    maxCostPerRequest: 2_000_000,
    tools: ["*"] as const,
  },
  pro: {
    maxAgents: Infinity,
    weeklyCredits: 18_750_000,
    modelTierAccess: ["efficient", "standard", "premium"] as const,
    maxCostPerRequest: 10_000_000,
    tools: ["*"] as const,
  },
} as const

export type PlanId = keyof typeof PLANS

export const PRODUCT_TO_PLAN: Record<string, PlanId> = {
  [process.env.POLAR_STARTER_PRODUCT_ID ?? "7f4214be-233e-4993-bc2f-71bab22d52fb"]: "starter",
  [process.env.POLAR_PRO_PRODUCT_ID ?? "383b0ab1-6ad0-4cdf-9664-b051457c9e29"]: "pro",
}

export function getProductPlan(productId: string): PlanId {
  return PRODUCT_TO_PLAN[productId] ?? "starter"
}

export function getPlanLimits(plan: string) {
  if (plan in PLANS) return PLANS[plan as PlanId]
  return PLANS.starter
}

export function getModelTier(outputPerMTok: number): "efficient" | "standard" | "premium" {
  if (outputPerMTok < 2) return "efficient"
  if (outputPerMTok <= 20) return "standard"
  return "premium"
}

export function canUseModelTier(plan: string, tier: "efficient" | "standard" | "premium"): boolean {
  const limits = getPlanLimits(plan)
  return (limits.modelTierAccess as readonly string[]).includes(tier)
}
