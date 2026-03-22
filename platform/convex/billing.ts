import { v } from "convex/values"
import { query, mutation, action, internalQuery, internalMutation, MutationCtx } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "./_generated/dataModel"
import { requireAuth, requireOrgAdmin } from "./lib/auth"

const getAuthInfoRef = makeFunctionReference<"query">("chat:getAuthInfo")
const isOrgAdminInternalRef = makeFunctionReference<"query">("integrations:isOrgAdminInternal")
const updateKeyLimitRef = makeFunctionReference<"action">("orgKeys:updateKeyLimit")

function formatMicrodollars(microdollars: number): string {
  const dollars = microdollars / 1_000_000
  if (dollars >= 0.01) return `$${dollars.toFixed(2)}`
  if (dollars >= 0.0001) return `$${dollars.toFixed(4)}`
  return `$${dollars.toFixed(6)}`
}

async function getOrCreateBalance(ctx: MutationCtx, organizationId: Id<"organizations">) {
  const existing = await ctx.db
    .query("creditBalances")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .first()

  if (existing) return existing

  const now = Date.now()
  const id = await ctx.db.insert("creditBalances", {
    organizationId,
    balance: 0,
    updatedAt: now,
  })
  return (await ctx.db.get(id))!
}

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx)

    const balance = await ctx.db
      .query("creditBalances")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .first()

    return {
      balance: balance?.balance ?? 0,
      updatedAt: balance?.updatedAt ?? Date.now(),
    }
  },
})

export const getTransactions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    return await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .order("desc")
      .take(args.limit ?? 50)
  },
})

export const getBalanceInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("creditBalances")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first()

    return balance?.balance ?? 0
  },
})

export const deductCredits = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    amount: v.number(),
    description: v.string(),
    executionId: v.optional(v.id("executions")),
    metadata: v.optional(v.any()),
    costDriver: v.optional(v.string()),
    agentId: v.optional(v.string()),
    channel: v.optional(v.string()),
    actorId: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const balanceDoc = await getOrCreateBalance(ctx, args.organizationId)
    const newBalance = balanceDoc.balance - args.amount

    if (newBalance < 0) {
      console.error("OVERDRAFT", {
        organizationId: args.organizationId,
        amount: args.amount,
        previousBalance: balanceDoc.balance,
        newBalance,
        description: args.description,
      })
    }

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      updatedAt: Date.now(),
    })

    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      type: "deduction",
      amount: args.amount,
      balanceAfter: newBalance,
      reconciled: true,
      description: args.description,
      executionId: args.executionId,
      metadata: args.metadata,
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, updateKeyLimitRef, {
      organizationId: args.organizationId,
      newBalanceMicrodollars: newBalance,
    })

    if (args.costDriver) {
      const now = new Date()
      const dayKey = now.toISOString().slice(0, 10)
      const monthKey = now.toISOString().slice(0, 7)

      for (const [periodType, period] of [["day", dayKey], ["month", monthKey]] as const) {
        const existing = await ctx.db
          .query("costRollups")
          .withIndex("by_org_period", (q) =>
            q.eq("organizationId", args.organizationId).eq("periodType", periodType).eq("period", period)
          )
          .first()

        if (existing) {
          const byAgent = (existing.byAgent ?? {}) as Record<string, number>
          const byChannel = (existing.byChannel ?? {}) as Record<string, number>
          const byDriver = (existing.byDriver ?? {}) as Record<string, number>
          const byActor = (existing.byActor ?? {}) as Record<string, number>
          const byModel = (existing.byModel ?? {}) as Record<string, number>

          if (args.agentId) byAgent[args.agentId] = (byAgent[args.agentId] ?? 0) + args.amount
          if (args.channel) byChannel[args.channel] = (byChannel[args.channel] ?? 0) + args.amount
          byDriver[args.costDriver] = (byDriver[args.costDriver] ?? 0) + args.amount
          if (args.actorId) byActor[args.actorId] = (byActor[args.actorId] ?? 0) + args.amount
          if (args.model) byModel[args.model] = (byModel[args.model] ?? 0) + args.amount

          await ctx.db.patch(existing._id, {
            totalCost: existing.totalCost + args.amount,
            totalCount: existing.totalCount + 1,
            byAgent,
            byChannel,
            byDriver,
            byActor,
            byModel,
            updatedAt: Date.now(),
          })
        } else {
          const byAgent: Record<string, number> = {}
          const byChannel: Record<string, number> = {}
          const byDriver: Record<string, number> = {}
          const byActor: Record<string, number> = {}
          const byModel: Record<string, number> = {}

          if (args.agentId) byAgent[args.agentId] = args.amount
          if (args.channel) byChannel[args.channel] = args.amount
          byDriver[args.costDriver] = args.amount
          if (args.actorId) byActor[args.actorId] = args.amount
          if (args.model) byModel[args.model] = args.amount

          await ctx.db.insert("costRollups", {
            organizationId: args.organizationId,
            period,
            periodType,
            totalCost: args.amount,
            totalCount: 1,
            byAgent,
            byChannel,
            byDriver,
            byActor,
            byModel,
            updatedAt: Date.now(),
          })
        }
      }
    }
  },
})


