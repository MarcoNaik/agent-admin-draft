import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface EvalSuiteInput {
  name: string
  slug: string
  agentSlug: string
  description?: string
  tags?: string[]
  judgeModel?: {
    provider: string
    name: string
  }
  judgeContext?: string
  judgePrompt?: string
  cases: Array<{
    name: string
    description?: string
    tags?: string[]
    turns: Array<{
      userMessage: string
      assertions?: Array<{
        type: "llm_judge" | "contains" | "matches" | "tool_called" | "tool_not_called"
        criteria?: string
        value?: string
        weight?: number
      }>
    }>
    finalAssertions?: Array<{
      type: "llm_judge" | "contains" | "matches" | "tool_called" | "tool_not_called"
      criteria?: string
      value?: string
      weight?: number
    }>
    channel?: "widget" | "whatsapp" | "api" | "dashboard"
    contextParams?: Record<string, unknown>
  }>
}

export async function syncEvalSuites(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  suites: EvalSuiteInput[],
  environment: "development" | "production" | "eval"
): Promise<{ created: string[]; updated: string[]; deleted: string[]; skipped: string[] }> {
  const result = { created: [] as string[], updated: [] as string[], deleted: [] as string[], skipped: [] as string[] }
  const now = Date.now()

  const agents = await ctx.db
    .query("agents")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect()

  const activeAgents = agents.filter((a) => a.status !== "deleted")
  const agentBySlug = new Map(activeAgents.map((a) => [a.slug, a]))

  const existingSuites = await ctx.db
    .query("evalSuites")
    .withIndex("by_org_env", (q) => q.eq("organizationId", organizationId).eq("environment", environment))
    .collect()

  const activeSuites = existingSuites.filter((s) => s.status === "active")
  const existingBySlug = new Map(activeSuites.map((s) => [s.slug, s]))
  const inputSlugs = new Set(suites.map((s) => s.slug))

  const skippedSlugs = new Set<string>()

  for (const suite of suites) {
    const agent = agentBySlug.get(suite.agentSlug)
    if (!agent) {
      result.skipped.push(`${suite.slug} (agent "${suite.agentSlug}" not found)`)
      skippedSlugs.add(suite.slug)
      continue
    }

    const existing = existingBySlug.get(suite.slug)

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: suite.name,
        agentId: agent._id,
        description: suite.description,
        tags: suite.tags,
        judgeModel: suite.judgeModel,
        judgeContext: suite.judgeContext,
        judgePrompt: suite.judgePrompt,
        updatedAt: now,
      })

      const oldCases = await ctx.db
        .query("evalCases")
        .withIndex("by_suite", (q) => q.eq("suiteId", existing._id))
        .collect()

      for (const oldCase of oldCases) {
        await ctx.db.delete(oldCase._id)
      }

      for (let i = 0; i < suite.cases.length; i++) {
        const c = suite.cases[i]
        await ctx.db.insert("evalCases", {
          organizationId,
          suiteId: existing._id,
          name: c.name,
          description: c.description,
          tags: c.tags,
          turns: c.turns,
          finalAssertions: c.finalAssertions,
          channel: c.channel,
          contextParams: c.contextParams,
          order: i,
          createdAt: now,
          updatedAt: now,
        })
      }

      result.updated.push(suite.slug)
    } else {
      const suiteId = await ctx.db.insert("evalSuites", {
        organizationId,
        agentId: agent._id,
        environment,
        name: suite.name,
        slug: suite.slug,
        description: suite.description,
        tags: suite.tags,
        judgeModel: suite.judgeModel,
        judgeContext: suite.judgeContext,
        judgePrompt: suite.judgePrompt,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })

      for (let i = 0; i < suite.cases.length; i++) {
        const c = suite.cases[i]
        await ctx.db.insert("evalCases", {
          organizationId,
          suiteId,
          name: c.name,
          description: c.description,
          tags: c.tags,
          turns: c.turns,
          finalAssertions: c.finalAssertions,
          channel: c.channel,
          contextParams: c.contextParams,
          order: i,
          createdAt: now,
          updatedAt: now,
        })
      }

      result.created.push(suite.slug)
    }
  }

  for (const existing of activeSuites) {
    if (!inputSlugs.has(existing.slug)) {
      await ctx.db.patch(existing._id, {
        status: "archived",
        updatedAt: now,
      })
      result.deleted.push(existing.slug)
    }
  }

  return result
}
