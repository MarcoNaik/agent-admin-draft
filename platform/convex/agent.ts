import { v } from "convex/values"
import { internalAction, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { hashApiKey } from "./lib/utils"
import { processTemplates, TemplateContext, ToolExecutor, EntityTypeContext } from "./lib/templateEngine"
import { ActorContext, ActorType, Environment } from "./lib/permissions/types"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

interface Message {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

interface ApiKeyAuth {
  organizationId: Id<"organizations">
  keyPrefix: string
  permissions: string[]
  environment: Environment
}

interface ChatResponse {
  message: string
  threadId: Id<"threads">
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

interface ToolConfig {
  name: string
  description: string
  parameters: unknown
  handlerCode?: string
  isBuiltin: boolean
}

function serializeActor(actor: ActorContext) {
  return {
    organizationId: actor.organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    roleIds: actor.roleIds,
    isOrgAdmin: actor.isOrgAdmin,
    environment: actor.environment,
  }
}

export const chat = internalAction({
  args: {
    apiKey: v.string(),
    agentId: v.id("agents"),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
    externalThreadId: v.optional(v.string()),
  },
  returns: v.object({
    message: v.string(),
    threadId: v.id("threads"),
    usage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<ChatResponse> => {
    const startTime = Date.now()

    const keyHash = await hashApiKey(args.apiKey)
    const auth: ApiKeyAuth | null = await ctx.runQuery(internal.agent.validateApiKey, { keyHash })

    if (!auth) {
      throw new Error("Invalid API key")
    }

    const environment = auth.environment

    const agent = await ctx.runQuery(internal.agent.getAgentInternal, {
      agentId: args.agentId,
      organizationId: auth.organizationId,
    })

    if (!agent) {
      throw new Error("Agent not found")
    }

    const config = await ctx.runQuery(internal.agents.getActiveConfig, {
      agentId: args.agentId,
      environment,
    })

    const threadId: Id<"threads"> = args.threadId ?? await ctx.runMutation(internal.threads.getOrCreate, {
      organizationId: auth.organizationId,
      agentId: args.agentId,
      externalId: args.externalThreadId,
      environment,
    })

    const existingMessages = await ctx.runQuery(internal.agent.getThreadMessages, {
      threadId,
    })

    const thread = await ctx.runQuery(internal.threads.getThreadInternal, { threadId })

    const actor: ActorContext = await ctx.runQuery(internal.agent.buildActorContextForAgent, {
      organizationId: auth.organizationId,
      actorType: "agent",
      actorId: `apikey:${auth.keyPrefix}`,
      environment,
    })

    const [organization, entityTypesRaw, rolesRaw] = await Promise.all([
      ctx.runQuery(internal.organizations.getInternal, { organizationId: auth.organizationId }),
      ctx.runQuery(internal.entityTypes.listInternal, { organizationId: auth.organizationId, environment }),
      ctx.runQuery(internal.roles.listInternal, { organizationId: auth.organizationId, environment }),
    ])

    const now = Date.now()
    const currentTimeStr = new Date(now).toISOString()

    const entityTypes: EntityTypeContext[] = (entityTypesRaw || []).map((et: { name: string; slug: string; description?: string; schema: Record<string, unknown>; searchFields?: string[] }) => ({
      name: et.name,
      slug: et.slug,
      description: et.description,
      schema: et.schema as Record<string, unknown>,
      searchFields: et.searchFields,
    }))

    const roles = (rolesRaw || []).map((r: { name: string; description?: string }) => ({
      name: r.name,
      description: r.description,
    }))

    const templateContext: TemplateContext = {
      organizationId: auth.organizationId,
      organizationName: organization?.name ?? "Unknown Organization",
      userId: thread?.userId,
      threadId,
      agentId: args.agentId,
      actor,
      agent: { name: agent.name, slug: agent.slug },
      agentName: agent.name,
      thread: { metadata: thread?.metadata as Record<string, unknown> | undefined },
      message: args.message,
      timestamp: now,
      datetime: currentTimeStr,
      currentTime: currentTimeStr,
      entityTypes,
      roles,
    }

    const toolExecutor: ToolExecutor = {
      executeBuiltin: async (name, toolArgs) => {
        const toolIdentity = await ctx.runQuery(
          internal.permissions.getToolIdentityQuery,
          { actor: serializeActor(actor), agentId: args.agentId, toolName: name }
        )
        return executeBuiltinTool(ctx, {
          organizationId: toolIdentity.organizationId,
          actorId: toolIdentity.actorId,
          actorType: toolIdentity.actorType,
          isOrgAdmin: toolIdentity.isOrgAdmin,
          environment,
          toolName: name,
          args: toolArgs,
        })
      },
      executeCustom: (handlerCode, toolArgs) =>
        ctx.runAction(internal.agent.executeCustomTool, {
          handlerCode,
          args: toolArgs,
          context: {
            organizationId: actor.organizationId,
            actorId: actor.actorId,
            actorType: actor.actorType,
          },
        }),
    }

    const processedSystemPrompt = await processTemplates(
      config.systemPrompt,
      templateContext,
      config.tools,
      toolExecutor,
      ctx.runQuery
    )

    const messages: Message[] = [
      { role: "system", content: processedSystemPrompt },
      ...existingMessages.map((m: { role: string; content: string; toolCalls?: unknown; toolCallId?: string }) => ({
        role: m.role as Message["role"],
        content: m.content,
        toolCalls: m.toolCalls as ToolCall[] | undefined,
        toolCallId: m.toolCallId,
      })),
      { role: "user", content: args.message },
    ]

    const llmMessages = messages.map((m) => {
      if (m.role === "assistant" && m.toolCalls) {
        return {
          role: m.role,
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        }
      }
      if (m.role === "tool") {
        return {
          role: m.role,
          content: m.content,
          tool_call_id: m.toolCallId,
        }
      }
      return { role: m.role, content: m.content }
    })

    const tools = config.tools.map((t: ToolConfig) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

    let response = await callLLM({
      model: config.model,
      messages: llmMessages,
      tools: tools.length > 0 ? tools : undefined,
    })

    let totalInputTokens = response.usage?.prompt_tokens ?? 0
    let totalOutputTokens = response.usage?.completion_tokens ?? 0

    const newMessages: Message[] = [{ role: "user", content: args.message }]

    let iterations = 0
    const maxIterations = 10

    while (response.choices[0]?.message?.tool_calls && iterations < maxIterations) {
      iterations++

      const assistantMessage = response.choices[0].message
      const toolCalls: ToolCall[] = (assistantMessage.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }))

      newMessages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        toolCalls,
      })

      for (const tc of toolCalls) {
        const toolConfig = config.tools.find((t: ToolConfig) => t.name === tc.name)
        if (!toolConfig) {
          newMessages.push({
            role: "tool",
            content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
            toolCallId: tc.id,
          })
          continue
        }

        const permissionResult = await ctx.runQuery(
          internal.permissions.canUseToolQuery,
          { actor: serializeActor(actor), agentId: args.agentId, toolName: tc.name }
        )

        if (!permissionResult.allowed) {
          newMessages.push({
            role: "tool",
            content: JSON.stringify({ error: `Permission denied: ${permissionResult.reason}` }),
            toolCallId: tc.id,
          })
          continue
        }

        try {
          const toolIdentity = await ctx.runQuery(
            internal.permissions.getToolIdentityQuery,
            { actor: serializeActor(actor), agentId: args.agentId, toolName: tc.name }
          )

          let result: unknown

          if (toolConfig.isBuiltin) {
            result = await executeBuiltinTool(ctx, {
              organizationId: toolIdentity.organizationId,
              actorId: toolIdentity.actorId,
              actorType: toolIdentity.actorType,
              isOrgAdmin: toolIdentity.isOrgAdmin,
              environment,
              toolName: tc.name,
              args: tc.arguments,
            })
          } else if (toolConfig.handlerCode) {
            result = await ctx.runAction(internal.agent.executeCustomTool, {
              handlerCode: toolConfig.handlerCode,
              args: tc.arguments,
              context: {
                organizationId: toolIdentity.organizationId,
                actorId: toolIdentity.actorId,
                actorType: toolIdentity.actorType,
              },
            })
          } else {
            result = { error: "Tool has no handler" }
          }

          newMessages.push({
            role: "tool",
            content: JSON.stringify(result),
            toolCallId: tc.id,
          })
        } catch (error) {
          newMessages.push({
            role: "tool",
            content: JSON.stringify({
              error: error instanceof Error ? error.message : "Tool execution failed",
            }),
            toolCallId: tc.id,
          })
        }
      }

      const updatedMessages = [
        ...llmMessages,
        ...newMessages.map((m) => {
          if (m.role === "assistant" && m.toolCalls) {
            return {
              role: m.role,
              content: m.content,
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            }
          }
          if (m.role === "tool") {
            return {
              role: m.role,
              content: m.content,
              tool_call_id: m.toolCallId,
            }
          }
          return { role: m.role, content: m.content }
        }),
      ]

      response = await callLLM({
        model: config.model,
        messages: updatedMessages,
        tools: tools.length > 0 ? tools : undefined,
      })

      totalInputTokens += response.usage?.prompt_tokens ?? 0
      totalOutputTokens += response.usage?.completion_tokens ?? 0
    }

    const finalContent = response.choices[0]?.message?.content ?? ""
    newMessages.push({ role: "assistant", content: finalContent })

    await ctx.runMutation(internal.threads.appendMessages, {
      threadId,
      messages: newMessages,
    })

    const durationMs = Date.now() - startTime

    const executedToolCalls = newMessages
      .filter(m => m.role === "tool")
      .map(m => {
        const assistantMsg = newMessages.find(
          am => am.role === "assistant" && am.toolCalls?.some(tc => tc.id === m.toolCallId)
        )
        const toolCall = assistantMsg?.toolCalls?.find(tc => tc.id === m.toolCallId)
        return toolCall ? {
          name: toolCall.name,
          arguments: toolCall.arguments,
          result: JSON.parse(m.content),
        } : null
      })
      .filter((tc): tc is { name: string; arguments: Record<string, unknown>; result: unknown } => tc !== null)

    await ctx.runMutation(internal.executions.record, {
      organizationId: auth.organizationId,
      agentId: args.agentId,
      threadId,
      environment,
      inputMessage: args.message,
      outputMessage: finalContent,
      toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs,
      status: "success",
    })

    return {
      threadId,
      message: finalContent,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    }
  },
})

export const chatBySlug = internalAction({
  args: {
    apiKey: v.string(),
    slug: v.string(),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
    externalThreadId: v.optional(v.string()),
  },
  returns: v.object({
    message: v.string(),
    threadId: v.id("threads"),
    usage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<ChatResponse> => {
    const keyHash = await hashApiKey(args.apiKey)
    const auth: ApiKeyAuth | null = await ctx.runQuery(internal.agent.validateApiKey, { keyHash })

    if (!auth) {
      throw new Error("Invalid API key")
    }

    const agent = await ctx.runQuery(internal.agent.getAgentBySlugInternal, {
      slug: args.slug,
      organizationId: auth.organizationId,
    }) as { _id: Id<"agents"> } | null

    if (!agent) {
      throw new Error("Agent not found")
    }

    return await ctx.runAction(internal.agent.chat, {
      apiKey: args.apiKey,
      agentId: agent._id,
      message: args.message,
      threadId: args.threadId,
      externalThreadId: args.externalThreadId,
    })
  },
})

export const chatAuthenticated = internalAction({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    agentId: v.id("agents"),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
    environment: v.optional(environmentValidator),
  },
  returns: v.object({
    message: v.string(),
    threadId: v.id("threads"),
    usage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<ChatResponse> => {
    const startTime = Date.now()
    const environment: Environment = args.environment ?? "development"

    const agent = await ctx.runQuery(internal.agent.getAgentInternal, {
      agentId: args.agentId,
      organizationId: args.organizationId,
    })

    if (!agent) {
      throw new Error("Agent not found")
    }

    const config = await ctx.runQuery(internal.agents.getActiveConfig, {
      agentId: args.agentId,
      environment,
    })

    const threadId: Id<"threads"> = args.threadId ?? await ctx.runMutation(internal.threads.getOrCreate, {
      organizationId: args.organizationId,
      agentId: args.agentId,
      userId: args.userId,
      environment,
    })

    const existingMessages = await ctx.runQuery(internal.agent.getThreadMessages, {
      threadId,
    })

    const thread = await ctx.runQuery(internal.threads.getThreadInternal, { threadId })

    const actor: ActorContext = await ctx.runQuery(internal.agent.buildActorContextForAgent, {
      organizationId: args.organizationId,
      actorType: "user",
      actorId: args.userId as unknown as string,
      environment,
    })

    const [organization, entityTypesRaw, rolesRaw] = await Promise.all([
      ctx.runQuery(internal.organizations.getInternal, { organizationId: args.organizationId }),
      ctx.runQuery(internal.entityTypes.listInternal, { organizationId: args.organizationId, environment }),
      ctx.runQuery(internal.roles.listInternal, { organizationId: args.organizationId, environment }),
    ])

    const now = Date.now()
    const currentTimeStr = new Date(now).toISOString()

    const entityTypes: EntityTypeContext[] = (entityTypesRaw || []).map((et: { name: string; slug: string; description?: string; schema: Record<string, unknown>; searchFields?: string[] }) => ({
      name: et.name,
      slug: et.slug,
      description: et.description,
      schema: et.schema as Record<string, unknown>,
      searchFields: et.searchFields,
    }))

    const roles = (rolesRaw || []).map((r: { name: string; description?: string }) => ({
      name: r.name,
      description: r.description,
    }))

    const templateContext: TemplateContext = {
      organizationId: args.organizationId,
      organizationName: organization?.name ?? "Unknown Organization",
      userId: args.userId as unknown as Id<"users">,
      threadId,
      agentId: args.agentId,
      actor,
      agent: { name: agent.name, slug: agent.slug },
      agentName: agent.name,
      thread: { metadata: thread?.metadata as Record<string, unknown> | undefined },
      message: args.message,
      timestamp: now,
      datetime: currentTimeStr,
      currentTime: currentTimeStr,
      entityTypes,
      roles,
    }

    const toolExecutor: ToolExecutor = {
      executeBuiltin: async (name, toolArgs) => {
        const toolIdentity = await ctx.runQuery(
          internal.permissions.getToolIdentityQuery,
          { actor: serializeActor(actor), agentId: args.agentId, toolName: name }
        )
        return executeBuiltinTool(ctx, {
          organizationId: toolIdentity.organizationId,
          actorId: toolIdentity.actorId,
          actorType: toolIdentity.actorType,
          isOrgAdmin: toolIdentity.isOrgAdmin,
          environment,
          toolName: name,
          args: toolArgs,
        })
      },
      executeCustom: (handlerCode, toolArgs) =>
        ctx.runAction(internal.agent.executeCustomTool, {
          handlerCode,
          args: toolArgs,
          context: {
            organizationId: actor.organizationId,
            actorId: actor.actorId,
            actorType: actor.actorType,
          },
        }),
    }

    const processedSystemPrompt = await processTemplates(
      config.systemPrompt,
      templateContext,
      config.tools,
      toolExecutor,
      ctx.runQuery
    )

    const messages: Message[] = [
      { role: "system", content: processedSystemPrompt },
      ...existingMessages.map((m: { role: string; content: string; toolCalls?: unknown; toolCallId?: string }) => ({
        role: m.role as Message["role"],
        content: m.content,
        toolCalls: m.toolCalls as ToolCall[] | undefined,
        toolCallId: m.toolCallId,
      })),
      { role: "user", content: args.message },
    ]

    const llmMessages = messages.map((m) => {
      if (m.role === "assistant" && m.toolCalls) {
        return {
          role: m.role,
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        }
      }
      if (m.role === "tool") {
        return {
          role: m.role,
          content: m.content,
          tool_call_id: m.toolCallId,
        }
      }
      return { role: m.role, content: m.content }
    })

    const tools = config.tools.map((t: ToolConfig) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

    let response = await callLLM({
      model: config.model,
      messages: llmMessages,
      tools: tools.length > 0 ? tools : undefined,
    })

    let totalInputTokens = response.usage?.prompt_tokens ?? 0
    let totalOutputTokens = response.usage?.completion_tokens ?? 0

    const newMessages: Message[] = [{ role: "user", content: args.message }]

    let iterations = 0
    const maxIterations = 10

    while (response.choices[0]?.message?.tool_calls && iterations < maxIterations) {
      iterations++

      const assistantMessage = response.choices[0].message
      const toolCalls: ToolCall[] = (assistantMessage.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }))

      newMessages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        toolCalls,
      })

      for (const tc of toolCalls) {
        const toolConfig = config.tools.find((t: ToolConfig) => t.name === tc.name)
        if (!toolConfig) {
          newMessages.push({
            role: "tool",
            content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
            toolCallId: tc.id,
          })
          continue
        }

        const permissionResult = await ctx.runQuery(
          internal.permissions.canUseToolQuery,
          { actor: serializeActor(actor), agentId: args.agentId, toolName: tc.name }
        )

        if (!permissionResult.allowed) {
          newMessages.push({
            role: "tool",
            content: JSON.stringify({ error: `Permission denied: ${permissionResult.reason}` }),
            toolCallId: tc.id,
          })
          continue
        }

        try {
          const toolIdentity = await ctx.runQuery(
            internal.permissions.getToolIdentityQuery,
            { actor: serializeActor(actor), agentId: args.agentId, toolName: tc.name }
          )

          let result: unknown

          if (toolConfig.isBuiltin) {
            result = await executeBuiltinTool(ctx, {
              organizationId: toolIdentity.organizationId,
              actorId: toolIdentity.actorId,
              actorType: toolIdentity.actorType,
              isOrgAdmin: toolIdentity.isOrgAdmin,
              environment,
              toolName: tc.name,
              args: tc.arguments,
            })
          } else if (toolConfig.handlerCode) {
            result = await ctx.runAction(internal.agent.executeCustomTool, {
              handlerCode: toolConfig.handlerCode,
              args: tc.arguments,
              context: {
                organizationId: toolIdentity.organizationId,
                actorId: toolIdentity.actorId,
                actorType: toolIdentity.actorType,
              },
            })
          } else {
            result = { error: "Tool has no handler" }
          }

          newMessages.push({
            role: "tool",
            content: JSON.stringify(result),
            toolCallId: tc.id,
          })
        } catch (error) {
          newMessages.push({
            role: "tool",
            content: JSON.stringify({
              error: error instanceof Error ? error.message : "Tool execution failed",
            }),
            toolCallId: tc.id,
          })
        }
      }

      const updatedMessages = [
        ...llmMessages,
        ...newMessages.map((m) => {
          if (m.role === "assistant" && m.toolCalls) {
            return {
              role: m.role,
              content: m.content,
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            }
          }
          if (m.role === "tool") {
            return {
              role: m.role,
              content: m.content,
              tool_call_id: m.toolCallId,
            }
          }
          return { role: m.role, content: m.content }
        }),
      ]

      response = await callLLM({
        model: config.model,
        messages: updatedMessages,
        tools: tools.length > 0 ? tools : undefined,
      })

      totalInputTokens += response.usage?.prompt_tokens ?? 0
      totalOutputTokens += response.usage?.completion_tokens ?? 0
    }

    const finalContent = response.choices[0]?.message?.content ?? ""
    newMessages.push({ role: "assistant", content: finalContent })

    await ctx.runMutation(internal.threads.appendMessages, {
      threadId,
      messages: newMessages,
    })

    const durationMs = Date.now() - startTime

    const executedToolCalls = newMessages
      .filter(m => m.role === "tool")
      .map(m => {
        const assistantMsg = newMessages.find(
          am => am.role === "assistant" && am.toolCalls?.some(tc => tc.id === m.toolCallId)
        )
        const toolCall = assistantMsg?.toolCalls?.find(tc => tc.id === m.toolCallId)
        return toolCall ? {
          name: toolCall.name,
          arguments: toolCall.arguments,
          result: JSON.parse(m.content),
        } : null
      })
      .filter((tc): tc is { name: string; arguments: Record<string, unknown>; result: unknown } => tc !== null)

    await ctx.runMutation(internal.executions.record, {
      organizationId: args.organizationId,
      agentId: args.agentId,
      threadId,
      environment,
      inputMessage: args.message,
      outputMessage: finalContent,
      toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs,
      status: "success",
    })

    return {
      threadId,
      message: finalContent,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    }
  },
})

export const buildActorContextForAgent = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    actorType: v.string(),
    actorId: v.string(),
    environment: environmentValidator,
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("webhook")
    ),
    actorId: v.string(),
    roleIds: v.array(v.id("roles")),
    isOrgAdmin: v.optional(v.boolean()),
    environment: environmentValidator,
  }),
  handler: async (ctx, args): Promise<ActorContext> => {
    const { organizationId, actorType, actorId, environment } = args

    let roleIds: Id<"roles">[] = []
    let isOrgAdmin = false

    if (actorType === "user") {
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_org", (q) =>
          q.eq("userId", actorId as Id<"users">).eq("organizationId", organizationId)
        )
        .first()

      if (membership && (membership.role === "owner" || membership.role === "admin")) {
        isOrgAdmin = true
      }

      const userRoles = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", actorId as Id<"users">))
        .filter((q) =>
          q.or(
            q.eq(q.field("expiresAt"), undefined),
            q.gt(q.field("expiresAt"), Date.now())
          )
        )
        .collect()

      const validRoleIds: Id<"roles">[] = []
      for (const ur of userRoles) {
        const role = await ctx.db.get(ur.roleId)
        if (role && role.organizationId === organizationId && role.environment === environment) {
          validRoleIds.push(ur.roleId)
        }
      }
      roleIds = validRoleIds
    } else if (actorType === "system") {
      isOrgAdmin = true
      const systemRoles = await ctx.db
        .query("roles")
        .withIndex("by_org_isSystem", (q) =>
          q.eq("organizationId", organizationId).eq("isSystem", true)
        )
        .collect()
      const systemRole = systemRoles.find((r) => r.environment === environment)

      if (systemRole) {
        roleIds = [systemRole._id]
      }
    } else if (actorType === "agent") {
      const agentRole = await ctx.db
        .query("roles")
        .withIndex("by_org_env_name", (q) =>
          q.eq("organizationId", organizationId).eq("environment", environment).eq("name", "agent")
        )
        .first()

      if (agentRole) {
        roleIds = [agentRole._id]
      }
    }

    return {
      organizationId,
      actorType: actorType as ActorType,
      actorId,
      roleIds,
      isOrgAdmin,
      environment,
    }
  },
})

