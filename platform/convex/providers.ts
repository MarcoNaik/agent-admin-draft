import { v } from "convex/values"
import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import { QueryCtx, MutationCtx } from "./_generated/server"

const providerValidator = v.union(v.literal("anthropic"), v.literal("openai"), v.literal("google"), v.literal("xai"))

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
      mode: v.union(v.literal("platform"), v.literal("custom")),
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
    mode: v.union(v.literal("platform"), v.literal("custom")),
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
    provider: v.string(),
  },
  returns: v.union(
    v.object({ apiKey: v.string() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    if (!["anthropic", "openai", "google", "xai"].includes(args.provider)) {
      return null
    }

    const config = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", args.organizationId).eq("provider", args.provider as "anthropic" | "openai" | "google" | "xai")
      )
      .first()

    if (!config || config.mode !== "custom" || !config.apiKey) {
      return null
    }

    return { apiKey: config.apiKey }
  },
})

export const resolveStudioKey = query({
  args: {
    provider: providerValidator,
  },
  returns: v.union(v.object({ apiKey: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    await requireOrgAdmin(ctx, auth)

    const config = await ctx.db
      .query("providerConfigs")
      .withIndex("by_org_provider", (q) =>
        q.eq("organizationId", auth.organizationId).eq("provider", args.provider)
      )
      .first()

    if (!config || config.mode !== "custom" || !config.apiKey || config.status !== "active") {
      return null
    }

    return { apiKey: config.apiKey }
  },
})

export const updateConfig = mutation({
  args: {
    provider: providerValidator,
    mode: v.union(v.literal("platform"), v.literal("custom")),
    apiKey: v.optional(v.string()),
  },
  returns: v.id("providerConfigs"),
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

    if (existing) {
      const patch: Record<string, unknown> = {
        mode: args.mode,
        updatedAt: now,
      }

      if (args.mode === "platform") {
        patch.apiKey = undefined
        patch.status = "active"
      } else if (args.apiKey && !args.apiKey.includes("...")) {
        patch.apiKey = args.apiKey
        patch.status = "inactive"
      }

      await ctx.db.patch(existing._id, patch)
      return existing._id
    }

    return await ctx.db.insert("providerConfigs", {
      organizationId: auth.organizationId,
      provider: args.provider,
      mode: args.mode,
      apiKey: args.mode === "custom" && args.apiKey && !args.apiKey.includes("...") ? args.apiKey : undefined,
      status: args.mode === "platform" ? "active" : "inactive",
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

    const resolved: { apiKey: string } | null = await ctx.runQuery(internal.providers.resolveApiKey, {
      organizationId: auth.organizationId,
      provider: args.provider,
    })

    if (!resolved) {
      return { success: false, message: `No custom API key configured for ${args.provider}` }
    }

    const apiKey = resolved.apiKey

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
      }

      const providerConfig = await ctx.runQuery(internal.providers.getConfigInternal, {
        organizationId: auth.organizationId,
        provider: args.provider,
      })

      if (providerConfig) {
        await ctx.runMutation(internal.providers.patchStatus, {
          configId: providerConfig._id,
          status: "active" as const,
          lastVerifiedAt: Date.now(),
        })
      }

      return { success: true, message: `${args.provider} API key is valid` }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed"

      const providerConfig = await ctx.runQuery(internal.providers.getConfigInternal, {
        organizationId: auth.organizationId,
        provider: args.provider,
      })

      if (providerConfig) {
        await ctx.runMutation(internal.providers.patchStatus, {
          configId: providerConfig._id,
          status: "error" as const,
        })
      }

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
