import { v } from "convex/values"
import { query, mutation, internalMutation, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { getAuthContext, requireAuth } from "./lib/auth"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

const assertionValidator = v.object({
  type: v.union(
    v.literal("llm_judge"),
    v.literal("contains"),
    v.literal("matches"),
    v.literal("tool_called"),
    v.literal("tool_not_called")
  ),
  criteria: v.optional(v.string()),
  value: v.optional(v.string()),
  weight: v.optional(v.number()),
})

export const listSuites = query({
  args: {
    agentId: v.id("agents"),
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    const suites = await ctx.db
      .query("evalSuites")
      .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId).eq("environment", environment))
      .collect()

    return suites.filter((s) => s.organizationId === auth.organizationId && s.status === "active")
  },
})

export const listAllSuites = query({
  args: {
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const environment = args.environment ?? "development"

    const suites = await ctx.db
      .query("evalSuites")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", environment))
      .collect()

    return suites.filter((s) => s.status === "active")
  },
})

export const getSuite = query({
  args: { id: v.id("evalSuites") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const suite = await ctx.db.get(args.id)
    if (!suite || suite.organizationId !== auth.organizationId) return null
    return suite
  },
})

export const listCases = query({
  args: { suiteId: v.id("evalSuites") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const suite = await ctx.db.get(args.suiteId)
    if (!suite || suite.organizationId !== auth.organizationId) return []

    return await ctx.db
      .query("evalCases")
      .withIndex("by_suite_order", (q) => q.eq("suiteId", args.suiteId))
      .collect()
  },
})

export const getCase = query({
  args: { id: v.id("evalCases") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const evalCase = await ctx.db.get(args.id)
    if (!evalCase || evalCase.organizationId !== auth.organizationId) return null
    return evalCase
  },
})

