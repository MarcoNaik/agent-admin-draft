import { v } from "convex/values"
import { internalAction, internalMutation, internalQuery } from "./_generated/server"
import { makeFunctionReference } from "convex/server"

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"

function getMgmtKey(): string {
  const key = process.env.OPENROUTER_MGMT_KEY
  if (!key) throw new Error("OPENROUTER_MGMT_KEY not configured")
  return key
}

const getOrgKeyRef = makeFunctionReference<"query">("orgKeys:getOrgKey")
const storeOrgKeyRef = makeFunctionReference<"mutation">("orgKeys:storeOrgKey")
const updateKeyLimitInternalRef = makeFunctionReference<"mutation">("orgKeys:updateKeyLimitInternal")
const recordUsageDeltaRef = makeFunctionReference<"mutation">("orgKeys:recordUsageDelta")
const syncKeyUsageRef = makeFunctionReference<"action">("orgKeys:syncKeyUsage")
const listAllOrgKeysRef = makeFunctionReference<"query">("orgKeys:listAllOrgKeys")
const setOrgKeyDisabledRef = makeFunctionReference<"mutation">("orgKeys:setOrgKeyDisabled")
const getBalanceInternalRef = makeFunctionReference<"query">("billing:getBalanceInternal")

export const getOrgKey = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.union(
    v.object({
      encryptedKey: v.string(),
      keyHash: v.string(),
      limitUsd: v.number(),
      lastSyncedUsage: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("orgOpenRouterKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first()
    if (!row || row.disabled) return null
    return {
      encryptedKey: row.encryptedKey,
      keyHash: row.keyHash,
      limitUsd: row.limitUsd,
      lastSyncedUsage: row.lastSyncedUsage,
    }
  },
})

export const provisionOrgKey = internalAction({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    encryptedKey: v.string(),
    keyHash: v.string(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(getOrgKeyRef, { organizationId: args.organizationId })
    if (existing) return { encryptedKey: existing.encryptedKey, keyHash: existing.keyHash }

    const balance = await ctx.runQuery(getBalanceInternalRef, { organizationId: args.organizationId })
    const limitUsd = Math.max(0, balance / 1_000_000)

    const res = await fetch(`${OPENROUTER_API_BASE}/keys`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getMgmtKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `struere-org-${args.organizationId}`,
        limit: limitUsd,
        include_byok_in_limit: false,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Failed to provision OpenRouter key: ${res.status} ${detail}`)
    }

    const result = await res.json() as { key: string; data: { hash: string } }

    await ctx.runMutation(storeOrgKeyRef, {
      organizationId: args.organizationId,
      keyHash: result.data.hash,
      encryptedKey: result.key,
      limitUsd,
    })

    return { encryptedKey: result.key, keyHash: result.data.hash }
  },
})

export const updateKeyLimit = internalAction({
  args: {
    organizationId: v.id("organizations"),
    newBalanceMicrodollars: v.number(),
  },
  handler: async (ctx, args) => {
    const orgKey = await ctx.runQuery(getOrgKeyRef, { organizationId: args.organizationId })
    if (!orgKey) return

    const newLimitUsd = orgKey.lastSyncedUsage + Math.max(0, args.newBalanceMicrodollars / 1_000_000)

    const res = await fetch(`${OPENROUTER_API_BASE}/keys/${orgKey.keyHash}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${getMgmtKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: newLimitUsd }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Failed to update OpenRouter key limit: ${res.status} ${detail}`)
    }

    await ctx.runMutation(updateKeyLimitInternalRef, {
      organizationId: args.organizationId,
      limitUsd: newLimitUsd,
    })
  },
})

export const syncKeyUsage = internalAction({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const orgKey = await ctx.runQuery(getOrgKeyRef, { organizationId: args.organizationId })
    if (!orgKey) return

    const res = await fetch(`${OPENROUTER_API_BASE}/key`, {
      headers: { "Authorization": `Bearer ${orgKey.encryptedKey}` },
    })

    if (!res.ok) return

    const data = await res.json() as { data: { usage: number } }
    const currentUsage = data.data.usage

    if (currentUsage > orgKey.lastSyncedUsage) {
      const deltaUsd = currentUsage - orgKey.lastSyncedUsage
      const deltaMicrodollars = Math.round(deltaUsd * 1_000_000)

      await ctx.runMutation(recordUsageDeltaRef, {
        organizationId: args.organizationId,
        deltaMicrodollars,
        currentUsage,
      })
    }
  },
})

export const syncAllOrgKeys = internalAction({
  args: {},
  handler: async (ctx) => {
    const allKeys = await ctx.runQuery(listAllOrgKeysRef, {})
    for (const key of allKeys) {
      try {
        await ctx.runAction(syncKeyUsageRef, { organizationId: key.organizationId })
      } catch (e) {
        console.error(`Failed to sync usage for org ${key.organizationId}:`, e)
      }
    }
  },
})

export const disableOrgKey = internalAction({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const orgKey = await ctx.runQuery(getOrgKeyRef, { organizationId: args.organizationId })
    if (!orgKey) return

    await fetch(`${OPENROUTER_API_BASE}/keys/${orgKey.keyHash}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${getMgmtKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ disabled: true }),
    })

    await ctx.runMutation(setOrgKeyDisabledRef, { organizationId: args.organizationId, disabled: true })
  },
})

export const storeOrgKey = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    keyHash: v.string(),
    encryptedKey: v.string(),
    limitUsd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("orgOpenRouterKeys", {
      organizationId: args.organizationId,
      keyHash: args.keyHash,
      encryptedKey: args.encryptedKey,
      limitUsd: args.limitUsd,
      lastSyncedUsage: 0,
      createdAt: Date.now(),
    })
  },
})

export const updateKeyLimitInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    limitUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("orgOpenRouterKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first()
    if (row) {
      await ctx.db.patch(row._id, { limitUsd: args.limitUsd })
    }
  },
})

export const recordUsageDelta = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    deltaMicrodollars: v.number(),
    currentUsage: v.number(),
  },
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("creditBalances")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first()

    if (balance) {
      const newBalance = balance.balance - args.deltaMicrodollars
      await ctx.db.patch(balance._id, {
        balance: newBalance,
        updatedAt: Date.now(),
      })
    }

    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      type: "usage_sync",
      amount: args.deltaMicrodollars,
      description: "OpenRouter usage sync",
      createdAt: Date.now(),
    })

    const orgKey = await ctx.db
      .query("orgOpenRouterKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first()
    if (orgKey) {
      await ctx.db.patch(orgKey._id, {
        lastSyncedUsage: args.currentUsage,
        lastSyncedAt: Date.now(),
      })
    }
  },
})

export const setOrgKeyDisabled = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    disabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("orgOpenRouterKeys")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .first()
    if (row) {
      await ctx.db.patch(row._id, { disabled: args.disabled })
    }
  },
})

export const listAllOrgKeys = internalQuery({
  args: {},
  returns: v.array(v.object({ organizationId: v.id("organizations") })),
  handler: async (ctx) => {
    const keys = await ctx.db.query("orgOpenRouterKeys").collect()
    return keys
      .filter((k) => !k.disabled)
      .map((k) => ({ organizationId: k.organizationId }))
  },
})