export const validateApiKey = internalQuery({
  args: { keyHash: v.string() },
  returns: v.union(
    v.object({
      organizationId: v.id("organizations"),
      keyPrefix: v.string(),
      permissions: v.array(v.string()),
      environment: environmentValidator,
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first()

    if (!apiKey) {
      return null
    }

    if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
      return null
    }

    return {
      organizationId: apiKey.organizationId,
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      environment: apiKey.environment as Environment,
    }
  },
})

export const getAgentInternal = internalQuery({
  args: {
    agentId: v.id("agents"),
    organizationId: v.id("organizations"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId)

    if (!agent || agent.organizationId !== args.organizationId) {
      return null
    }

    return agent
  },
})

export const getAgentBySlugInternal = internalQuery({
  args: {
    slug: v.string(),
    organizationId: v.id("organizations"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.slug)
      )
      .first()
  },
})

export const getThreadMessages = internalQuery({
  args: { threadId: v.id("threads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect()
  },
})

export const executeCustomTool = internalAction({
  args: {
    handlerCode: v.string(),
    args: v.any(),
    context: v.optional(
      v.object({
        organizationId: v.id("organizations"),
        actorId: v.string(),
        actorType: v.string(),
      })
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const toolExecutorUrl = process.env.TOOL_EXECUTOR_URL
    const toolExecutorSecret = process.env.TOOL_EXECUTOR_SECRET

    if (!toolExecutorUrl || !toolExecutorSecret) {
      throw new Error("Tool executor not configured")
    }

    const response = await fetch(`${toolExecutorUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${toolExecutorSecret}`,
      },
      body: JSON.stringify({
        handlerCode: args.handlerCode,
        args: args.args,
        context: args.context ?? {},
      }),
    })

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.statusText}`)
    }

    const result = await response.json()
    return result.result
  },
})

async function executeBuiltinTool(
  ctx: any,
  params: {
    organizationId: Id<"organizations">
    actorId: string
    actorType: ActorType
    isOrgAdmin?: boolean
    environment: Environment
    toolName: string
    args: Record<string, unknown>
  }
): Promise<unknown> {
  const { organizationId, actorId, actorType, isOrgAdmin, environment, toolName, args } = params

  switch (toolName) {
    case "entity.create":
      if (!args.type) throw new Error("entity.create requires 'type' parameter")
      if (!args.data) throw new Error("entity.create requires 'data' parameter")
      return await ctx.runMutation(internal.tools.entities.entityCreate, {
        organizationId,
        actorId,
        actorType,
        environment,
        type: args.type as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.get":
      if (!args.id) throw new Error("entity.get requires 'id' parameter")
      return await ctx.runQuery(internal.tools.entities.entityGet, {
        organizationId,
        actorId,
        actorType,
        environment,
        id: args.id as string,
      })

    case "entity.query":
      if (!args.type) throw new Error("entity.query requires 'type' parameter")
      return await ctx.runQuery(internal.tools.entities.entityQuery, {
        organizationId,
        actorId,
        actorType,
        environment,
        type: args.type as string,
        filters: args.filters,
        status: args.status as string | undefined,
        limit: args.limit as number | undefined,
      })

    case "entity.update":
      if (!args.id) throw new Error("entity.update requires 'id' parameter")
      if (!args.data) throw new Error("entity.update requires 'data' parameter")
      return await ctx.runMutation(internal.tools.entities.entityUpdate, {
        organizationId,
        actorId,
        actorType,
        environment,
        id: args.id as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.delete":
      if (!args.id) throw new Error("entity.delete requires 'id' parameter")
      return await ctx.runMutation(internal.tools.entities.entityDelete, {
        organizationId,
        actorId,
        actorType,
        environment,
        id: args.id as string,
      })

    case "entity.link":
      if (!args.fromId) throw new Error("entity.link requires 'fromId' parameter")
      if (!args.toId) throw new Error("entity.link requires 'toId' parameter")
      if (!args.relationType) throw new Error("entity.link requires 'relationType' parameter")
      return await ctx.runMutation(internal.tools.entities.entityLink, {
        organizationId,
        actorId,
        actorType,
        environment,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
        metadata: args.metadata,
      })

    case "entity.unlink":
      if (!args.fromId) throw new Error("entity.unlink requires 'fromId' parameter")
      if (!args.toId) throw new Error("entity.unlink requires 'toId' parameter")
      if (!args.relationType) throw new Error("entity.unlink requires 'relationType' parameter")
      return await ctx.runMutation(internal.tools.entities.entityUnlink, {
        organizationId,
        actorId,
        actorType,
        environment,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
      })

    case "event.emit":
      if (!args.eventType) throw new Error("event.emit requires 'eventType' parameter")
      return await ctx.runMutation(internal.tools.events.eventEmit, {
        organizationId,
        actorId,
        actorType,
        environment,
        entityId: args.entityId as string | undefined,
        entityTypeSlug: args.entityTypeSlug as string | undefined,
        eventType: args.eventType as string,
        payload: args.payload,
      })

    case "event.query":
      return await ctx.runQuery(internal.tools.events.eventQuery, {
        organizationId,
        environment,
        entityId: args.entityId as string | undefined,
        eventType: args.eventType as string | undefined,
        since: args.since as number | undefined,
        limit: args.limit as number | undefined,
      })

    case "job.enqueue":
      if (!args.jobType) throw new Error("job.enqueue requires 'jobType' parameter")
      return await ctx.runMutation(internal.tools.jobs.jobEnqueue, {
        organizationId,
        actorId,
        actorType,
        environment,
        jobType: args.jobType as string,
        payload: args.payload,
        scheduledFor: args.scheduledFor as number | undefined,
        priority: args.priority as number | undefined,
        maxAttempts: args.maxAttempts as number | undefined,
        idempotencyKey: args.idempotencyKey as string | undefined,
        entityId: args.entityId as string | undefined,
      })

    case "job.status":
      if (!args.id) throw new Error("job.status requires 'id' parameter")
      return await ctx.runQuery(internal.tools.jobs.jobStatus, {
        organizationId,
        id: args.id as string,
      })

    default:
      throw new Error(`Unknown builtin tool: ${toolName}`)
  }
}

const BUILTIN_PREFIXES = ["entity", "event", "job"]

function toApiToolName(name: string): string {
  return name.replace(/\./g, "_")
}

function fromApiToolName(name: string): string {
  for (const prefix of BUILTIN_PREFIXES) {
    if (name.startsWith(`${prefix}_`)) {
      return name.replace(`${prefix}_`, `${prefix}.`)
    }
  }
  return name
}

async function callLLM(params: {
  model: { provider: string; name: string; temperature?: number; maxTokens?: number }
  messages: Array<{ role: string; content: string; [key: string]: unknown }>
  tools?: Array<{
    type: "function"
    function: { name: string; description: string; parameters: unknown }
  }>
}): Promise<{
  choices: Array<{
    message: {
      role: string
      content: string | null
      tool_calls?: Array<{
        id: string
        type: "function"
        function: { name: string; arguments: string }
      }>
    }
  }>
  usage?: { prompt_tokens: number; completion_tokens: number }
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured")
  }

  const anthropicMessages = params.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: m.tool_call_id,
              content: m.content,
            },
          ],
        }
      }
      if (m.role === "assistant" && m.tool_calls) {
        return {
          role: "assistant",
          content: [
            ...(m.content ? [{ type: "text", text: m.content }] : []),
            ...((m.tool_calls as any[]) || []).map((tc: any) => ({
              type: "tool_use",
              id: tc.id,
              name: toApiToolName(tc.function.name),
              input: JSON.parse(tc.function.arguments),
            })),
          ],
        }
      }
      return { role: m.role, content: m.content }
    })

  const systemMessage = params.messages.find((m) => m.role === "system")

  const anthropicTools = params.tools?.map((t) => ({
    name: toApiToolName(t.function.name),
    description: t.function.description,
    input_schema: t.function.parameters,
  }))

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model.name,
      max_tokens: params.model.maxTokens ?? 4096,
      system: systemMessage?.content,
      messages: anthropicMessages,
      tools: anthropicTools,
      temperature: params.model.temperature ?? 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${error}`)
  }

  const result = await response.json()

  const toolCalls = result.content
    .filter((c: any) => c.type === "tool_use")
    .map((c: any) => ({
      id: c.id,
      type: "function",
      function: {
        name: fromApiToolName(c.name),
        arguments: JSON.stringify(c.input),
      },
    }))

  const textContent = result.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("")

  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      },
    ],
    usage: {
      prompt_tokens: result.usage?.input_tokens ?? 0,
      completion_tokens: result.usage?.output_tokens ?? 0,
    },
  }
}
