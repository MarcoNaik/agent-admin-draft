import { internalMutation } from "../_generated/server"
import { internal } from "../_generated/api"

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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEntityTypes, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillRoles, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEntities, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEntityRelations, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEvents, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillThreads, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillExecutions, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillApiKeys, {})
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
      await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillIntegrationConfigs, {})
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
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEntityTypes, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillRoles, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEntities, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEntityRelations, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillEvents, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillThreads, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillExecutions, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillApiKeys, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.backfillIntegrationConfigs, {})
    await ctx.scheduler.runAfter(0, internal.migrations.addEnvironment.removeAgentConfigFKs, {})
    return { scheduled: true }
  },
})
