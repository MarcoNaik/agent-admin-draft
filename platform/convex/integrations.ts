import { v } from "convex/values"
import { query, mutation, internalQuery } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"

type Provider = "whatsapp" | "flow" | "google" | "zoom"

interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  businessAccountId: string
}

interface FlowConfig {
  apiUrl: string
  apiKey: string
  secretKey: string
  webhookBaseUrl: string
}

interface GoogleConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

interface ZoomConfig {
  accountId: string
  clientId: string
  clientSecret: string
}

export const getConfig = query({
  args: {
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
  },
  returns: v.union(
    v.object({
      _id: v.id("integrationConfigs"),
      organizationId: v.id("organizations"),
      provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
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
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
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
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
  },
  returns: v.union(
    v.object({
      _id: v.id("integrationConfigs"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
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
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", args.provider)
      )
      .first()
  },
})

export const getOrgByWhatsAppPhone = internalQuery({
  args: {
    phoneNumberId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizations"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      clerkOrgId: v.optional(v.string()),
      plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const whatsappConfigs = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_provider", (q) => q.eq("provider", "whatsapp"))
      .collect()

    for (const config of whatsappConfigs) {
      const configData = config.config as WhatsAppConfig
      if (configData.phoneNumberId === args.phoneNumberId) {
        return await ctx.db.get(config.organizationId)
      }
    }

    return null
  },
})

export const listFlowConfigs = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("integrationConfigs"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
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
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
    config: v.any(),
  },
  returns: v.id("integrationConfigs"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const existing = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
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

export const testConnection = mutation({
  args: {
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const config = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
      )
      .first()

    if (!config) {
      return { success: false, message: "Integration not configured" }
    }

    const now = Date.now()

    try {
      if (args.provider === "whatsapp") {
        const whatsappConfig = config.config as WhatsAppConfig
        if (!whatsappConfig.phoneNumberId || !whatsappConfig.accessToken) {
          return { success: false, message: "Missing required WhatsApp configuration" }
        }

        const response = await fetch(
          `https://graph.facebook.com/v18.0/${whatsappConfig.phoneNumberId}`,
          {
            headers: {
              Authorization: `Bearer ${whatsappConfig.accessToken}`,
            },
          }
        )

        if (!response.ok) {
          const error = await response.text()
          await ctx.db.patch(config._id, {
            status: "error",
            updatedAt: now,
          })
          return { success: false, message: `WhatsApp API error: ${error}` }
        }

        await ctx.db.patch(config._id, {
          status: "active",
          lastVerifiedAt: now,
          updatedAt: now,
        })
        return { success: true, message: "WhatsApp connection verified" }
      }

      if (args.provider === "flow") {
        const flowConfig = config.config as FlowConfig
        if (!flowConfig.apiUrl || !flowConfig.apiKey) {
          return { success: false, message: "Missing required Flow configuration" }
        }

        await ctx.db.patch(config._id, {
          status: "active",
          lastVerifiedAt: now,
          updatedAt: now,
        })
        return { success: true, message: "Flow configuration saved" }
      }

      if (args.provider === "google") {
        const googleConfig = config.config as GoogleConfig
        if (!googleConfig.clientId || !googleConfig.refreshToken) {
          return { success: false, message: "Missing required Google configuration" }
        }

        await ctx.db.patch(config._id, {
          status: "active",
          lastVerifiedAt: now,
          updatedAt: now,
        })
        return { success: true, message: "Google configuration saved" }
      }

      if (args.provider === "zoom") {
        const zoomConfig = config.config as ZoomConfig
        if (!zoomConfig.accountId || !zoomConfig.clientId) {
          return { success: false, message: "Missing required Zoom configuration" }
        }

        await ctx.db.patch(config._id, {
          status: "active",
          lastVerifiedAt: now,
          updatedAt: now,
        })
        return { success: true, message: "Zoom configuration saved" }
      }

      return { success: false, message: "Unknown provider" }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await ctx.db.patch(config._id, {
        status: "error",
        updatedAt: now,
      })
      return { success: false, message }
    }
  },
})

export const listConfigs = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const auth = await requireAuth(ctx)

    const configs = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
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
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const config = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
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
    provider: v.union(v.literal("whatsapp"), v.literal("flow"), v.literal("google"), v.literal("zoom")),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const config = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
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