export const recordCostRollup = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    amount: v.number(),
    model: v.string(),
    agentId: v.optional(v.string()),
    channel: v.optional(v.string()),
    actorId: v.optional(v.string()),
    costDriver: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const driver = args.costDriver ?? "llm"
    const now = new Date()
    const dayKey = now.toISOString().slice(0, 10)
    const monthKey = now.toISOString().slice(0, 7)

    for (const [periodType, period] of [["day", dayKey], ["month", monthKey]] as const) {
      const existing = await ctx.db
        .query("costRollups")
        .withIndex("by_org_period", (q) =>
          q.eq("organizationId", args.organizationId).eq("periodType", periodType).eq("period", period)
        )
        .first()

      if (existing) {
        const byAgent = (existing.byAgent ?? {}) as Record<string, number>
        const byChannel = (existing.byChannel ?? {}) as Record<string, number>
        const byDriver = (existing.byDriver ?? {}) as Record<string, number>
        const byActor = (existing.byActor ?? {}) as Record<string, number>
        const byModel = (existing.byModel ?? {}) as Record<string, number>

        if (args.agentId) byAgent[args.agentId] = (byAgent[args.agentId] ?? 0) + args.amount
        if (args.channel) byChannel[args.channel] = (byChannel[args.channel] ?? 0) + args.amount
        byDriver[driver] = (byDriver[driver] ?? 0) + args.amount
        if (args.actorId) byActor[args.actorId] = (byActor[args.actorId] ?? 0) + args.amount
        byModel[args.model] = (byModel[args.model] ?? 0) + args.amount

        await ctx.db.patch(existing._id, {
          totalCost: existing.totalCost + args.amount,
          totalCount: existing.totalCount + 1,
          byAgent,
          byChannel,
          byDriver,
          byActor,
          byModel,
          updatedAt: Date.now(),
        })
      } else {
        const byAgent: Record<string, number> = {}
        const byChannel: Record<string, number> = {}
        const byDriver: Record<string, number> = {}
        const byActor: Record<string, number> = {}
        const byModel: Record<string, number> = {}

        if (args.agentId) byAgent[args.agentId] = args.amount
        if (args.channel) byChannel[args.channel] = args.amount
        byDriver[driver] = args.amount
        if (args.actorId) byActor[args.actorId] = args.amount
        byModel[args.model] = args.amount

        await ctx.db.insert("costRollups", {
          organizationId: args.organizationId,
          period,
          periodType,
          totalCost: args.amount,
          totalCount: 1,
          byAgent,
          byChannel,
          byDriver,
          byActor,
          byModel,
          updatedAt: Date.now(),
        })
      }
    }
  },
})

export const reconcileBalances = internalMutation({
  handler: async (ctx) => {
    const unprocessed = await ctx.db
      .query("creditTransactions")
      .withIndex("by_reconciled", (q) => q.eq("reconciled", false))
      .take(100)

    if (unprocessed.length === 0) return

    for (const tx of unprocessed) {
      const balanceDoc = await getOrCreateBalance(ctx, tx.organizationId)

      const newBalance = tx.type === "deduction"
        ? balanceDoc.balance - tx.amount
        : balanceDoc.balance + tx.amount

      await ctx.db.patch(balanceDoc._id, {
        balance: newBalance,
        updatedAt: Date.now(),
      })

      await ctx.db.patch(tx._id, { balanceAfter: newBalance, reconciled: true })
    }
  },
})

export const addCredits = mutation({
  args: {
    amount: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    if (args.amount <= 0) {
      throw new Error("Amount must be positive")
    }

    const balanceDoc = await getOrCreateBalance(ctx, auth.organizationId)
    const newBalance = balanceDoc.balance + args.amount

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      updatedAt: Date.now(),
    })

    await ctx.db.insert("creditTransactions", {
      organizationId: auth.organizationId,
      type: "addition",
      amount: args.amount,
      balanceAfter: newBalance,
      reconciled: true,
      description: args.description ?? "Manual credit addition",
      createdBy: auth.userId,
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, updateKeyLimitRef, {
      organizationId: auth.organizationId,
      newBalanceMicrodollars: newBalance,
    })

    return newBalance
  },
})

export const adjustBalance = mutation({
  args: {
    newBalance: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    if (args.newBalance < 0) {
      throw new Error("Balance cannot be set to a negative value")
    }

    const balanceDoc = await getOrCreateBalance(ctx, auth.organizationId)
    const difference = args.newBalance - balanceDoc.balance

    await ctx.db.patch(balanceDoc._id, {
      balance: args.newBalance,
      updatedAt: Date.now(),
    })

    await ctx.db.insert("creditTransactions", {
      organizationId: auth.organizationId,
      type: "adjustment",
      amount: Math.abs(difference),
      balanceAfter: args.newBalance,
      reconciled: true,
      description: args.description ?? `Balance adjusted from ${formatMicrodollars(balanceDoc.balance)} to ${formatMicrodollars(args.newBalance)}`,
      createdBy: auth.userId,
      createdAt: Date.now(),
    })

    return args.newBalance
  },
})

