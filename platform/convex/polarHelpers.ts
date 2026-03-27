import { v } from "convex/values"
import { internalQuery, query } from "./_generated/server"
import { polar } from "./polarClient"
import { getProductPlan, type PlanId } from "./lib/plans"
import { requireAuth } from "./lib/auth"

export const getAuthInfoWithEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const clerkUserId = identity.subject
    const clerkOrgId = (identity as { org_id?: string }).org_id

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first()

    if (!user) return null

    if (!clerkOrgId) return null

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", clerkOrgId))
      .first()

    if (!org) return null

    return {
      organizationId: org._id as string,
      email: (identity as { email?: string }).email ?? `${clerkUserId}@struere.dev`,
    }
  },
})

export const getOrgPlan = internalQuery({
  args: { organizationId: v.string() },
  handler: async (ctx, args): Promise<{ plan: PlanId; status: string; currentPeriodEnd: number | null }> => {
    const sub = await polar.getCurrentSubscription(ctx, { userId: args.organizationId })
    if (!sub) {
      return { plan: "free", status: "none", currentPeriodEnd: null }
    }
    const plan = sub.status === "active" ? getProductPlan(sub.productId) : "free" as PlanId
    const currentPeriodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null
    return { plan, status: sub.status, currentPeriodEnd }
  },
})

export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx)
    const sub = await polar.getCurrentSubscription(ctx, { userId: auth.organizationId as string })
    if (!sub) return null
    const plan = sub.status === "active" ? getProductPlan(sub.productId) : "free" as PlanId
    return {
      plan,
      status: sub.cancelAtPeriodEnd ? "cancelling" : sub.status === "active" ? "active" : sub.status,
      currentPeriodStart: new Date(sub.currentPeriodStart).getTime(),
      currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000,
      productKey: sub.productKey,
    }
  },
})
