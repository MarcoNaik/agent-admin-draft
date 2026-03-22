import { v } from "convex/values"
import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "./_generated/dataModel"
import { requireAuth, requireOrgAdmin } from "./lib/auth"
import { providerValidator, type Provider, parseModelId } from "./lib/providers"

const getAuthInfoRef = makeFunctionReference<"query">("chat:getAuthInfo")
const isOrgAdminInternalRef = makeFunctionReference<"query">("integrations:isOrgAdminInternal")
const resolveApiKeyRef = makeFunctionReference<"query">("providers:resolveApiKey")
const getConfigInternalRef = makeFunctionReference<"query">("providers:getConfigInternal")
const patchStatusRef = makeFunctionReference<"mutation">("providers:patchStatus")

function maskApiKey(key: string): string {
  if (key.length <= 8) return "***"
  return key.slice(0, 4) + "..." + key.slice(-4)
}

export const getConfig = query({
  args: {
    provider: providerValidator,
  },
  returns: v.union(
    v.object({
      _id: v.id("providerConfigs"),
      organizationId: v.id("organizations"),
      provider: providerValidator,
      apiKey: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
      lastVerifiedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const config = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
      )
      .first()

    if (!config) return null

    const { _creationTime, ...rest } = config
    return {
      ...rest,
      apiKey: config.apiKey ? maskApiKey(config.apiKey) : undefined,
    }
  },
})

export const listConfigs = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("providerConfigs"),
    organizationId: v.id("organizations"),
    provider: providerValidator,
    apiKey: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    lastVerifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    const auth = await requireAuth(ctx)

    const configs = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    return configs.map((config) => {
      const { _creationTime, ...rest } = config
      return {
        ...rest,
        apiKey: config.apiKey ? maskApiKey(config.apiKey) : undefined,
      }
    })
  },
})

export const resolveApiKey = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    modelId: v.string(),
  },
  returns: v.object({
    apiKey: v.optional(v.string()),
    tier: v.number(),
  }),
  handler: async (ctx, args) => {
    const { provider } = parseModelId(args.modelId)

    const directConfig = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", provider as Provider)
      )
      .first()

    if (directConfig && directConfig.apiKey && directConfig.status !== "error") {
      return { apiKey: directConfig.apiKey, tier: 1 }
    }

    const openrouterConfig = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", "openrouter" as Provider)
      )
      .first()

    if (openrouterConfig && openrouterConfig.apiKey && openrouterConfig.status !== "error") {
      return { apiKey: openrouterConfig.apiKey, tier: 2 }
    }

    return { tier: 3 }
  },
})

export const resolveStudioKey = query({
  args: {
    modelId: v.string(),
  },
  returns: v.object({
    tier: v.number(),
  }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const { provider } = parseModelId(args.modelId)

    const directConfig = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", provider as Provider)
      )
      .first()

    if (directConfig && directConfig.apiKey && directConfig.status === "active") {
      return { tier: 1 }
    }

    const openrouterConfig = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", "openrouter" as Provider)
      )
      .first()

    if (openrouterConfig && openrouterConfig.apiKey && openrouterConfig.status === "active") {
      return { tier: 2 }
    }

    return { tier: 3 }
  },
})

export const resolveStudioKeyInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    modelId: v.string(),
  },
  returns: v.object({
    apiKey: v.optional(v.string()),
    tier: v.number(),
  }),
  handler: async (ctx, args) => {
    const { provider } = parseModelId(args.modelId)

    const directConfig = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", provider as Provider)
      )
      .first()

    if (directConfig && directConfig.apiKey && directConfig.status === "active") {
      return { apiKey: directConfig.apiKey, tier: 1 }
    }

    const openrouterConfig = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", "openrouter" as Provider)
      )
      .first()

    if (openrouterConfig && openrouterConfig.apiKey && openrouterConfig.status === "active") {
      return { apiKey: openrouterConfig.apiKey, tier: 2 }
    }

    return { tier: 3 }
  },
})

export const getPlatformKey = internalAction({
  args: {},
  returns: v.object({ apiKey: v.optional(v.string()) }),
  handler: async () => {
    return { apiKey: process.env.OPENROUTER_API_KEY }
  },
})

export const updateConfig = mutation({
  args: {
    provider: providerValidator,
    apiKey: v.optional(v.string()),
  },
  returns: v.union(v.id("providerConfigs"), v.null()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const existing = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
      )
      .first()

    const now = Date.now()

    if (!args.apiKey) {
      if (existing) {
        await ctx.db.delete(existing._id)
      }
      return null
    }

    if (args.apiKey.includes("...")) {
      return existing?._id ?? null
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        apiKey: args.apiKey,
        status: "inactive" as const,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert("providerConfigs", {
      organizationId: auth.organizationId,
      provider: args.provider,
      apiKey: args.apiKey,
      status: "inactive",
      lastVerifiedAt: undefined,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const deleteConfig = mutation({
  args: {
    provider: providerValidator,
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const config = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
      )
      .first()

    if (!config) return { success: false }

    await ctx.db.delete(config._id)
    return { success: true }
  },
})

export const testConnection = action({
  args: {
    provider: providerValidator,
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
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

    const providerConfig = await ctx.runQuery(getConfigInternalRef, {
      organizationId: auth.organizationId,
      provider: args.provider,
    })

    if (!providerConfig || !providerConfig.apiKey) {
      return { success: false, message: `No API key configured for ${args.provider}` }
    }

    const apiKey = providerConfig.apiKey

    try {
      if (args.provider === "anthropic") {
        const resp: Response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        })
        if (!resp.ok) {
          const body = await resp.text()
          return { success: false, message: `Anthropic API error: ${resp.status} ${body.slice(0, 200)}` }
        }
      } else if (args.provider === "openai") {
        const resp: Response = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${apiKey}` },
        })
        if (!resp.ok) {
          return { success: false, message: `OpenAI API error: ${resp.status}` }
        }
      } else if (args.provider === "google") {
        const resp: Response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)
        if (!resp.ok) {
          return { success: false, message: `Google AI API error: ${resp.status}` }
        }
      } else if (args.provider === "xai") {
        const resp: Response = await fetch("https://api.x.ai/v1/models", {
          headers: { "Authorization": `Bearer ${apiKey}` },
        })
        if (!resp.ok) {
          return { success: false, message: `xAI API error: ${resp.status}` }
        }
      } else if (args.provider === "openrouter") {
        const resp: Response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { "Authorization": `Bearer ${apiKey}` },
        })
        if (!resp.ok) {
          return { success: false, message: `OpenRouter API error: ${resp.status}` }
        }
      }

      await ctx.runMutation(patchStatusRef, {
        configId: providerConfig._id,
        status: "active" as const,
        lastVerifiedAt: Date.now(),
      })

      return { success: true, message: `${args.provider} API key is valid` }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed"

      await ctx.runMutation(patchStatusRef, {
        configId: providerConfig._id,
        status: "error" as const,
      })

      return { success: false, message }
    }
  },
})

export const getConfigInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    provider: providerValidator,
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", args.provider)
      )
      .first()
  },
})

export const patchStatus = internalMutation({
  args: {
    configId: v.id("providerConfigs"),
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
