import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { getAuthContext } from "./lib/auth"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

export const list = query({
  args: {
    agentId: v.optional(v.id("agents")),
    environment: v.optional(environmentValidator),
    status: v.optional(
      v.union(v.literal("success"), v.literal("error"), v.literal("timeout"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    if (args.agentId) {
      const executions = await ctx.db
        .query("executions")
        .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId!).eq("environment", environment))
        .order("desc")
        .take(args.limit ?? 50)

      if (args.status) {
        return executions.filter((e) => e.status === args.status)
      }
      return executions
    }

    const executions = await ctx.db
      .query("executions")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
      .order("desc")
      .take(args.limit ?? 50)

    if (args.status) {
      return executions.filter((e) => e.status === args.status)
    }
    return executions
  },
})

export const get = query({
  args: { id: v.id("executions") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const execution = await ctx.db.get(args.id)

    if (!execution || execution.organizationId !== auth.organizationId) {
      return null
    }

    return execution
  },
})

export const getStats = query({
  args: {
    agentId: v.optional(v.id("agents")),
    environment: v.optional(environmentValidator),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    let executions

    if (args.agentId) {
      executions = await ctx.db
        .query("executions")
        .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId!).eq("environment", environment))
        .collect()
    } else {
      executions = await ctx.db
        .query("executions")
        .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
        .collect()
    }

    if (args.since) {
      executions = executions.filter((e) => e.createdAt >= args.since!)
    }

    const total = executions.length
    const successful = executions.filter((e) => e.status === "success").length
    const failed = executions.filter((e) => e.status === "error").length
    const timeouts = executions.filter((e) => e.status === "timeout").length

    const totalInputTokens = executions.reduce((sum, e) => sum + e.inputTokens, 0)
    const totalOutputTokens = executions.reduce(
      (sum, e) => sum + e.outputTokens,
      0
    )
    const totalDuration = executions.reduce((sum, e) => sum + e.durationMs, 0)

    return {
      total,
      successful,
      failed,
      timeouts,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      averageDurationMs: total > 0 ? totalDuration / total : 0,
      averageInputTokens: total > 0 ? totalInputTokens / total : 0,
      averageOutputTokens: total > 0 ? totalOutputTokens / total : 0,
    }
  },
})

export const getUsageByAgent = query({
  args: {
    environment: v.optional(environmentValidator),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    let executions = await ctx.db
      .query("executions")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
      .collect()

    if (args.since) {
      executions = executions.filter((e) => e.createdAt >= args.since!)
    }

    const byAgent = new Map<
      string,
      {
        agentId: string
        count: number
        inputTokens: number
        outputTokens: number
        durationMs: number
        errors: number
      }
    >()

    for (const exec of executions) {
      const agentId = exec.agentId
      const existing = byAgent.get(agentId) || {
        agentId,
        count: 0,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        errors: 0,
      }

      existing.count++
      existing.inputTokens += exec.inputTokens
      existing.outputTokens += exec.outputTokens
      existing.durationMs += exec.durationMs
      if (exec.status === "error") existing.errors++

      byAgent.set(agentId, existing)
    }

    return Array.from(byAgent.values())
  },
})

export const getUsageByModel = query({
  args: {
    environment: v.optional(environmentValidator),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    let executions = await ctx.db
      .query("executions")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
      .collect()

    if (args.since) {
      executions = executions.filter((e) => e.createdAt >= args.since!)
    }

    const byModel = new Map<
      string,
      {
        model: string
        count: number
        inputTokens: number
        outputTokens: number
        errors: number
      }
    >()

    for (const exec of executions) {
      const model = exec.model ?? "unknown"
      const existing = byModel.get(model) || {
        model,
        count: 0,
        inputTokens: 0,
        outputTokens: 0,
        errors: 0,
      }

      existing.count++
      existing.inputTokens += exec.inputTokens
      existing.outputTokens += exec.outputTokens
      if (exec.status === "error") existing.errors++

      byModel.set(model, existing)
    }

    return Array.from(byModel.values()).sort(
      (a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens)
    )
  },
})

export const getRecent = query({
  args: {
    agentId: v.optional(v.id("agents")),
    environment: v.optional(environmentValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    if (args.agentId) {
      return await ctx.db
        .query("executions")
        .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId!).eq("environment", environment))
        .order("desc")
        .take(args.limit ?? 10)
    }

    return await ctx.db
      .query("executions")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
      .order("desc")
      .take(args.limit ?? 10)
  },
})

export const record = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    environment: environmentValidator,
    threadId: v.optional(v.id("threads")),
    versionId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    inputMessage: v.optional(v.string()),
    outputMessage: v.optional(v.string()),
    toolCalls: v.optional(v.array(v.object({
      name: v.string(),
      arguments: v.any(),
      result: v.optional(v.any()),
    }))),
    inputTokens: v.number(),
    outputTokens: v.number(),
    durationMs: v.number(),
    model: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("timeout")),
    errorMessage: v.optional(v.string()),
    usedPlatformKey: v.optional(v.boolean()),
    creditsConsumed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("executions", {
      organizationId: args.organizationId,
      agentId: args.agentId,
      environment: args.environment,
      threadId: args.threadId,
      versionId: args.versionId,
      conversationId: args.conversationId,
      inputMessage: args.inputMessage,
      outputMessage: args.outputMessage,
      toolCalls: args.toolCalls,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      durationMs: args.durationMs,
      model: args.model,
      status: args.status,
      errorMessage: args.errorMessage,
      usedPlatformKey: args.usedPlatformKey,
      creditsConsumed: args.creditsConsumed,
      createdAt: Date.now(),
    })
  },
})