export const listRuns = query({
  args: {
    suiteId: v.id("evalSuites"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const suite = await ctx.db.get(args.suiteId)
    if (!suite || suite.organizationId !== auth.organizationId) return []

    return await ctx.db
      .query("evalRuns")
      .withIndex("by_suite", (q) => q.eq("suiteId", args.suiteId))
      .order("desc")
      .take(args.limit ?? 20)
  },
})

export const getRun = query({
  args: { id: v.id("evalRuns") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const run = await ctx.db.get(args.id)
    if (!run || run.organizationId !== auth.organizationId) return null
    return run
  },
})

export const getRunResults = query({
  args: { runId: v.id("evalRuns") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const run = await ctx.db.get(args.runId)
    if (!run || run.organizationId !== auth.organizationId) return []

    return await ctx.db
      .query("evalResults")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect()
  },
})

export const createSuite = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    judgeModel: v.optional(v.object({
      provider: v.string(),
      name: v.string(),
    })),
    judgeContext: v.optional(v.string()),
    environment: v.optional(environmentValidator),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const environment = args.environment ?? "development"

    const agent = await ctx.db.get(args.agentId)
    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    const existing = await ctx.db
      .query("evalSuites")
      .withIndex("by_org_env_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("environment", environment).eq("slug", args.slug)
      )
      .first()

    if (existing && existing.status === "active") {
      throw new Error("Suite with this slug already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("evalSuites", {
      organizationId: auth.organizationId,
      agentId: args.agentId,
      environment,
      name: args.name,
      slug: args.slug,
      description: args.description,
      tags: args.tags,
      judgeModel: args.judgeModel,
      judgeContext: args.judgeContext,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateSuite = mutation({
  args: {
    id: v.id("evalSuites"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    judgeModel: v.optional(v.object({
      provider: v.string(),
      name: v.string(),
    })),
    judgeContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const suite = await ctx.db.get(args.id)
    if (!suite || suite.organizationId !== auth.organizationId) {
      throw new Error("Suite not found")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.tags !== undefined) updates.tags = args.tags
    if (args.judgeModel !== undefined) updates.judgeModel = args.judgeModel
    if (args.judgeContext !== undefined) updates.judgeContext = args.judgeContext

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const deleteSuite = mutation({
  args: { id: v.id("evalSuites") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const suite = await ctx.db.get(args.id)
    if (!suite || suite.organizationId !== auth.organizationId) {
      throw new Error("Suite not found")
    }

    await ctx.db.patch(args.id, { status: "archived", updatedAt: Date.now() })
    return { success: true }
  },
})

export const createCase = mutation({
  args: {
    suiteId: v.id("evalSuites"),
    name: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    turns: v.array(v.object({
      userMessage: v.string(),
      assertions: v.optional(v.array(assertionValidator)),
    })),
    finalAssertions: v.optional(v.array(assertionValidator)),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const suite = await ctx.db.get(args.suiteId)
    if (!suite || suite.organizationId !== auth.organizationId) {
      throw new Error("Suite not found")
    }
    if (suite.status !== "active") {
      throw new Error("Cannot add cases to an archived suite")
    }

    const existingCases = await ctx.db
      .query("evalCases")
      .withIndex("by_suite", (q) => q.eq("suiteId", args.suiteId))
      .collect()

    const maxOrder = existingCases.length > 0
      ? Math.max(...existingCases.map((c) => c.order))
      : -1

    const now = Date.now()
    return await ctx.db.insert("evalCases", {
      organizationId: auth.organizationId,
      suiteId: args.suiteId,
      name: args.name,
      description: args.description,
      tags: args.tags,
      turns: args.turns,
      finalAssertions: args.finalAssertions,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateCase = mutation({
  args: {
    id: v.id("evalCases"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    turns: v.optional(v.array(v.object({
      userMessage: v.string(),
      assertions: v.optional(v.array(assertionValidator)),
    }))),
    finalAssertions: v.optional(v.array(assertionValidator)),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const evalCase = await ctx.db.get(args.id)
    if (!evalCase || evalCase.organizationId !== auth.organizationId) {
      throw new Error("Case not found")
    }

    const suite = await ctx.db.get(evalCase.suiteId)
    if (suite && suite.status !== "active") {
      throw new Error("Cannot update cases in an archived suite")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.tags !== undefined) updates.tags = args.tags
    if (args.turns !== undefined) updates.turns = args.turns
    if (args.finalAssertions !== undefined) updates.finalAssertions = args.finalAssertions

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const deleteCase = mutation({
  args: { id: v.id("evalCases") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const evalCase = await ctx.db.get(args.id)
    if (!evalCase || evalCase.organizationId !== auth.organizationId) {
      throw new Error("Case not found")
    }

    const suite = await ctx.db.get(evalCase.suiteId)
    if (suite && suite.status !== "active") {
      throw new Error("Cannot delete cases from an archived suite")
    }

    await ctx.db.delete(args.id)
    return { success: true }
  },
})

export const reorderCases = mutation({
  args: {
    suiteId: v.id("evalSuites"),
    caseIds: v.array(v.id("evalCases")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const suite = await ctx.db.get(args.suiteId)
    if (!suite || suite.organizationId !== auth.organizationId) {
      throw new Error("Suite not found")
    }
    if (suite.status !== "active") {
      throw new Error("Cannot reorder cases in an archived suite")
    }

    for (let i = 0; i < args.caseIds.length; i++) {
      const evalCase = await ctx.db.get(args.caseIds[i])
      if (!evalCase || evalCase.organizationId !== auth.organizationId || evalCase.suiteId !== args.suiteId) {
        throw new Error("Case not found")
      }
      await ctx.db.patch(args.caseIds[i], { order: i })
    }

    return { success: true }
  },
})

export const startRun = mutation({
  args: {
    suiteId: v.id("evalSuites"),
    triggerSource: v.union(v.literal("dashboard"), v.literal("cli")),
    caseIds: v.optional(v.array(v.id("evalCases"))),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const suite = await ctx.db.get(args.suiteId)
    if (!suite || suite.organizationId !== auth.organizationId) {
      throw new Error("Suite not found")
    }

    if (suite.status !== "active") {
      throw new Error("Cannot run an archived suite")
    }

    let cases = await ctx.db
      .query("evalCases")
      .withIndex("by_suite", (q) => q.eq("suiteId", args.suiteId))
      .collect()

    if (args.caseIds) {
      const requestedIds = new Set(args.caseIds)
      cases = cases.filter((c) => requestedIds.has(c._id))
      if (cases.length !== args.caseIds.length) {
        throw new Error("One or more case IDs do not belong to this suite")
      }
    }

    if (cases.length === 0) {
      throw new Error("Suite has no cases")
    }

    const agentConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", suite.agentId).eq("environment", suite.environment))
      .order("desc")
      .first()

    const now = Date.now()
    const runId = await ctx.db.insert("evalRuns", {
      organizationId: auth.organizationId,
      suiteId: args.suiteId,
      agentId: suite.agentId,
      environment: suite.environment,
      status: "running",
      triggeredBy: auth.userId,
      triggerSource: args.triggerSource,
      agentConfigSnapshot: agentConfig ? {
        version: agentConfig.version,
        model: agentConfig.model,
        systemPrompt: agentConfig.systemPrompt,
        tools: agentConfig.tools.map((t) => t.name),
      } : undefined,
      totalCases: cases.length,
      completedCases: 0,
      passedCases: 0,
      failedCases: 0,
      startedAt: now,
      createdAt: now,
    })

    for (const c of cases) {
      await ctx.db.insert("evalResults", {
        organizationId: auth.organizationId,
        runId,
        caseId: c._id,
        status: "pending",
        overallPassed: false,
        createdAt: now,
      })
    }

    for (const c of cases) {
      await ctx.scheduler.runAfter(0, internal.evalRunner.executeCase, {
        runId,
        caseId: c._id,
      })
    }

    return runId
  },
})

export const cancelRun = mutation({
  args: { id: v.id("evalRuns") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const run = await ctx.db.get(args.id)
    if (!run || run.organizationId !== auth.organizationId) {
      throw new Error("Run not found")
    }

    if (run.status !== "pending" && run.status !== "running") {
      throw new Error("Can only cancel pending or running runs")
    }

    await ctx.db.patch(args.id, { status: "cancelled", completedAt: Date.now() })
    return { success: true }
  },
})

export const recordResult = internalMutation({
  args: {
    runId: v.id("evalRuns"),
    caseId: v.id("evalCases"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("passed"),
      v.literal("failed"),
      v.literal("error")
    ),
    threadId: v.optional(v.id("threads")),
    turnResults: v.optional(v.array(v.object({
      turnIndex: v.number(),
      userMessage: v.string(),
      assistantResponse: v.string(),
      toolCalls: v.optional(v.array(v.object({
        name: v.string(),
        arguments: v.any(),
        result: v.optional(v.any()),
      }))),
      assertionResults: v.optional(v.array(v.object({
        type: v.string(),
        passed: v.boolean(),
        score: v.optional(v.number()),
        reason: v.optional(v.string()),
        criteria: v.optional(v.string()),
      }))),
      durationMs: v.number(),
      agentTokens: v.optional(v.object({
        input: v.number(),
        output: v.number(),
      })),
    }))),
    finalAssertionResults: v.optional(v.array(v.object({
      type: v.string(),
      passed: v.boolean(),
      score: v.optional(v.number()),
      reason: v.optional(v.string()),
      criteria: v.optional(v.string()),
    }))),
    overallPassed: v.boolean(),
    overallScore: v.optional(v.number()),
    totalDurationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    judgeTokens: v.optional(v.object({
      input: v.number(),
      output: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("evalResults")
      .withIndex("by_run_case", (q) => q.eq("runId", args.runId).eq("caseId", args.caseId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        threadId: args.threadId,
        turnResults: args.turnResults,
        finalAssertionResults: args.finalAssertionResults,
        overallPassed: args.overallPassed,
        overallScore: args.overallScore,
        totalDurationMs: args.totalDurationMs,
        errorMessage: args.errorMessage,
        judgeTokens: args.judgeTokens,
        completedAt: Date.now(),
      })
    }
  },
})

export const caseCompleted = internalMutation({
  args: {
    runId: v.id("evalRuns"),
    passed: v.boolean(),
    overallScore: v.optional(v.number()),
    agentTokens: v.number(),
    judgeTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) return
    if (run.status === "cancelled" || run.status === "completed") return

    const completedCases = run.completedCases + 1
    const passedCases = args.passed ? run.passedCases + 1 : run.passedCases
    const failedCases = args.passed ? run.failedCases : run.failedCases + 1

    const prevAgent = run.totalTokens?.agent ?? 0
    const prevJudge = run.totalTokens?.judge ?? 0
    const totalTokens = {
      agent: prevAgent + args.agentTokens,
      judge: prevJudge + args.judgeTokens,
    }

    const updates: Record<string, unknown> = {
      completedCases,
      passedCases,
      failedCases,
      totalTokens,
    }

    if (completedCases === run.totalCases) {
      const results = await ctx.db
        .query("evalResults")
        .withIndex("by_run", (q) => q.eq("runId", args.runId))
        .collect()

      const scores = results
        .map((r) => r.overallScore)
        .filter((s): s is number => s !== undefined)

      const overallScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : completedCases > 0
          ? (passedCases / completedCases) * 5
          : undefined

      updates.status = "completed"
      updates.overallScore = overallScore
      updates.totalDurationMs = Date.now() - (run.startedAt ?? run.createdAt)
      updates.completedAt = Date.now()
    }

    await ctx.db.patch(args.runId, updates)
  },
})

export const getRunInternal = internalQuery({
  args: { runId: v.id("evalRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId)
  },
})

export const getSuiteInternal = internalQuery({
  args: { suiteId: v.id("evalSuites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.suiteId)
  },
})

export const getCaseInternal = internalQuery({
  args: { caseId: v.id("evalCases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.caseId)
  },
})

export const getOrgName = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId)
    return org?.name ?? null
  },
})

export const getAgentInternal = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId)
  },
})

export const getAgentConfig = internalQuery({
  args: {
    agentId: v.id("agents"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId).eq("environment", args.environment))
      .first()
  },
})

export const getEntityTypes = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env", (q) => q.eq("organizationId", args.organizationId).eq("environment", args.environment))
      .collect()
  },
})

export const getRoles = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org_env", (q) => q.eq("organizationId", args.organizationId).eq("environment", args.environment))
      .collect()
    return roles.filter((r) => !r.isSystem)
  },
})

export const deleteCasesBySuite = mutation({
  args: { suiteId: v.id("evalSuites") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const suite = await ctx.db.get(args.suiteId)
    if (!suite || suite.organizationId !== auth.organizationId) {
      throw new Error("Suite not found")
    }
    if (suite.status !== "active") {
      throw new Error("Cannot modify cases of an archived suite")
    }

    const cases = await ctx.db
      .query("evalCases")
      .withIndex("by_suite", (q) => q.eq("suiteId", args.suiteId))
      .collect()

    for (const c of cases) {
      await ctx.db.delete(c._id)
    }

    return { deleted: cases.length }
  },
})
