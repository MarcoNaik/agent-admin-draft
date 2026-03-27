import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "./_generated/dataModel"
import { getPlanLimits, getProductPlan } from "./lib/plans"
import { polar } from "./polarClient"

const updateKeyLimitRef = makeFunctionReference<"action">("orgKeys:updateKeyLimit")

export const seedWeeklyCredits = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">

    const sub = await polar.getCurrentSubscription(ctx, { userId: args.organizationId })
    if (!sub || sub.status !== "active") return
    const plan = getProductPlan(sub.productId)
    const limits = getPlanLimits(plan)
    const WEEKLY_CREDITS = limits.weeklyCredits

    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
    const description = `Weekly credits - ${plan} plan (week-${weekNumber})`

    const alreadySeeded = await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId))
      .filter((q) => q.eq(q.field("description"), description))
      .first()
    if (alreadySeeded) return

    const balanceDoc = await ctx.db
      .query("creditBalances")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId))
      .first()

    const purchasedCredits = balanceDoc
      ? (balanceDoc.purchasedCredits ?? balanceDoc.balance)
      : 0

    const newBalance = WEEKLY_CREDITS + purchasedCredits
    const weeklyCreditsResetAt = Date.now() + 7 * 24 * 60 * 60 * 1000

    if (balanceDoc) {
      await ctx.db.patch(balanceDoc._id, {
        balance: newBalance,
        subscriptionCredits: WEEKLY_CREDITS,
        purchasedCredits,
        weeklyCreditsResetAt,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("creditBalances", {
        organizationId: orgId,
        balance: newBalance,
        subscriptionCredits: WEEKLY_CREDITS,
        purchasedCredits: 0,
        weeklyCreditsResetAt,
        updatedAt: Date.now(),
      })
    }

    await ctx.db.insert("creditTransactions", {
      organizationId: orgId,
      type: "addition",
      amount: WEEKLY_CREDITS,
      balanceAfter: newBalance,
      reconciled: true,
      description,
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, updateKeyLimitRef, {
      organizationId: orgId,
      newBalanceMicrodollars: newBalance,
    })
  },
})
