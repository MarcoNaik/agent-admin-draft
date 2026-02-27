import { v } from "convex/values"
import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { QueryCtx, MutationCtx } from "./_generated/server"

function formatMicrodollars(microdollars: number): string {
  const dollars = microdollars / 1_000_000
  if (dollars >= 0.01) return `$${dollars.toFixed(2)}`
  if (dollars >= 0.0001) return `$${dollars.toFixed(4)}`
  return `$${dollars.toFixed(6)}`
}

async function isOrgAdmin(ctx: QueryCtx | MutationCtx, auth: { userId: Id<"users">; organizationId: Id<"organizations"> }) {
  const membership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_org", (q) =>
      q.eq("userId", auth.userId).eq("organizationId", auth.organizationId)
    )
    .first()
  return membership?.role === "admin"
}

async function requireOrgAdmin(ctx: QueryCtx | MutationCtx, auth: { userId: Id<"users">; organizationId: Id<"organizations"> }) {
  if (!(await isOrgAdmin(ctx, auth))) {
    throw new Error("Admin access required")
  }
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

    const cachedBalance = balance?.balance ?? 0

    const pendingTxs = await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .order("desc")
      .collect()

    const pendingDeductions = pendingTxs
      .filter((tx) => tx.balanceAfter === undefined && tx.type === "deduction")
      .reduce((sum, tx) => sum + tx.amount, 0)

    return {
      balance: cachedBalance - pendingDeductions,
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

    const cachedBalance = balance?.balance ?? 0

    const pendingTxs = await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect()

    const pendingDeductions = pendingTxs
      .filter((tx) => tx.balanceAfter === undefined && tx.type === "deduction")
      .reduce((sum, tx) => sum + tx.amount, 0)

    return cachedBalance - pendingDeductions
  },
})

export const deductCredits = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    amount: v.number(),
    description: v.string(),
    executionId: v.optional(v.id("executions")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      type: "deduction",
      amount: args.amount,
      description: args.description,
      executionId: args.executionId,
      metadata: args.metadata,
      createdAt: Date.now(),
    })
  },
})

export const reconcileBalances = internalMutation({
  handler: async (ctx) => {
    const pendingTxs = await ctx.db
      .query("creditTransactions")
      .order("asc")
      .collect()

    const unprocessed = pendingTxs.filter((tx) => tx.balanceAfter === undefined)
    const batch = unprocessed.slice(0, 200)
    if (batch.length === 0) return

    const byOrg = new Map<string, typeof batch>()
    for (const tx of batch) {
      const orgId = tx.organizationId as string
      if (!byOrg.has(orgId)) byOrg.set(orgId, [])
      byOrg.get(orgId)!.push(tx)
    }

    for (const [orgId, txs] of byOrg) {
      const balanceDoc = await ctx.db
        .query("creditBalances")
        .withIndex("by_org", (q) => q.eq("organizationId", orgId as Id<"organizations">))
        .first()

      let currentBalance = balanceDoc?.balance ?? 0

      for (const tx of txs) {
        if (tx.type === "deduction") {
          currentBalance -= tx.amount
        } else {
          currentBalance += tx.amount
        }
        await ctx.db.patch(tx._id, { balanceAfter: currentBalance })
      }

      if (balanceDoc) {
        await ctx.db.patch(balanceDoc._id, {
          balance: currentBalance,
          updatedAt: Date.now(),
        })
      } else {
        await ctx.db.insert("creditBalances", {
          organizationId: orgId as Id<"organizations">,
          balance: currentBalance,
          updatedAt: Date.now(),
        })
      }
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
      description: args.description ?? "Manual credit addition",
      createdBy: auth.userId,
      createdAt: Date.now(),
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
      await ctx.runQuery(internal.chat.getAuthInfo)
    if (!auth) {
      throw new Error("Not authenticated")
    }

    const isAdmin: boolean = await ctx.runQuery(internal.integrations.isOrgAdminInternal, {
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

    const existing = await ctx.db
      .query("creditTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .order("desc")
      .collect()
    const duplicate = existing.find(
      (tx) => tx.metadata?.polarOrderId === args.polarOrderId
    )
    if (duplicate) {
      return
    }

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
      description: `Credit purchase via Polar (${formatMicrodollars(microdollars)})`,
      metadata: { polarOrderId: args.polarOrderId },
      createdAt: Date.now(),
    })

    if (args.polarCustomerId && !org.polarCustomerId) {
      await ctx.db.patch(org._id, { polarCustomerId: args.polarCustomerId })
    }
  },
})
