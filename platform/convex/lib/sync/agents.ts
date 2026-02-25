import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface AgentInput {
  name: string
  slug: string
  version: string
  description?: string
  firstMessageSuggestions?: string[]
  threadContextParams?: Array<{
    name: string
    type: "string" | "number" | "boolean"
    required?: boolean
    description?: string
  }>
  systemPrompt: string
  model: {
    provider: string
    name: string
    temperature?: number
    maxTokens?: number
  }
  tools: Array<{
    name: string
    description: string
    parameters: unknown
    handlerCode?: string
  }>
}

export async function syncAgents(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  agents: AgentInput[],
  environment: "development" | "production" | "eval",
  userId?: Id<"users">
): Promise<{ created: string[]; updated: string[]; deleted: string[] }> {
  const result = { created: [] as string[], updated: [] as string[], deleted: [] as string[] }
  const now = Date.now()

  const existingAgents = await ctx.db
    .query("agents")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect()

  const activeAgents = existingAgents.filter((a) => a.status !== "deleted")
  const existingBySlug = new Map(activeAgents.map((a) => [a.slug, a]))
  const inputSlugs = new Set(agents.map((a) => a.slug))

  for (const agent of agents) {
    const existing = existingBySlug.get(agent.slug)

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: agent.name,
        description: agent.description,
        updatedAt: now,
      })

      await syncAgentConfig(ctx, existing._id, agent, environment, userId)
      result.updated.push(agent.slug)
    } else {
      const agentId = await ctx.db.insert("agents", {
        organizationId,
        name: agent.name,
        slug: agent.slug,
        description: agent.description,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })

      await syncAgentConfig(ctx, agentId, agent, environment, userId)
      result.created.push(agent.slug)
    }
  }

  for (const existing of activeAgents) {
    if (!inputSlugs.has(existing.slug)) {
      const configs = await ctx.db
        .query("agentConfigs")
        .withIndex("by_agent_env", (q) => q.eq("agentId", existing._id))
        .collect()
      for (const config of configs) {
        await ctx.db.delete(config._id)
      }
      await ctx.db.delete(existing._id)
      result.deleted.push(existing.slug)
    }
  }

  return result
}

async function syncAgentConfig(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  agent: AgentInput,
  environment: "development" | "production" | "eval",
  userId?: Id<"users">
): Promise<void> {
  const now = Date.now()

  const existingConfig = await ctx.db
    .query("agentConfigs")
    .withIndex("by_agent_env", (q) => q.eq("agentId", agentId).eq("environment", environment))
    .first()

  const configData = {
    name: agent.name,
    version: agent.version,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    tools: agent.tools,
    firstMessageSuggestions: agent.firstMessageSuggestions,
    threadContextParams: agent.threadContextParams,
    environment,
    deployedBy: userId,
  }

  if (existingConfig) {
    await ctx.db.patch(existingConfig._id, configData)
  } else {
    await ctx.db.insert("agentConfigs", {
      agentId,
      ...configData,
      createdAt: now,
    })
  }
}

export async function getAgentSlugs(
  ctx: MutationCtx,
  organizationId: Id<"organizations">
): Promise<string[]> {
  const agents = await ctx.db
    .query("agents")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.neq(q.field("status"), "deleted"))
    .collect()

  return agents.map((a) => a.slug)
}
