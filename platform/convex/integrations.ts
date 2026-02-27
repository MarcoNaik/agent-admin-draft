import { v } from "convex/values"
import { query, mutation, action, internalQuery, internalMutation, QueryCtx, MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

const providerValidator = v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom"), v.literal("airtable"), v.literal("resend"))

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

interface FlowConfig {
  apiUrl: string
  apiKey: string
  secretKey: string
  webhookBaseUrl: string
  defaultCurrency?: string
  returnUrl?: string
}

interface GoogleConfig {
  enabled: boolean
}

interface ZoomConfig {
  accountId: string
  clientId: string
  clientSecret: string
}

interface AirtableConfig {
  personalAccessToken: string
  defaultBaseId?: string
}

interface ResendConfig {
  fromEmail?: string
  fromName?: string
  replyTo?: string
}

export const getConfig = query({
  args: {
    provider: providerValidator,
    environment: environmentValidator,
  },
  returns: v.union(
    v.object({
      _id: v.id("integrationConfigs"),
      organizationId: v.id("organizations"),
      environment: environmentValidator,
      provider: providerValidator,
      config: v.any(),
      status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
      lastVerifiedAt: v.union(v.number(), v.null()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const config = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("provider", args.provider)
      )
      .first()

    if (!config) {
      return null
    }

    const { _creationTime, ...rest } = config
    const sanitizedConfig = { ...rest }
    if (config.config) {
      const configData = config.config as Record<string, unknown>
      const masked: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(configData)) {
        if (
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("token") ||
          key.toLowerCase().includes("key")
        ) {
          if (typeof value === "string" && value.length > 8) {
            masked[key] = value.slice(0, 4) + "..." + value.slice(-4)
          } else {
            masked[key] = "***"
          }
        } else {
          masked[key] = value
        }
      }
      sanitizedConfig.config = masked
    }

    return sanitizedConfig
  },
})

export const getConfigInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    provider: providerValidator,
  },
  returns: v.union(
    v.object({
      _id: v.id("integrationConfigs"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      environment: environmentValidator,
      provider: providerValidator,
      config: v.any(),
      status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
      lastVerifiedAt: v.union(v.number(), v.null()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment).eq("provider", args.provider)
      )
      .first()
  },
})

export const listFlowConfigs = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("integrationConfigs"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      environment: environmentValidator,
      provider: providerValidator,
      config: v.any(),
      status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
      lastVerifiedAt: v.union(v.number(), v.null()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("integrationConfigs")
      .withIndex("by_provider_status", (q) => q.eq("provider", "flow").eq("status", "active"))
      .collect()
  },
})

export const updateConfig = mutation({
  args: {
    provider: providerValidator,
    environment: environmentValidator,
    config: v.any(),
  },
  returns: v.id("integrationConfigs"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const existing = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("provider", args.provider)
      )
      .first()

    const now = Date.now()

    if (existing) {
      const mergedConfig = { ...existing.config, ...args.config }
      await ctx.db.patch(existing._id, {
        config: mergedConfig,
        updatedAt: now,
      })
      return existing._id
    }

    const configId = await ctx.db.insert("integrationConfigs", {
      organizationId: auth.organizationId,
      environment: args.environment,
      provider: args.provider,
      config: args.config,
      status: "inactive",
      lastVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    return configId
  },
})

export const getConfigForTest = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    provider: providerValidator,
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("environment", args.environment).eq("provider", args.provider)
      )
      .first()
  },
})

