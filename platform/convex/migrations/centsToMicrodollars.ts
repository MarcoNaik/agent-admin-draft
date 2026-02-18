import { internalMutation } from "../_generated/server"
import { internal } from "../_generated/api"

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
      await ctx.scheduler.runAfter(0, internal.migrations.centsToMicrodollars.migrateCreditBalances, {})
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
      await ctx.db.patch(record._id, {
        amount: record.amount * MULTIPLIER,
        balanceAfter: record.balanceAfter * MULTIPLIER,
      })
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.migrations.centsToMicrodollars.migrateCreditTransactions, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.centsToMicrodollars.migrateExecutions, {})
    }

    return { patched: count }
  },
})

export const runAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.migrations.centsToMicrodollars.migrateCreditBalances, {})
    await ctx.scheduler.runAfter(0, internal.migrations.centsToMicrodollars.migrateCreditTransactions, {})
    await ctx.scheduler.runAfter(0, internal.migrations.centsToMicrodollars.migrateExecutions, {})
    return { scheduled: true }
  },
})
