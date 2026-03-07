import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { Id } from "../_generated/dataModel"

export const listOrgBalances = internalQuery({
  handler: async (ctx) => {
    const balances = await ctx.db.query("creditBalances").collect()
    return balances.map((b) => ({
      organizationId: b.organizationId,
      balance: b.balance,
      reservedCredits: b.reservedCredits ?? 0,
    }))
  },
})

export const clearStaleReservations = internalMutation({
  handler: async (ctx) => {
    const balances = await ctx.db.query("creditBalances").collect()

    for (const balance of balances) {
      if (balance.reservedCredits && balance.reservedCredits > 0) {
        const orgRuns = await ctx.db
          .query("evalRuns")
          .filter((q) =>
            q.and(
              q.eq(q.field("organizationId"), balance.organizationId),
              q.eq(q.field("status"), "running")
            )
          )
          .collect()

        const activeReservations = orgRuns.reduce(
          (sum, r) => sum + (r.reservedCredits ?? 0),
          0
        )

        await ctx.db.patch(balance._id, {
          reservedCredits: activeReservations,
          updatedAt: Date.now(),
        })
      }
    }
  },
})

export const rebuildOrgBalance = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    runningBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 500

    const balanceDoc = await ctx.db
      .query("creditBalances")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first()

    if (!balanceDoc) return { done: true, balance: 0 }

    const paginatedResult = await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("asc")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null })

    let currentBalance = args.runningBalance ?? 0

    for (const tx of paginatedResult.page) {
      if (tx.type === "deduction") {
        currentBalance -= tx.amount
      } else {
        currentBalance += tx.amount
      }
      await ctx.db.patch(tx._id, { balanceAfter: currentBalance })
    }

    if (paginatedResult.isDone) {
      await ctx.db.patch(balanceDoc._id, {
        balance: currentBalance,
        reservedCredits: 0,
        updatedAt: Date.now(),
      })
      return { done: true, balance: currentBalance }
    }

    return {
      done: false,
      cursor: paginatedResult.continueCursor,
      runningBalance: currentBalance,
    }
  },
})
