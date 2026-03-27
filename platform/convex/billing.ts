import { v } from "convex/values"
import { query, internalQuery, internalMutation, MutationCtx } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { getPlanLimits, getProductPlan } from "./lib/plans"
import { polar } from "./polarClient"

const updateKeyLimitRef = makeFunctionReference<"action">("orgKeys:updateKeyLimit")

function formatMicrodollars(microdollars: number): string {
  const dollars = microdollars / 1_000_000
  if (dollars >= 0.01) return `$${dollars.toFixed(2)}`
  if (dollars >= 0.0001) return `$${dollars.toFixed(4)}`
  return `$${dollars.toFixed(6)}`
}

function resolveCredits(doc: { balance: number; subscriptionCredits?: number; purchasedCredits?: number }) {
  const sub = doc.subscriptionCredits ?? 0
  const purchased = doc.purchasedCredits ?? doc.balance
  return { subscriptionCredits: sub, purchasedCredits: purchased }
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
    subscriptionCredits: 0,
    purchasedCredits: 0,
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

    if (!balance) {
      return {
        balance: 0,
        subscriptionCredits: 0,
        purchasedCredits: 0,
        weeklyCreditsResetAt: undefined as number | undefined,
        updatedAt: Date.now(),
      }
    }

    const { subscriptionCredits, purchasedCredits } = resolveCredits(balance)

    const sub = await polar.getCurrentSubscription(ctx, { userId: auth.organizationId as string })
    const plan = (sub && sub.status === "active") ? getProductPlan(sub.productId) : "free"
    const limits = getPlanLimits(plan)

    return {
      balance: subscriptionCredits + purchasedCredits,
      subscriptionCredits,
      purchasedCredits,
      weeklyCreditsLimit: limits.weeklyCredits,
      weeklyCreditsResetAt: balance.weeklyCreditsResetAt,
      updatedAt: balance.updatedAt,
    }
  },
})

export const getTransactions = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const pageSize = args.limit ?? 20

    const q = ctx.db
      .query("creditTransactions")
      .withIndex("by_org_created", (q) =>
        args.cursor
          ? q.eq("organizationId", auth.organizationId).lt("createdAt", args.cursor)
          : q.eq("organizationId", auth.organizationId)
      )
      .order("desc")

    const items = await q.take(pageSize + 1)
    const hasMore = items.length > pageSize
    const page = hasMore ? items.slice(0, pageSize) : items
    const nextCursor = hasMore ? page[page.length - 1].createdAt : undefined

    return { items: page, nextCursor }
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

    if (!balance) return 0

    const { subscriptionCredits, purchasedCredits } = resolveCredits(balance)
    return subscriptionCredits + purchasedCredits
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

    if (balanceDoc.weeklyCreditsResetAt && balanceDoc.weeklyCreditsResetAt < Date.now()) {
      const sub = await polar.getCurrentSubscription(ctx, { userId: args.organizationId as string })
      if (sub && sub.status === "active") {
        const plan = getProductPlan(sub.productId)
        const limits = getPlanLimits(plan)
        const resetAmount = limits.weeklyCredits
        const purchased = balanceDoc.purchasedCredits ?? 0
        const newBalance = resetAmount + purchased
        await ctx.db.patch(balanceDoc._id, {
          balance: newBalance,
          subscriptionCredits: resetAmount,
          purchasedCredits: purchased,
          weeklyCreditsResetAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          updatedAt: Date.now(),
        })
        const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
        await ctx.db.insert("creditTransactions", {
          organizationId: args.organizationId,
          type: "addition",
          amount: resetAmount,
          balanceAfter: newBalance,
          reconciled: true,
          description: `Weekly credits reset - ${plan} plan (week-${weekNum})`,
          createdAt: Date.now(),
        })
      }
    }

    const freshDoc = (await ctx.db.get(balanceDoc._id))!
    const { subscriptionCredits, purchasedCredits } = resolveCredits(freshDoc)

    let newSub = subscriptionCredits
    let newPurchased = purchasedCredits

    if (newSub >= args.amount) {
      newSub -= args.amount
    } else {
      const remainder = args.amount - newSub
      newSub = 0
      newPurchased -= remainder
    }

    const newBalance = newSub + newPurchased

    if (newBalance < 0) {
      console.error("OVERDRAFT", {
        organizationId: args.organizationId,
        amount: args.amount,
        previousBalance: subscriptionCredits + purchasedCredits,
        newBalance,
        description: args.description,
      })
    }

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      subscriptionCredits: newSub,
      purchasedCredits: newPurchased,
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
      const { subscriptionCredits, purchasedCredits } = resolveCredits(balanceDoc)

      let newSub = subscriptionCredits
      let newPurchased = purchasedCredits

      if (tx.type === "deduction") {
        if (newSub >= tx.amount) {
          newSub -= tx.amount
        } else {
          const remainder = tx.amount - newSub
          newSub = 0
          newPurchased -= remainder
        }
      } else {
        newPurchased += tx.amount
      }

      const newBalance = newSub + newPurchased

      await ctx.db.patch(balanceDoc._id, {
        balance: newBalance,
        subscriptionCredits: newSub,
        purchasedCredits: newPurchased,
        updatedAt: Date.now(),
      })

      await ctx.db.patch(tx._id, { balanceAfter: newBalance, reconciled: true })
    }
  },
})

