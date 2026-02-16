import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"
import { generateId } from "../lib/utils"
import { ActorContext, Environment } from "../lib/permissions/types"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

const MAX_AGENT_DEPTH = 3

interface AgentChatResult {
  response: string
  threadId: Id<"threads">
  agentSlug: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export const agentChat = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    agentSlug: v.string(),
    message: v.string(),
    context: v.optional(v.any()),
    conversationId: v.optional(v.string()),
    depth: v.number(),
    callerAgentSlug: v.optional(v.string()),
  },
  returns: v.object({
    response: v.string(),
    threadId: v.id("threads"),
    agentSlug: v.string(),
    usage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<AgentChatResult> => {
    if (args.depth >= MAX_AGENT_DEPTH) {
      throw new Error(
        `Agent delegation depth limit exceeded (max ${MAX_AGENT_DEPTH}). ` +
        `Chain: depth=${args.depth}, caller=${args.callerAgentSlug}, target=${args.agentSlug}`
      )
    }

    if (args.callerAgentSlug && args.agentSlug === args.callerAgentSlug) {
      throw new Error(
        `Agent cycle detected: "${args.agentSlug}" cannot call itself`
      )
    }

    const targetAgent = await ctx.runQuery(internal.agent.getAgentBySlugInternal, {
      slug: args.agentSlug,
      organizationId: args.organizationId,
    }) as { _id: Id<"agents">; name: string; slug: string; status: string } | null

    if (!targetAgent) {
      throw new Error(`Agent "${args.agentSlug}" not found in this organization`)
    }

    if (targetAgent.status !== "active") {
      throw new Error(`Agent "${args.agentSlug}" is not active (status: ${targetAgent.status})`)
    }

    const config: any = await ctx.runQuery(internal.agents.getActiveConfig, {
      agentId: targetAgent._id,
      environment: args.environment,
    })

    if (!config) {
      throw new Error(`No active config found for agent "${args.agentSlug}" in ${args.environment}`)
    }

    const conversationId = args.conversationId ?? generateId("conv")

    const threadId: Id<"threads"> = await ctx.runMutation(internal.threads.getOrCreate, {
      organizationId: args.organizationId,
      agentId: targetAgent._id,
      environment: args.environment,
      metadata: {
        conversationId,
        parentAgentSlug: args.callerAgentSlug,
        depth: args.depth + 1,
        parentContext: args.context,
      },
      conversationId,
    })

    const thread: any = await ctx.runQuery(internal.threads.getThreadInternal, { threadId })

    const actor: ActorContext = await ctx.runQuery(internal.agent.buildActorContextForAgent, {
      organizationId: args.organizationId,
      actorType: "system",
      actorId: `agent:${targetAgent._id}`,
      environment: args.environment,
    }) as ActorContext

    const result: { message: string; threadId: Id<"threads">; usage: { inputTokens: number; outputTokens: number; totalTokens: number } } = await ctx.runAction(internal.agent.executeChatAction, {
      organizationId: args.organizationId,
      agentId: targetAgent._id,
      message: args.message,
      threadId,
      environment: args.environment,
      actor: {
        organizationId: actor.organizationId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        roleIds: actor.roleIds,
        isOrgAdmin: actor.isOrgAdmin,
        environment: actor.environment,
      },
      agent: { name: targetAgent.name, slug: targetAgent.slug },
      config,
      thread,
      conversationId,
      depth: args.depth + 1,
    })

    return {
      response: result.message,
      threadId: result.threadId,
      agentSlug: args.agentSlug,
      usage: result.usage,
    }
  },
})
