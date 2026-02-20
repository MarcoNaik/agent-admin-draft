import { v } from "convex/values"
import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import {
  getGoogleAccessToken,
  listCalendars as googleListCalendars,
} from "./lib/integrations/googleCalendar"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

export const getConnection = query({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment = args.environment ?? "development"

    return await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_org_env", (q) =>
        q.eq("userId", auth.userId).eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .first()
  },
})

export const listConnections = query({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment = args.environment ?? "development"

    const connections = await ctx.db
      .query("calendarConnections")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .collect()

    const results = []
    for (const conn of connections) {
      const user = await ctx.db.get(conn.userId)
      results.push({
        ...conn,
        userName: user?.name ?? user?.email ?? "Unknown",
        userEmail: user?.email,
      })
    }
    return results
  },
})

export const getConnectionInternal = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_org_env", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .first()
  },
})

export const resolveTargetUser = internalQuery({
  args: {
    userId: v.string(),
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.userId))
      .first()

    if (!user) {
      try {
        user = await ctx.db.get(args.userId as Id<"users">)
      } catch {
        user = null
      }
    }

    if (!user) {
      throw new Error(`User not found: ${args.userId}`)
    }

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", user!._id).eq("organizationId", args.organizationId)
      )
      .first()

    if (!membership) {
      throw new Error(`User ${args.userId} does not belong to this organization`)
    }

    const connection = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_org_env", (q) =>
        q.eq("userId", user!._id).eq("organizationId", args.organizationId).eq("environment", args.environment)
      )
      .first()

    if (!connection || connection.status !== "connected") {
      throw new Error(`User ${user.name ?? user.email} does not have a connected Google Calendar`)
    }

    return {
      userId: user._id,
      clerkUserId: user.clerkUserId,
      calendarId: connection.calendarId,
      connectionId: connection._id,
    }
  },
})

export const connect = mutation({
  args: {
    environment: v.optional(environmentValidator),
    calendarId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment = args.environment ?? "development"

    const existing = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_org_env", (q) =>
        q.eq("userId", auth.userId).eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .first()

    const now = Date.now()

    const integrationConfig = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("provider", "google")
      )
      .first()

    if (!integrationConfig) {
      await ctx.db.insert("integrationConfigs", {
        organizationId: auth.organizationId,
        environment,
        provider: "google",
        config: { enabled: true },
        status: "active",
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    } else if (integrationConfig.status !== "active") {
      await ctx.db.patch(integrationConfig._id, {
        status: "active",
        lastVerifiedAt: now,
        updatedAt: now,
      })
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "connected",
        calendarId: args.calendarId ?? existing.calendarId,
        connectedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert("calendarConnections", {
      userId: auth.userId,
      organizationId: auth.organizationId,
      environment,
      provider: "google",
      calendarId: args.calendarId ?? "primary",
      status: "connected",
      connectedAt: now,
    })
  },
})

export const disconnect = mutation({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment = args.environment ?? "development"

    const connection = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_org_env", (q) =>
        q.eq("userId", auth.userId).eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .first()

    if (connection) {
      await ctx.db.patch(connection._id, { status: "disconnected" })
    }
  },
})

export const selectCalendar = mutation({
  args: {
    environment: v.optional(environmentValidator),
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment = args.environment ?? "development"

    const connection = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_org_env", (q) =>
        q.eq("userId", auth.userId).eq("organizationId", auth.organizationId).eq("environment", environment)
      )
      .first()

    if (!connection) throw new Error("No calendar connection found")

    await ctx.db.patch(connection._id, { calendarId: args.calendarId })
  },
})

export const updateLastUsed = internalMutation({
  args: {
    connectionId: v.id("calendarConnections"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, { lastUsedAt: Date.now() })
  },
})

export const listUserCalendars = action({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo)
    if (!auth) throw new Error("Not authenticated")

    const user = await ctx.runQuery(internal.calendar.getUserByIdInternal, {
      userId: auth.userId,
    })

    if (!user) throw new Error("User not found")

    const token = await getGoogleAccessToken(user.clerkUserId)
    const result = await googleListCalendars(token)

    return result.items.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary ?? false,
      accessRole: cal.accessRole,
    }))
  },
})

export const verifyConnection = action({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo)
    if (!auth) throw new Error("Not authenticated")

    const user = await ctx.runQuery(internal.calendar.getUserByIdInternal, {
      userId: auth.userId,
    })

    if (!user) {
      return { success: false, message: "User not found" }
    }

    try {
      const token = await getGoogleAccessToken(user.clerkUserId)
      await googleListCalendars(token)
      return { success: true, message: "Google Calendar connection verified" }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Verification failed",
      }
    }
  },
})

export const getUserByIdInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})