export const patchConfigInternal = internalMutation({
  args: {
    configId: v.id("integrationConfigs"),
    config: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.configId, {
      config: args.config,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const patchConfigStatus = internalMutation({
  args: {
    configId: v.id("integrationConfigs"),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    lastVerifiedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    }
    if (args.lastVerifiedAt !== undefined) patch.lastVerifiedAt = args.lastVerifiedAt
    await ctx.db.patch(args.configId, patch)
    return null
  },
})

export const isOrgAdminInternal = internalQuery({
  args: { userId: v.id("users"), organizationId: v.id("organizations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId)
      )
      .first()
    return membership?.role === "admin"
  },
})

export const testConnection = action({
  args: {
    provider: providerValidator,
    environment: environmentValidator,
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo)
    if (!auth) {
      throw new Error("Not authenticated")
    }

    const isAdmin = await ctx.runQuery(internal.integrations.isOrgAdminInternal, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    })
    if (!isAdmin) {
      throw new Error("Admin access required")
    }

    const config = await ctx.runQuery(internal.integrations.getConfigForTest, {
      organizationId: auth.organizationId,
      environment: args.environment,
      provider: args.provider,
    })

    if (!config) {
      return { success: false, message: "Integration not configured" }
    }

    const now = Date.now()

    try {
      if (args.provider === "whatsapp") {
        const apiKey = process.env.KAPSO_API_KEY
        if (!apiKey) {
          return { success: false, message: "KAPSO_API_KEY not configured" }
        }

        const response = await fetch("https://api.kapso.ai/platform/v1/customers?per_page=1", {
          headers: { "X-API-Key": apiKey },
        })

        if (!response.ok) {
          await ctx.runMutation(internal.integrations.patchConfigStatus, {
            configId: config._id,
            status: "error",
          })
          return { success: false, message: "Kapso API key is invalid or unreachable" }
        }

        await ctx.runMutation(internal.integrations.patchConfigStatus, {
          configId: config._id,
          status: "active",
          lastVerifiedAt: now,
        })
        return { success: true, message: "Kapso API connection verified" }
      }

      if (args.provider === "flow") {
        const flowConfig = config.config as FlowConfig
        if (!flowConfig.apiUrl || !flowConfig.apiKey || !flowConfig.secretKey) {
          return { success: false, message: "Missing required Flow configuration (apiUrl, apiKey, secretKey)" }
        }

        const { signFlowRequest } = await import("./lib/integrations/flow")
        const testParams: Record<string, unknown> = { apiKey: flowConfig.apiKey, flowOrder: "0" }
        const signature = await signFlowRequest(testParams, flowConfig.secretKey)

        const params = new URLSearchParams()
        params.append("apiKey", flowConfig.apiKey)
        params.append("flowOrder", "0")
        params.append("s", signature)

        try {
          const response = await fetch(`${flowConfig.apiUrl}/payment/getStatusByFlowOrder?${params.toString()}`)

          if (response.status === 401 || response.status === 403) {
            await ctx.runMutation(internal.integrations.patchConfigStatus, {
              configId: config._id,
              status: "error",
            })
            return { success: false, message: "Flow API credentials are invalid" }
          }

          const body = await response.json() as { status: number; message?: string; code?: string }

          if (body.message?.toLowerCase().includes("invalid api key") || body.message?.toLowerCase().includes("unauthorized") || body.code === "auth_error") {
            await ctx.runMutation(internal.integrations.patchConfigStatus, {
              configId: config._id,
              status: "error",
            })
            return { success: false, message: "Flow API credentials are invalid" }
          }

          await ctx.runMutation(internal.integrations.patchConfigStatus, {
            configId: config._id,
            status: "active",
            lastVerifiedAt: now,
          })
          return { success: true, message: "Flow API connection verified" }
        } catch (fetchError) {
          await ctx.runMutation(internal.integrations.patchConfigStatus, {
            configId: config._id,
            status: "error",
          })
          const msg = fetchError instanceof Error ? fetchError.message : "Unknown error"
          return { success: false, message: `Flow API unreachable: ${msg}` }
        }
      }

      if (args.provider === "google") {
        const clerkSecretKey = process.env.CLERK_SECRET_KEY
        if (!clerkSecretKey) {
          return { success: false, message: "CLERK_SECRET_KEY not configured in Convex environment" }
        }

        await ctx.runMutation(internal.integrations.patchConfigStatus, {
          configId: config._id,
          status: "active",
          lastVerifiedAt: now,
        })
        return { success: true, message: "Google Calendar integration ready (uses Clerk OAuth)" }
      }

      if (args.provider === "zoom") {
        const zoomConfig = config.config as ZoomConfig
        if (!zoomConfig.accountId || !zoomConfig.clientId) {
          return { success: false, message: "Missing required Zoom configuration" }
        }

        await ctx.runMutation(internal.integrations.patchConfigStatus, {
          configId: config._id,
          status: "active",
          lastVerifiedAt: now,
        })
        return { success: true, message: "Zoom configuration saved" }
      }

      if (args.provider === "airtable") {
        const airtableConfig = config.config as AirtableConfig
        if (!airtableConfig.personalAccessToken) {
          return { success: false, message: "Missing Airtable Personal Access Token" }
        }

        const response = await fetch("https://api.airtable.com/v0/meta/bases", {
          headers: { Authorization: `Bearer ${airtableConfig.personalAccessToken}` },
        })

        if (!response.ok) {
          await ctx.runMutation(internal.integrations.patchConfigStatus, {
            configId: config._id,
            status: "error",
          })
          return { success: false, message: "Airtable Personal Access Token is invalid or unreachable" }
        }

        await ctx.runMutation(internal.integrations.patchConfigStatus, {
          configId: config._id,
          status: "active",
          lastVerifiedAt: now,
        })
        return { success: true, message: "Airtable connection verified" }
      }

      if (args.provider === "resend") {
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) {
          return { success: false, message: "RESEND_API_KEY not configured" }
        }

        const response = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (!response.ok) {
          await ctx.runMutation(internal.integrations.patchConfigStatus, {
            configId: config._id,
            status: "error",
          })
          return { success: false, message: "Resend API key is invalid or unreachable" }
        }

        await ctx.runMutation(internal.integrations.patchConfigStatus, {
          configId: config._id,
          status: "active",
          lastVerifiedAt: now,
        })
        return { success: true, message: "Resend connection verified" }
      }

      return { success: false, message: "Unknown provider" }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await ctx.runMutation(internal.integrations.patchConfigStatus, {
        configId: config._id,
        status: "error",
      })
      return { success: false, message }
    }
  },
})

export const listConfigs = query({
  args: {
    environment: environmentValidator,
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const configs = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment)
      )
      .collect()

    return configs.map((config) => {
      const { _creationTime, ...rest } = config
      const sanitizedConfig = { ...rest }
      if (config.config) {
        const configData = config.config as Record<string, unknown>
        const masked: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(configData)) {
          if (
            key.toLowerCase().includes("secret") ||
            key.toLowerCase().includes("token") ||
            key.toLowerCase().includes("key")
          ) {
            if (typeof value === "string" && value.length > 8) {
              masked[key] = value.slice(0, 4) + "..." + value.slice(-4)
            } else {
              masked[key] = "***"
            }
          } else {
            masked[key] = value
          }
        }
        sanitizedConfig.config = masked
      }
      return sanitizedConfig
    })
  },
})

export const deleteConfig = mutation({
  args: {
    provider: providerValidator,
    environment: environmentValidator,
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const config = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("provider", args.provider)
      )
      .first()

    if (!config) {
      return { success: false }
    }

    await ctx.db.delete(config._id)
    return { success: true }
  },
})

export const setConfigStatus = mutation({
  args: {
    provider: providerValidator,
    environment: environmentValidator,
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const config = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_env_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", args.environment).eq("provider", args.provider)
      )
      .first()

    if (!config) {
      return { success: false }
    }

    await ctx.db.patch(config._id, {
      status: args.status,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})
