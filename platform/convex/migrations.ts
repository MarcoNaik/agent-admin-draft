import { internalMutation, internalQuery } from "./_generated/server"
import { generateApiKey, hashApiKey } from "./lib/utils"

export const debugState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    const users = await ctx.db.query("users").collect()
    const memberships = await ctx.db.query("userOrganizations").collect()
    return { orgs, users, memberships }
  },
})

import { query } from "./_generated/server"

export const debugIdentity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return identity
  },
})

export const debugTest = query({
  args: {},
  handler: async () => {
    return { test: "works", timestamp: Date.now() }
  },
})

export const debugAllOrgs = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    return orgs
  },
})

export const debugListOrgs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: "Not authenticated", identity: null }
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) {
      return { error: "User not found", identity, subject: identity.subject }
    }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()

    return { identity, user, memberships }
  },
})

import { v } from "convex/values"

export const manualSyncClerkOrg = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    clerkUserId: v.string(),
    userRole: v.union(v.literal("admin"), v.literal("member")),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first()

    const now = Date.now()

    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: args.name,
        slug: args.slug,
        clerkOrgId: args.clerkOrgId,
        createdAt: now,
        updatedAt: now,
      })
      org = await ctx.db.get(orgId)
    }

    if (!org) throw new Error("Failed to create org")

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first()

    if (!user) {
      const userId = await ctx.db.insert("users", {
        email: args.userEmail || `${args.clerkUserId}@unknown.com`,
        name: args.userName,
        clerkUserId: args.clerkUserId,
        createdAt: now,
        updatedAt: now,
      })
      user = await ctx.db.get(userId)
    }

    if (!user) throw new Error("Failed to create user")

    const existingMembership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user._id).eq("organizationId", org._id)
      )
      .first()

    if (!existingMembership) {
      await ctx.db.insert("userOrganizations", {
        userId: user._id,
        organizationId: org._id,
        role: args.userRole,
        createdAt: now,
        updatedAt: now,
      })
    }

    return { orgId: org._id, userId: user._id }
  },
})

export const cleanupLegacyUserData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect()

    for (const user of users) {
      const userData = user as unknown as Record<string, unknown>
      if ("organizationId" in userData || "role" in userData) {
        const { organizationId, role, ...cleanUser } = userData
        await ctx.db.replace(user._id, {
          email: cleanUser.email as string,
          name: cleanUser.name as string | undefined,
          clerkUserId: cleanUser.clerkUserId as string,
          createdAt: cleanUser.createdAt as number,
          updatedAt: Date.now(),
          deletedAt: cleanUser.deletedAt as number | undefined,
        })
      }
    }

    return { cleaned: users.length }
  },
})

export const cleanupLegacyOrganizations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    const deleted: string[] = []

    for (const org of orgs) {
      if (!org.clerkOrgId) {
        await ctx.db.delete(org._id)
        deleted.push(org.name)
      }
    }

    return { deleted }
  },
})

export const removePlanFromOrganizations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    let updated = 0

    for (const org of orgs) {
      const raw = org as unknown as Record<string, unknown>
      if ("plan" in raw) {
        const { plan, ...rest } = raw
        await ctx.db.replace(org._id, {
          name: rest.name as string,
          slug: rest.slug as string,
          clerkOrgId: rest.clerkOrgId as string | undefined,
          createdAt: rest.createdAt as number,
          updatedAt: rest.updatedAt as number,
        })
        updated++
      }
    }

    return { updated }
  },
})

export const cleanupOrphanedMemberships = internalMutation({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db.query("userOrganizations").collect()
    const deleted: string[] = []

    for (const membership of memberships) {
      if (!membership.clerkMembershipId) {
        const org = await ctx.db.get(membership.organizationId)
        const user = await ctx.db.get(membership.userId)
        await ctx.db.delete(membership._id)
        deleted.push(
          `${user?.email ?? "unknown"} -> ${org?.name ?? "unknown"}`
        )
      }
    }

    return { deleted, count: deleted.length }
  },
})

export const cleanupDuplicateUsers = internalMutation({
  args: {
    duplicateUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.duplicateUserId)
    if (!user) return { error: "User not found" }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", args.duplicateUserId))
      .collect()

    if (memberships.length > 0) {
      return {
        error: "User still has memberships — clean those up first",
        memberships: memberships.length,
      }
    }

    await ctx.db.delete(args.duplicateUserId)
    return { deleted: user.email }
  },
})

export const createApiKeyForOrg = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    environment: v.union(v.literal("development"), v.literal("production"), v.literal("eval")),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { key, prefix } = generateApiKey()
    const keyHash = await hashApiKey(key)
    const now = Date.now()
    const id = await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      environment: args.environment,
      name: args.name,
      keyHash,
      keyPrefix: prefix,
      permissions: args.permissions,
      createdAt: now,
    })
    return { id, key, keyPrefix: prefix }
  },
})

export const addDataPermissionToApiKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const keys = await ctx.db.query("apiKeys").collect()
    let updated = 0
    for (const key of keys) {
      if (!key.permissions.includes("data")) {
        await ctx.db.patch(key._id, {
          permissions: [...key.permissions, "data"],
        })
        updated++
      }
    }
    return { total: keys.length, updated }
  },
})

export const migrateOwnerToAdmin = internalMutation({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db.query("userOrganizations").collect()
    let updated = 0

    for (const membership of memberships) {
      if ((membership as unknown as { role: string }).role === "owner") {
        await ctx.db.patch(membership._id, { role: "admin" as const })
        updated++
      }
    }

    return { updated }
  },
})

import { mutation } from "./_generated/server"

export const run = mutation({
  args: {},
  returns: v.object({
    agentConfigs: v.number(),
    evalSuites: v.number(),
    providerConfigsDeleted: v.number(),
    providerConfigsUpdated: v.number(),
  }),
  handler: async (ctx) => {
    const counts = {
      agentConfigs: 0,
      evalSuites: 0,
      providerConfigsDeleted: 0,
      providerConfigsUpdated: 0,
    }

    const agentConfigs = await ctx.db.query("agentConfigs").collect()
    for (const doc of agentConfigs) {
      const m = doc.model as Record<string, unknown>
      if (m.model) continue
      const provider = m.provider ?? "xai"
      const name = m.name
      if (!name) continue
      await ctx.db.patch(doc._id, {
        model: {
          model: `${provider}/${name}`,
          temperature: m.temperature as number | undefined,
          maxTokens: m.maxTokens as number | undefined,
        },
      })
      counts.agentConfigs++
    }

    const evalSuites = await ctx.db.query("evalSuites").collect()
    for (const doc of evalSuites) {
      if (!doc.judgeModel) continue
      const jm = doc.judgeModel as Record<string, unknown>
      if (jm.model) continue
      const provider = jm.provider ?? "xai"
      const name = jm.name
      if (!name) continue
      await ctx.db.patch(doc._id, {
        judgeModel: {
          model: `${provider}/${name}`,
        },
      })
      counts.evalSuites++
    }

    const providerConfigs = await ctx.db.query("providerConfigs").collect()
    for (const doc of providerConfigs) {
      const mode = (doc as unknown as Record<string, unknown>).mode as string | undefined
      if (mode === "platform" && !doc.apiKey) {
        await ctx.db.delete(doc._id)
        counts.providerConfigsDeleted++
      } else {
        await ctx.db.patch(doc._id, {
          mode: undefined,
        } as Record<string, unknown>)
        counts.providerConfigsUpdated++
      }
    }

    return counts
  },
})
