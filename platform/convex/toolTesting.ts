import { v } from "convex/values"
import { query, action, internalQuery, internalAction } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "./_generated/dataModel"
import { getAuthContext, getAuthContextForOrg } from "./lib/auth"
import { ActorContext } from "./lib/permissions/types"
import { buildToolExecutor, serializeActor } from "./lib/toolExecution"
import { isBuiltinTool } from "./tools/helpers"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

const getToolTestDataRef = makeFunctionReference<"query">("toolTesting:getToolTestData" as any)
const getToolTestDataBySlugRef = makeFunctionReference<"query">("toolTesting:getToolTestDataBySlug" as any)
const buildActorContextForAgentRef = makeFunctionReference<"query">("agent:buildActorContextForAgent" as any)
const canUseToolQueryRef = makeFunctionReference<"query">("permissions:canUseToolQuery" as any)

export const getToolTestData = internalQuery({
  args: {
    agentId: v.id("agents"),
    environment: environmentValidator,
    organizationId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const auth = await getAuthContextForOrg(ctx, args.organizationId)
    const agent = await ctx.db.get(args.agentId)

    if (!agent || agent.organizationId !== auth.organizationId) {
      return null
    }

    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId).eq("environment", args.environment))
      .first()

    if (!config) {
      return null
    }

    return {
      agent: { name: agent.name, slug: agent.slug },
      agentId: args.agentId,
      tools: config.tools,
      organizationId: auth.organizationId,
      userId: auth.userId,
    }
  },
})

export const getToolTestDataBySlug = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    slug: v.string(),
    environment: environmentValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.slug)
      )
      .first()

    if (!agent) {
      return null
    }

    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id).eq("environment", args.environment))
      .first()

    if (!config) {
      return null
    }

    return {
      agent: { name: agent.name, slug: agent.slug },
      agentId: agent._id,
      tools: config.tools,
      organizationId: args.organizationId,
    }
  },
})

export const runTool = action({
  args: {
    agentId: v.id("agents"),
    environment: environmentValidator,
    toolName: v.string(),
    toolArgs: v.any(),
    organizationId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(getToolTestDataRef, {
      agentId: args.agentId,
      environment: args.environment,
      organizationId: args.organizationId,
    }) as any

    if (!data) {
      return { error: true, errorType: "not_found", message: "Agent not found or no config for this environment" }
    }

    const tools = data.tools as any[] | undefined
    const tool = tools?.find((t: any) => t.name === args.toolName)
    if (!tool) {
      return { error: true, errorType: "tool_not_found", message: "Tool not found on this agent" }
    }

    const actor: ActorContext = await ctx.runQuery(buildActorContextForAgentRef, {
      organizationId: data.organizationId,
      actorType: "user",
      actorId: data.userId as string,
      environment: args.environment,
    })

    const permResult = await ctx.runQuery(canUseToolQueryRef, {
      actor: serializeActor(actor),
      agentId: args.agentId,
      toolName: args.toolName,
    }) as { allowed: boolean; reason?: string; identityMode: string }

    if (!permResult.allowed) {
      return { error: true, errorType: "permission_denied", message: permResult.reason }
    }

    const toolExecutor = buildToolExecutor(ctx, actor, args.agentId, args.environment)
    const startTime = Date.now()

    try {
      let result: any

      if (isBuiltinTool(args.toolName)) {
        result = await toolExecutor.executeBuiltin(args.toolName, args.toolArgs || {})
      } else if (tool.handlerCode) {
        result = await toolExecutor.executeCustom(args.toolName, args.toolArgs || {}, tool.handlerCode)
      } else {
        return { error: true, errorType: "no_handler", message: "Custom tool has no handler code" }
      }

      const durationMs = Date.now() - startTime

      return {
        tool: { name: args.toolName, isBuiltin: isBuiltinTool(args.toolName) },
        agent: data.agent,
        environment: args.environment,
        result,
        durationMs,
        identity: {
          actorType: actor.actorType,
          identityMode: permResult.identityMode,
        },
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      return {
        error: true,
        errorType: "execution_error",
        message: err.message || String(err),
        durationMs,
      }
    }
  },
})

export const runToolBySlug = internalAction({
  args: {
    organizationId: v.id("organizations"),
    slug: v.string(),
    environment: environmentValidator,
    toolName: v.string(),
    toolArgs: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(getToolTestDataBySlugRef, {
      organizationId: args.organizationId,
      slug: args.slug,
      environment: args.environment,
    }) as any

    if (!data) {
      return { error: true, errorType: "not_found", message: "Agent not found or no config for this environment" }
    }

    const tools = data.tools as any[] | undefined
    const tool = tools?.find((t: any) => t.name === args.toolName)
    if (!tool) {
      return { error: true, errorType: "tool_not_found", message: "Tool not found on this agent" }
    }

    const actor: ActorContext = await ctx.runQuery(buildActorContextForAgentRef, {
      organizationId: args.organizationId,
      actorType: "system",
      actorId: "system",
      environment: args.environment,
    })

    const permResult = await ctx.runQuery(canUseToolQueryRef, {
      actor: serializeActor(actor),
      agentId: data.agentId,
      toolName: args.toolName,
    }) as { allowed: boolean; reason?: string; identityMode: string }

    if (!permResult.allowed) {
      return { error: true, errorType: "permission_denied", message: permResult.reason }
    }

    const toolExecutor = buildToolExecutor(ctx, actor, data.agentId, args.environment)
    const startTime = Date.now()

    try {
      let result: any

      if (isBuiltinTool(args.toolName)) {
        result = await toolExecutor.executeBuiltin(args.toolName, args.toolArgs || {})
      } else if (tool.handlerCode) {
        result = await toolExecutor.executeCustom(args.toolName, args.toolArgs || {}, tool.handlerCode)
      } else {
        return { error: true, errorType: "no_handler", message: "Custom tool has no handler code" }
      }

      const durationMs = Date.now() - startTime

      return {
        tool: { name: args.toolName, isBuiltin: isBuiltinTool(args.toolName) },
        agent: data.agent,
        environment: args.environment,
        result,
        durationMs,
        identity: {
          actorType: actor.actorType,
          identityMode: permResult.identityMode,
        },
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      return {
        error: true,
        errorType: "execution_error",
        message: err.message || String(err),
        durationMs,
      }
    }
  },
})

export const listAgentTools = query({
  args: {
    agentId: v.id("agents"),
    environment: environmentValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const agent = await ctx.db.get(args.agentId)
    if (!agent || agent.organizationId !== auth.organizationId) {
      return []
    }

    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId).eq("environment", args.environment))
      .first()

    if (!config?.tools) {
      return []
    }

    return (config.tools as any[]).map((t: any) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      isBuiltin: isBuiltinTool(t.name),
      templateOnly: t.templateOnly,
    }))
  },
})
