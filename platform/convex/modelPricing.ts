import { internalAction, internalMutation, internalQuery, query } from "./_generated/server"
import { v } from "convex/values"
import { calculateCost } from "./lib/creditPricing"

const MARKUP = 1.1

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

import { makeFunctionReference } from "convex/server"

const upsertPricingRef = makeFunctionReference<"mutation">("modelPricing:upsertPricing")

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

export const getPricing = internalQuery({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("modelPricing")
      .withIndex("by_model", (q) => q.eq("modelId", args.modelId))
      .unique()
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

    return calculateCost(args.modelId, args.inputTokens, args.outputTokens)
  },
})
