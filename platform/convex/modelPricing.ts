import { internalAction, internalMutation, internalQuery, query } from "./_generated/server"
import { v } from "convex/values"
import { makeFunctionReference } from "convex/server"
import { openRouterProviderToStruere, normalizeNativeModelName } from "./lib/providers"

const MARKUP = 1.1

const upsertPricingRef = makeFunctionReference<"mutation">("modelPricing:upsertPricing")
const upsertRegistryRef = makeFunctionReference<"mutation">("modelPricing:upsertRegistry")

export const syncPricing = internalAction({
  args: {},
  handler: async (ctx) => {
    const response = await fetch("https://openrouter.ai/api/v1/models")
    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`)
    }

    const data = await response.json() as {
      data: Array<{
        id: string
        pricing?: {
          prompt?: string
          completion?: string
        }
      }>
    }

    const pricingBatch: Array<{ modelId: string; inputPerMTok: number; outputPerMTok: number }> = []

    for (const model of data.data) {
      if (!model.pricing?.prompt || !model.pricing?.completion) continue

      const inputPerMTok = parseFloat(model.pricing.prompt) * 1_000_000
      const outputPerMTok = parseFloat(model.pricing.completion) * 1_000_000

      if (isNaN(inputPerMTok) || isNaN(outputPerMTok)) continue
      if (inputPerMTok === 0 && outputPerMTok === 0) continue

      pricingBatch.push({
        modelId: model.id,
        inputPerMTok,
        outputPerMTok,
      })
    }

    const BATCH_SIZE = 50
    for (let i = 0; i < pricingBatch.length; i += BATCH_SIZE) {
      const batch = pricingBatch.slice(i, i + BATCH_SIZE)
      await ctx.runMutation(upsertPricingRef, { entries: batch })
    }
  },
})

const FEATURED_MODELS = [
  "xai/grok-4-1-fast",
  "xai/grok-4",
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-opus-4",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/gpt-5-mini",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
]

const setFeaturedModelsRef = makeFunctionReference<"mutation">("modelPricing:setFeaturedModels")

export const syncModelRegistry = internalAction({
  args: {},
  handler: async (ctx) => {
    const response = await fetch("https://openrouter.ai/api/v1/models")
    if (!response.ok) throw new Error(`OpenRouter API returned ${response.status}`)

    const data = await response.json() as {
      data: Array<{
        id: string
        name: string
        context_length?: number
        top_provider?: { max_completion_tokens?: number }
        pricing?: { prompt?: string; completion?: string }
        architecture?: { modality?: string; tokenizer?: string }
      }>
    }

    const entries: Array<{
      struereId: string
      openRouterId: string
      providerSlug: string
      nativeModelName: string
      displayName: string
      contextWindow: number
      maxOutput: number
      inputPerMTok: number
      outputPerMTok: number
    }> = []

    const seenIds = new Set<string>()
    for (const model of data.data) {
      if (!model.pricing?.prompt || !model.pricing?.completion) continue

      const inputPerMTok = parseFloat(model.pricing.prompt) * 1_000_000
      const outputPerMTok = parseFloat(model.pricing.completion) * 1_000_000
      if (isNaN(inputPerMTok) || isNaN(outputPerMTok)) continue

      const slashIdx = model.id.indexOf("/")
      if (slashIdx === -1) continue
      const orProvider = model.id.slice(0, slashIdx)
      const orModelName = model.id.slice(slashIdx + 1)

      const providerSlug = openRouterProviderToStruere(orProvider)
      const nativeModelName = normalizeNativeModelName(providerSlug, orModelName)
      const struereId = `${providerSlug}/${nativeModelName}`

      if (!seenIds.has(struereId)) {
        seenIds.add(struereId)
        entries.push({
          struereId,
          openRouterId: model.id,
          providerSlug,
          nativeModelName,
          displayName: model.name || orModelName,
          contextWindow: model.context_length ?? 128000,
          maxOutput: model.top_provider?.max_completion_tokens ?? 4096,
          inputPerMTok,
          outputPerMTok,
        })
      }
    }

    const BATCH_SIZE = 50
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE)
      await ctx.runMutation(upsertRegistryRef, { entries: batch })
    }

    await ctx.runMutation(setFeaturedModelsRef, { struereIds: FEATURED_MODELS })
  },
})

export const setFeaturedModels = internalMutation({
  args: {
    struereIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const allModels = await ctx.db.query("modelRegistry").collect()
    for (const model of allModels) {
      const shouldBeFeatured = args.struereIds.includes(model.struereId)
      if (model.featured !== shouldBeFeatured) {
        await ctx.db.patch(model._id, { featured: shouldBeFeatured })
      }
    }
  },
})

export const upsertPricing = internalMutation({
  args: {
    entries: v.array(v.object({
      modelId: v.string(),
      inputPerMTok: v.number(),
      outputPerMTok: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("modelId", entry.modelId))
        .unique()

      if (existing) {
        if (
          existing.inputPerMTok !== entry.inputPerMTok ||
          existing.outputPerMTok !== entry.outputPerMTok
        ) {
          await ctx.db.patch(existing._id, {
            inputPerMTok: entry.inputPerMTok,
            outputPerMTok: entry.outputPerMTok,
            updatedAt: now,
          })
        }
      } else {
        await ctx.db.insert("modelPricing", {
          modelId: entry.modelId,
          inputPerMTok: entry.inputPerMTok,
          outputPerMTok: entry.outputPerMTok,
          updatedAt: now,
        })
      }
    }
  },
})

export const upsertRegistry = internalMutation({
  args: {
    entries: v.array(v.object({
      struereId: v.string(),
      openRouterId: v.string(),
      providerSlug: v.string(),
      nativeModelName: v.string(),
      displayName: v.string(),
      contextWindow: v.number(),
      maxOutput: v.number(),
      inputPerMTok: v.number(),
      outputPerMTok: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("modelRegistry")
        .withIndex("by_struere_id", (q) => q.eq("struereId", entry.struereId))
        .unique()

      if (existing) {
        await ctx.db.patch(existing._id, {
          openRouterId: entry.openRouterId,
          displayName: entry.displayName,
          contextWindow: entry.contextWindow,
          maxOutput: entry.maxOutput,
          inputPerMTok: entry.inputPerMTok,
          outputPerMTok: entry.outputPerMTok,
          status: "active" as const,
          updatedAt: now,
        })
      } else {
        await ctx.db.insert("modelRegistry", {
          ...entry,
          status: "active",
          updatedAt: now,
        })
      }
    }
  },
})

export const getPricing = internalQuery({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("modelPricing")
      .withIndex("by_model", (q) => q.eq("modelId", args.modelId))
      .unique()
  },
})

export const getRegistryEntry = internalQuery({
  args: { struereId: v.string() },
  returns: v.union(
    v.object({
      openRouterId: v.string(),
      providerSlug: v.string(),
      nativeModelName: v.string(),
      displayName: v.string(),
      contextWindow: v.number(),
      maxOutput: v.number(),
      inputPerMTok: v.number(),
      outputPerMTok: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("modelRegistry")
      .withIndex("by_struere_id", (q) => q.eq("struereId", args.struereId))
      .unique()
    if (!entry || entry.status === "deprecated") return null
    return {
      openRouterId: entry.openRouterId,
      providerSlug: entry.providerSlug,
      nativeModelName: entry.nativeModelName,
      displayName: entry.displayName,
      contextWindow: entry.contextWindow,
      maxOutput: entry.maxOutput,
      inputPerMTok: entry.inputPerMTok,
      outputPerMTok: entry.outputPerMTok,
    }
  },
})

export const listFeaturedModels = query({
  args: {},
  returns: v.array(v.object({
    struereId: v.string(),
    displayName: v.string(),
    providerSlug: v.string(),
    inputPerMTok: v.number(),
    outputPerMTok: v.number(),
    contextWindow: v.number(),
    maxOutput: v.number(),
  })),
  handler: async (ctx) => {
    const models = await ctx.db
      .query("modelRegistry")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .collect()
    return models
      .filter((m) => m.status === "active")
      .map((m) => ({
        struereId: m.struereId,
        displayName: m.displayName,
        providerSlug: m.providerSlug,
        inputPerMTok: m.inputPerMTok,
        outputPerMTok: m.outputPerMTok,
        contextWindow: m.contextWindow,
        maxOutput: m.maxOutput,
      }))
  },
})

export const listAllModels = query({
  args: {},
  returns: v.array(v.object({
    struereId: v.string(),
    displayName: v.string(),
    providerSlug: v.string(),
    inputPerMTok: v.number(),
    outputPerMTok: v.number(),
    contextWindow: v.number(),
    maxOutput: v.number(),
  })),
  handler: async (ctx) => {
    const models = await ctx.db
      .query("modelRegistry")
      .collect()
    const seen = new Set<string>()
    return models
      .filter((m) => m.status === "active")
      .sort((a, b) => a.providerSlug.localeCompare(b.providerSlug))
      .filter((m) => {
        const key = `${m.providerSlug}:${m.displayName}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((m) => ({
        struereId: m.struereId,
        displayName: m.displayName,
        providerSlug: m.providerSlug,
        inputPerMTok: m.inputPerMTok,
        outputPerMTok: m.outputPerMTok,
        contextWindow: m.contextWindow,
        maxOutput: m.maxOutput,
      }))
  },
})

