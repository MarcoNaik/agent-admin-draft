import { internalAction, internalQuery, internalMutation } from "../_generated/server"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

const fetchBatchRef = makeFunctionReference<"query">("migrations/backfillCostRollups:fetchBatch")
const fetchExecutionRef = makeFunctionReference<"query">("migrations/backfillCostRollups:fetchExecution")
const upsertRollupRef = makeFunctionReference<"mutation">("migrations/backfillCostRollups:upsertRollup")

export const run = internalAction({
  args: {
    cursor: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 200

    const transactions: any[] = await ctx.runQuery(fetchBatchRef, {
      cursor: args.cursor,
      batchSize,
    })

    if (transactions.length === 0) {
      return { done: true, processed: 0 }
    }

    const rollupUpdates = new Map<
      string,
      {
        organizationId: string
        period: string
        periodType: "day" | "month"
        amount: number
        agentId?: string
        channel?: string
        actorId?: string
        model?: string
        costDriver: string
      }[]
    >()

    for (const tx of transactions) {
      let costDriver = "unknown"
      let agentId: string | undefined
      let channel: string | undefined
      let actorId: string | undefined
      let model: string | undefined

      if (tx.executionId) {
        costDriver = "llm"
        const exec = await ctx.runQuery(fetchExecutionRef, {
          executionId: tx.executionId,
        })
        if (exec) {
          agentId = exec.agentId
          channel = exec.channel
          actorId = exec.actorId
          model = exec.model
        }
      } else if (tx.metadata?.whatsappMessageId) {
        costDriver = "whatsapp"
        channel = "whatsapp"
      } else if (tx.metadata?.emailMessageId) {
        costDriver = "email"
      }

      const date = new Date(tx.createdAt)
      const dayKey = date.toISOString().slice(0, 10)
      const monthKey = date.toISOString().slice(0, 7)

      for (const [periodType, period] of [
        ["day", dayKey],
        ["month", monthKey],
      ] as const) {
        const key = `${tx.organizationId}:${periodType}:${period}`
        if (!rollupUpdates.has(key)) rollupUpdates.set(key, [])
        rollupUpdates.get(key)!.push({
          organizationId: tx.organizationId,
          period,
          periodType,
          amount: tx.amount,
          agentId,
          channel,
          actorId,
          model,
          costDriver,
        })
      }
    }

    for (const [_key, entries] of rollupUpdates) {
      const first = entries[0]
      await ctx.runMutation(upsertRollupRef, {
        organizationId: first.organizationId,
        period: first.period,
        periodType: first.periodType,
        entries: entries.map((e) => ({
          amount: e.amount,
          agentId: e.agentId,
          channel: e.channel,
          actorId: e.actorId,
          model: e.model,
          costDriver: e.costDriver,
        })),
      })
    }

    const lastTx = transactions[transactions.length - 1]
    return {
      done: transactions.length < batchSize,
      processed: transactions.length,
      nextCursor: lastTx._creationTime,
    }
  },
})

export const fetchBatch = internalQuery({
  args: {
    cursor: v.optional(v.number()),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("creditTransactions").order("asc")

    const results = await query.take(args.batchSize * 3)

    let filtered = results.filter((t) => t.type === "deduction")

    if (args.cursor) {
      filtered = filtered.filter((t) => t._creationTime > args.cursor!)
    }

    return filtered.slice(0, args.batchSize)
  },
})

export const fetchExecution = internalQuery({
  args: { executionId: v.id("executions") },
  handler: async (ctx, args) => {
    const exec = await ctx.db.get(args.executionId)
    if (!exec) return null
    return {
      agentId: exec.agentId as unknown as string,
      channel: exec.channel,
      actorId: exec.actorId,
      model: exec.model,
    }
  },
})

export const upsertRollup = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    period: v.string(),
    periodType: v.union(v.literal("day"), v.literal("month")),
    entries: v.array(
      v.object({
        amount: v.number(),
        agentId: v.optional(v.string()),
        channel: v.optional(v.string()),
        actorId: v.optional(v.string()),
        model: v.optional(v.string()),
        costDriver: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("costRollups")
      .withIndex("by_org_period", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("periodType", args.periodType)
          .eq("period", args.period),
      )
      .first()

    const byAgent = (existing?.byAgent ?? {}) as Record<string, number>
    const byChannel = (existing?.byChannel ?? {}) as Record<string, number>
    const byDriver = (existing?.byDriver ?? {}) as Record<string, number>
    const byActor = (existing?.byActor ?? {}) as Record<string, number>
    const byModel = (existing?.byModel ?? {}) as Record<string, number>
    let totalCost = existing?.totalCost ?? 0
    let totalCount = existing?.totalCount ?? 0

    for (const entry of args.entries) {
      totalCost += entry.amount
      totalCount++
      if (entry.agentId)
        byAgent[entry.agentId] = (byAgent[entry.agentId] ?? 0) + entry.amount
      if (entry.channel)
        byChannel[entry.channel] =
          (byChannel[entry.channel] ?? 0) + entry.amount
      byDriver[entry.costDriver] =
        (byDriver[entry.costDriver] ?? 0) + entry.amount
      if (entry.actorId)
        byActor[entry.actorId] =
          (byActor[entry.actorId] ?? 0) + entry.amount
      if (entry.model)
        byModel[entry.model] = (byModel[entry.model] ?? 0) + entry.amount
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalCost,
        totalCount,
        byAgent,
        byChannel,
        byDriver,
        byActor,
        byModel,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("costRollups", {
        organizationId: args.organizationId,
        period: args.period,
        periodType: args.periodType,
        totalCost,
        totalCount,
        byAgent,
        byChannel,
        byDriver,
        byActor,
        byModel,
        updatedAt: Date.now(),
      })
    }
  },
})
