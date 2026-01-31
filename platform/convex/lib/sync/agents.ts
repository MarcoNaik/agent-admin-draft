import { MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"

export interface AgentInput {
  name: string
  slug: string
  version: string
  description?: string
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
    isBuiltin: boolean
  }>
}

export async function syncAgents(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  agents: AgentInput[],
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

      await syncAgentConfig(ctx, existing._id, agent, userId)
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

      await syncAgentConfig(ctx, agentId, agent, userId)
      result.created.push(agent.slug)
    }
  }

  for (const existing of activeAgents) {
    if (!inputSlugs.has(existing.slug)) {
      await ctx.db.patch(existing._id, {
        status: "deleted",
        updatedAt: now,
      })
      result.deleted.push(existing.slug)
    }
  }

  return result
}

async function syncAgentConfig(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  agent: AgentInput,
  userId?: Id<"users">
): Promise<void> {
  const now = Date.now()
  const existingAgent = await ctx.db.get(agentId)
  if (!existingAgent) return

  const configData = {
    name: agent.name,
    version: agent.version,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    tools: agent.tools,
    environment: "development" as const,
    deployedBy: userId,
  }

  if (existingAgent.developmentConfigId) {
    await ctx.db.patch(existingAgent.developmentConfigId, configData)
  } else {
    const configId = await ctx.db.insert("agentConfigs", {
      agentId,
      ...configData,
      createdAt: now,
    })

    await ctx.db.patch(agentId, {
      developmentConfigId: configId,
      updatedAt: now,
    })
  }
}

export async function deployAllAgentsToProd(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId?: Id<"users">
): Promise<{ deployed: string[]; skipped: string[] }> {
  const result = { deployed: [] as string[], skipped: [] as string[] }
  const now = Date.now()

  const agents = await ctx.db
    .query("agents")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect()

  const activeAgents = agents.filter((a) => a.status === "active")

  for (const agent of activeAgents) {
    if (!agent.developmentConfigId) {
      result.skipped.push(agent.slug)
      continue
    }

    const devConfig = await ctx.db.get(agent.developmentConfigId)
    if (!devConfig) {
      result.skipped.push(agent.slug)
      continue
    }

    const prodConfigId = await ctx.db.insert("agentConfigs", {
      agentId: agent._id,
      name: devConfig.name,
      version: devConfig.version,
      systemPrompt: devConfig.systemPrompt,
      model: devConfig.model,
      tools: devConfig.tools,
      environment: "production",
      createdAt: now,
      deployedBy: userId,
    })

    await ctx.db.patch(agent._id, {
      productionConfigId: prodConfigId,
      updatedAt: now,
    })

    result.deployed.push(agent.slug)
  }

  return result
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