export const addCredits = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    amount: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive")
    }

    const balanceDoc = await getOrCreateBalance(ctx, args.organizationId)
    const { subscriptionCredits, purchasedCredits } = resolveCredits(balanceDoc)
    const newPurchased = purchasedCredits + args.amount
    const newBalance = subscriptionCredits + newPurchased

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      purchasedCredits: newPurchased,
      updatedAt: Date.now(),
    })

    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      type: "addition",
      amount: args.amount,
      balanceAfter: newBalance,
      reconciled: true,
      description: args.description ?? "Manual credit addition",
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, updateKeyLimitRef, {
      organizationId: args.organizationId,
      newBalanceMicrodollars: newBalance,
    })

    return newBalance
  },
})

export const adjustBalance = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    newBalance: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.newBalance < 0) {
      throw new Error("Balance cannot be set to a negative value")
    }

    const balanceDoc = await getOrCreateBalance(ctx, args.organizationId)
    const { subscriptionCredits } = resolveCredits(balanceDoc)
    const difference = args.newBalance - (subscriptionCredits + (balanceDoc.purchasedCredits ?? balanceDoc.balance))
    const newPurchased = Math.max(0, args.newBalance - subscriptionCredits)

    await ctx.db.patch(balanceDoc._id, {
      balance: args.newBalance,
      subscriptionCredits: Math.min(subscriptionCredits, args.newBalance),
      purchasedCredits: newPurchased,
      updatedAt: Date.now(),
    })

    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      type: "adjustment",
      amount: Math.abs(difference),
      balanceAfter: args.newBalance,
      reconciled: true,
      description: args.description ?? `Balance adjusted from ${formatMicrodollars(balanceDoc.balance)} to ${formatMicrodollars(args.newBalance)}`,
      createdAt: Date.now(),
    })

    return args.newBalance
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
    const { subscriptionCredits, purchasedCredits } = resolveCredits(balanceDoc)
    const microdollars = args.amount * 10_000
    const newPurchased = purchasedCredits + microdollars
    const newBalance = subscriptionCredits + newPurchased

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      purchasedCredits: newPurchased,
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
    const { subscriptionCredits, purchasedCredits } = resolveCredits(balanceDoc)
    const newPurchased = purchasedCredits + 250_000
    const newBalance = subscriptionCredits + newPurchased

    await ctx.db.patch(balanceDoc._id, {
      balance: newBalance,
      purchasedCredits: newPurchased,
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


export const checkLowBalances = internalMutation({
  handler: async (ctx) => {
    const balances = await ctx.db.query("creditBalances").take(500)

    for (const bal of balances) {
      const { subscriptionCredits, purchasedCredits } = resolveCredits(bal)
      const effective = subscriptionCredits + purchasedCredits
      if (effective <= 0) {
        console.error("ZERO_BALANCE", {
          organizationId: bal.organizationId,
          balance: effective,
        })
      } else if (effective < 2_000_000) {
        console.warn("LOW_BALANCE", {
          organizationId: bal.organizationId,
          balance: effective,
          dollars: (effective / 1_000_000).toFixed(2),
        })
      }
    }
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

export const resetWeeklyCredits = internalMutation({
  handler: async (ctx) => {
    const now = Date.now()
    const balances = await ctx.db.query("creditBalances").take(500)

    for (const bal of balances) {
      if (!bal.weeklyCreditsResetAt || bal.weeklyCreditsResetAt >= now) continue

      const sub = await polar.getCurrentSubscription(ctx, { userId: bal.organizationId as string })
      if (!sub || sub.status !== "active") continue

      const plan = getProductPlan(sub.productId)
      const limits = getPlanLimits(plan)
      const resetAmount = limits.weeklyCredits
      const purchased = bal.purchasedCredits ?? 0
      const newBalance = resetAmount + purchased

      await ctx.db.patch(bal._id, {
        balance: newBalance,
        subscriptionCredits: resetAmount,
        purchasedCredits: purchased,
        weeklyCreditsResetAt: now + 7 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      })

      const weekNumber = Math.floor(now / (7 * 24 * 60 * 60 * 1000))
      await ctx.db.insert("creditTransactions", {
        organizationId: bal.organizationId,
        type: "addition",
        amount: resetAmount,
        balanceAfter: newBalance,
        reconciled: true,
        description: `Weekly credits reset - ${plan} plan (week-${weekNumber})`,
        createdAt: now,
      })
    }
  },
})