export const createCheckoutSession = action({
  args: {
    amount: v.number(),
    successUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string }> => {
    const auth: { userId: Id<"users">; organizationId: Id<"organizations"> } | null =
      await ctx.runQuery(getAuthInfoRef)
    if (!auth) {
      throw new Error("Not authenticated")
    }

    const isAdmin: boolean = await ctx.runQuery(isOrgAdminInternalRef, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    })
    if (!isAdmin) {
      throw new Error("Admin access required")
    }

    if (args.amount < 100) {
      throw new Error("Minimum purchase is $1.00")
    }

    const polarBase = process.env.POLAR_SERVER === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh"
    const resp = await fetch(`${polarBase}/v1/checkouts/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [process.env.POLAR_PRODUCT_ID],
        amount: args.amount,
        success_url: args.successUrl,
        customer_external_id: auth.organizationId,
        metadata: {
          organizationId: auth.organizationId,
          userId: auth.userId,
        },
      }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`Polar checkout failed: ${text}`)
    }

    const checkout = await resp.json() as { url: string }
    return { checkoutUrl: checkout.url }
  },
})

export const addCreditsFromPolar = internalMutation({
  args: {
    organizationId: v.string(),
    amount: v.number(),
    polarOrderId: v.string(),
    polarCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("_id"), args.organizationId as Id<"organizations">))
      .first()
    if (!org) {
      throw new Error("Organization not found")
    }

    const duplicate = await ctx.db
      .query("processedPayments")
      .withIndex("by_polar_order", (q) => q.eq("polarOrderId", args.polarOrderId))
      .first()
    if (duplicate) return

    const recentTxs = await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .order("desc")
      .take(100)
    const duplicateLegacy = recentTxs.find(
      (tx: any) => tx.metadata?.polarOrderId === args.polarOrderId
    )
    if (duplicateLegacy) return

    const balanceDoc = await getOrCreateBalance(ctx, org._id)
    const microdollars = args.amount * 10_000
    const newBalance = balanceDoc.balance + microdollars

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      updatedAt: Date.now(),
    })

    await ctx.db.insert("creditTransactions", {
      organizationId: org._id,
      type: "purchase",
      amount: microdollars,
      balanceAfter: newBalance,
      reconciled: true,
      description: `Credit purchase via Polar (${formatMicrodollars(microdollars)})`,
      metadata: { polarOrderId: args.polarOrderId },
      createdAt: Date.now(),
    })

    await ctx.db.insert("processedPayments", {
      polarOrderId: args.polarOrderId,
      organizationId: org._id,
      amount: microdollars,
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, updateKeyLimitRef, {
      organizationId: org._id,
      newBalanceMicrodollars: newBalance,
    })

    if (args.polarCustomerId && !org.polarCustomerId) {
      await ctx.db.patch(org._id, { polarCustomerId: args.polarCustomerId })
    }
  },
})

export const seedWelcomeCredits = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("description"), "Welcome credits"))
      .first()

    if (existing) return

    const balanceDoc = await getOrCreateBalance(ctx, args.organizationId)
    const newBalance = balanceDoc.balance + 250_000

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      updatedAt: Date.now(),
    })

    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      type: "addition",
      amount: 250_000,
      balanceAfter: newBalance,
      reconciled: true,
      description: "Welcome credits",
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, updateKeyLimitRef, {
      organizationId: args.organizationId,
      newBalanceMicrodollars: newBalance,
    })
  },
})

export const getCostRollup = query({
  args: {
    periodType: v.union(v.literal("day"), v.literal("month")),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    return await ctx.db
      .query("costRollups")
      .withIndex("by_org_period", (q) =>
        q.eq("organizationId", auth.organizationId).eq("periodType", args.periodType).eq("period", args.period)
      )
      .first()
  },
})

export const getCostTrend = query({
  args: {
    periodType: v.union(v.literal("day"), v.literal("month")),
    periods: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const results = []
    for (const period of args.periods) {
      const rollup = await ctx.db
        .query("costRollups")
        .withIndex("by_org_period", (q) =>
          q.eq("organizationId", auth.organizationId).eq("periodType", args.periodType).eq("period", period)
        )
        .first()
      results.push({ period, ...(rollup ? { totalCost: rollup.totalCost, totalCount: rollup.totalCount, byAgent: rollup.byAgent, byChannel: rollup.byChannel, byDriver: rollup.byDriver, byActor: rollup.byActor, byModel: rollup.byModel } : { totalCost: 0, totalCount: 0 }) })
    }
    return results
  },
})
