import { internalMutation } from "../_generated/server"
import { makeFunctionReference } from "convex/server"

const migrateCreditBalancesRef = makeFunctionReference<"mutation">("migrations/centsToMicrodollars:migrateCreditBalances")
const migrateCreditTransactionsRef = makeFunctionReference<"mutation">("migrations/centsToMicrodollars:migrateCreditTransactions")
const migrateExecutionsRef = makeFunctionReference<"mutation">("migrations/centsToMicrodollars:migrateExecutions")

const BATCH_SIZE = 100
const MULTIPLIER = 10_000

export const migrateCreditBalances = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("creditBalances")
      .filter((q) => q.lt(q.field("balance"), 10_000))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, {
        balance: record.balance * MULTIPLIER,
        updatedAt: Date.now(),
      })
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, migrateCreditBalancesRef, {})
    }

    return { patched: count }
  },
})

export const migrateCreditTransactions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("creditTransactions")
      .filter((q) => q.lt(q.field("amount"), 10_000))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      const patch: any = {
        amount: record.amount * MULTIPLIER,
      }
      if (record.balanceAfter !== undefined) {
        patch.balanceAfter = record.balanceAfter * MULTIPLIER
      }
      await ctx.db.patch(record._id, patch)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, migrateCreditTransactionsRef, {})
    }

    return { patched: count }
  },
})

export const migrateExecutions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("executions")
      .filter((q) =>
        q.and(
          q.neq(q.field("creditsConsumed" as any), undefined),
          q.lt(q.field("creditsConsumed" as any), 10_000)
        )
      )
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      const current = (record as any).creditsConsumed
      if (current !== undefined && current > 0) {
        await ctx.db.patch(record._id, {
          creditsConsumed: current * MULTIPLIER,
        } as any)
        count++
      }
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, migrateExecutionsRef, {})
    }

    return { patched: count }
  },
})

export const runAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, migrateCreditBalancesRef, {})
    await ctx.scheduler.runAfter(0, migrateCreditTransactionsRef, {})
    await ctx.scheduler.runAfter(0, migrateExecutionsRef, {})
    return { scheduled: true }
  },
})
