import { internalMutation } from "../_generated/server"
import { makeFunctionReference } from "convex/server"

const backfillEntityTypesRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillEntityTypes")
const backfillRolesRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillRoles")
const backfillEntitiesRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillEntities")
const backfillEntityRelationsRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillEntityRelations")
const backfillEventsRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillEvents")
const backfillThreadsRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillThreads")
const backfillExecutionsRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillExecutions")
const backfillApiKeysRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillApiKeys")
const backfillIntegrationConfigsRef = makeFunctionReference<"mutation">("migrations/addEnvironment:backfillIntegrationConfigs")
const removeAgentConfigFKsRef = makeFunctionReference<"mutation">("migrations/addEnvironment:removeAgentConfigFKs")

const BATCH_SIZE = 100

export const backfillEntityTypes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("entityTypes")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "development" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillEntityTypesRef, {})
    }

    return { patched: count }
  },
})

export const backfillRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("roles")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "development" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillRolesRef, {})
    }

    return { patched: count }
  },
})

export const backfillEntities = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("entities")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "development" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillEntitiesRef, {})
    }

    return { patched: count }
  },
})

export const backfillEntityRelations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("entityRelations")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "development" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillEntityRelationsRef, {})
    }

    return { patched: count }
  },
})

export const backfillEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("events")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "development" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillEventsRef, {})
    }

    return { patched: count }
  },
})

export const backfillThreads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("threads")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "development" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillThreadsRef, {})
    }

    return { patched: count }
  },
})

export const backfillExecutions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("executions")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "development" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillExecutionsRef, {})
    }

    return { patched: count }
  },
})

export const backfillApiKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("apiKeys")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "production" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillApiKeysRef, {})
    }

    return { patched: count }
  },
})

export const backfillIntegrationConfigs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("integrationConfigs")
      .filter((q) => q.eq(q.field("environment"), undefined))
      .take(BATCH_SIZE)
    let count = 0

    for (const record of records) {
      await ctx.db.patch(record._id, { environment: "production" } as any)
      count++
    }

    if (records.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, backfillIntegrationConfigsRef, {})
    }

    return { patched: count }
  },
})

export const removeAgentConfigFKs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect()
    let count = 0

    for (const agent of agents) {
      const patch: Record<string, undefined> = {}
      if ((agent as any).developmentConfigId !== undefined) {
        patch.developmentConfigId = undefined
      }
      if ((agent as any).productionConfigId !== undefined) {
        patch.productionConfigId = undefined
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(agent._id, patch as any)
        count++
      }
    }

    return { patched: count }
  },
})

export const runAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, backfillEntityTypesRef, {})
    await ctx.scheduler.runAfter(0, backfillRolesRef, {})
    await ctx.scheduler.runAfter(0, backfillEntitiesRef, {})
    await ctx.scheduler.runAfter(0, backfillEntityRelationsRef, {})
    await ctx.scheduler.runAfter(0, backfillEventsRef, {})
    await ctx.scheduler.runAfter(0, backfillThreadsRef, {})
    await ctx.scheduler.runAfter(0, backfillExecutionsRef, {})
    await ctx.scheduler.runAfter(0, backfillApiKeysRef, {})
    await ctx.scheduler.runAfter(0, backfillIntegrationConfigsRef, {})
    await ctx.scheduler.runAfter(0, removeAgentConfigFKsRef, {})
    return { scheduled: true }
  },
})
