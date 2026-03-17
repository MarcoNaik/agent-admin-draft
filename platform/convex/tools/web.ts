"use node"

import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { jinaSearch, jinaFetch } from "../lib/integrations/jina"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

export const webSearch = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    query: v.string(),
    maxResults: v.optional(v.number()),
    site: v.optional(v.array(v.string())),
    gl: v.optional(v.string()),
    hl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    return await jinaSearch({
      query: args.query,
      maxResults: args.maxResults,
      site: args.site,
      gl: args.gl,
      hl: args.hl,
    })
  },
})

export const webFetch = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    url: v.string(),
    targetSelector: v.optional(v.string()),
    removeSelector: v.optional(v.string()),
    tokenBudget: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    return await jinaFetch({
      url: args.url,
      targetSelector: args.targetSelector,
      removeSelector: args.removeSelector,
      tokenBudget: args.tokenBudget,
    })
  },
})