export const getFeaturedPricing = query({
  args: {},
  returns: v.array(v.object({
    modelId: v.string(),
    inputPerMTok: v.number(),
    outputPerMTok: v.number(),
  })),
  handler: async (ctx) => {
    const featured = [
      "xai/grok-4-1-fast",
      "anthropic/claude-haiku-4-5",
      "anthropic/claude-sonnet-4",
      "anthropic/claude-opus-4",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
    ]
    const results = []
    for (const modelId of featured) {
      const pricing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .unique()
      if (pricing) {
        results.push({
          modelId,
          inputPerMTok: Math.round(pricing.inputPerMTok * MARKUP * 100) / 100,
          outputPerMTok: Math.round(pricing.outputPerMTok * MARKUP * 100) / 100,
        })
      }
    }
    return results
  },
})

function normalizeModelName(model: string): string {
  const slashIndex = model.indexOf("/")
  return slashIndex !== -1 ? model.slice(slashIndex + 1) : model
}

function resolveOpenRouterId(model: string): string {
  const slashIndex = model.indexOf("/")
  return slashIndex !== -1 ? model : ""
}

export const getModelCost = internalQuery({
  args: {
    modelId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const registryEntry = await ctx.db
      .query("modelRegistry")
      .withIndex("by_struere_id", (q) => q.eq("struereId", args.modelId))
      .unique()

    if (registryEntry) {
      const costUsd = (args.inputTokens * registryEntry.inputPerMTok * MARKUP + args.outputTokens * registryEntry.outputPerMTok * MARKUP) / 1_000_000
      return Math.round(costUsd * 1_000_000)
    }

    const openRouterId = resolveOpenRouterId(args.modelId)

    let dbPricing = null
    if (openRouterId) {
      dbPricing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("modelId", openRouterId))
        .unique()
    }

    if (!dbPricing) {
      const normalized = normalizeModelName(args.modelId)
      dbPricing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("modelId", normalized))
        .unique()
    }

    if (dbPricing) {
      const inputCost = dbPricing.inputPerMTok * MARKUP
      const outputCost = dbPricing.outputPerMTok * MARKUP
      const costUsd = (args.inputTokens * inputCost + args.outputTokens * outputCost) / 1_000_000
      return Math.round(costUsd * 1_000_000)
    }

    return 0
  },
})
