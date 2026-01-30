import { v } from "convex/values"
import { internalAction, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { hashApiKey } from "./lib/utils"

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

export const chat = internalAction({
  args: {
    apiKey: v.string(),
    agentId: v.id("agents"),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
    externalThreadId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ChatResponse> => {
    const startTime = Date.now()

    const keyHash = await hashApiKey(args.apiKey)
    const auth: ApiKeyAuth | null = await ctx.runQuery(internal.agent.validateApiKey, { keyHash })

    if (!auth) {
      throw new Error("Invalid API key")
    }

    const agent = await ctx.runQuery(internal.agent.getAgentInternal, {
      agentId: args.agentId,
      organizationId: auth.organizationId,
    })

    if (!agent) {
      throw new Error("Agent not found")
    }

    const config = await ctx.runQuery(internal.agents.getActiveConfig, {
      agentId: args.agentId,
      environment: "production",
    })

    let threadId = args.threadId

    if (!threadId) {
      threadId = await ctx.runMutation(internal.threads.getOrCreate, {
        organizationId: auth.organizationId,
        agentId: args.agentId,
        externalId: args.externalThreadId,
      })
    }

    const existingMessages = await ctx.runQuery(internal.agent.getThreadMessages, {
      threadId,
    })

    const messages: Message[] = [
      { role: "system", content: config.systemPrompt },
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

    const tools = config.tools.map((t: { name: string; description: string; parameters: unknown }) => ({
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
        const toolConfig = config.tools.find((t: { name: string }) => t.name === tc.name)
        if (!toolConfig) {
          newMessages.push({
            role: "tool",
            content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
            toolCallId: tc.id,
          })
          continue
        }

        try {
          let result: unknown

          if (toolConfig.isBuiltin) {
            result = await executeBuiltinTool(ctx, {
              organizationId: auth.organizationId,
              actorId: `apikey:${auth.keyPrefix}`,
              actorType: "agent",
              toolName: tc.name,
              args: tc.arguments,
            })
          } else if (toolConfig.handlerCode) {
            result = await ctx.runAction(internal.agent.executeCustomTool, {
              handlerCode: toolConfig.handlerCode,
              args: tc.arguments,
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

    await ctx.runMutation(internal.executions.record, {
      organizationId: auth.organizationId,
      agentId: args.agentId,
      threadId,
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

export const validateApiKey = internalQuery({
  args: { keyHash: v.string() },
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
    }
  },
})

export const getAgentInternal = internalQuery({
  args: {
    agentId: v.id("agents"),
    organizationId: v.id("organizations"),
  },
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
  },
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
    actorType: "user" | "agent" | "system" | "webhook"
    toolName: string
    args: Record<string, unknown>
  }
): Promise<unknown> {
  const { organizationId, actorId, actorType, toolName, args } = params

  switch (toolName) {
    case "entity.create":
      return await ctx.runMutation(internal.tools.entities.entityCreate, {
        organizationId,
        actorId,
        actorType,
        type: args.type as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.get":
      return await ctx.runMutation(internal.tools.entities.entityGet, {
        organizationId,
        id: args.id as string,
      })

    case "entity.query":
      return await ctx.runMutation(internal.tools.entities.entityQuery, {
        organizationId,
        type: args.type as string,
        filters: args.filters,
        status: args.status as string | undefined,
        limit: args.limit as number | undefined,
      })

    case "entity.update":
      return await ctx.runMutation(internal.tools.entities.entityUpdate, {
        organizationId,
        actorId,
        actorType,
        id: args.id as string,
        data: args.data,
        status: args.status as string | undefined,
      })

    case "entity.delete":
      return await ctx.runMutation(internal.tools.entities.entityDelete, {
        organizationId,
        actorId,
        actorType,
        id: args.id as string,
      })

    case "entity.link":
      return await ctx.runMutation(internal.tools.entities.entityLink, {
        organizationId,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
        metadata: args.metadata,
      })

    case "entity.unlink":
      return await ctx.runMutation(internal.tools.entities.entityUnlink, {
        organizationId,
        fromId: args.fromId as string,
        toId: args.toId as string,
        relationType: args.relationType as string,
      })

    case "event.emit":
      return await ctx.runMutation(internal.tools.events.eventEmit, {
        organizationId,
        actorId,
        actorType,
        entityId: args.entityId as string | undefined,
        entityTypeSlug: args.entityTypeSlug as string | undefined,
        eventType: args.eventType as string,
        payload: args.payload,
      })

    case "event.query":
      return await ctx.runQuery(internal.tools.events.eventQuery, {
        organizationId,
        entityId: args.entityId as string | undefined,
        eventType: args.eventType as string | undefined,
        since: args.since as number | undefined,
        limit: args.limit as number | undefined,
      })

    case "job.enqueue":
      return await ctx.runMutation(internal.tools.jobs.jobEnqueue, {
        organizationId,
        jobType: args.jobType as string,
        payload: args.payload,
        scheduledFor: args.scheduledFor as number | undefined,
        priority: args.priority as number | undefined,
        maxAttempts: args.maxAttempts as number | undefined,
        idempotencyKey: args.idempotencyKey as string | undefined,
        entityId: args.entityId as string | undefined,
      })

    case "job.status":
      return await ctx.runQuery(internal.tools.jobs.jobStatus, {
        organizationId,
        id: args.id as string,
      })

    default:
      throw new Error(`Unknown builtin tool: ${toolName}`)
  }
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
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments),
            })),
          ],
        }
      }
      return { role: m.role, content: m.content }
    })

  const systemMessage = params.messages.find((m) => m.role === "system")

  const anthropicTools = params.tools?.map((t) => ({
    name: t.function.name,
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
        name: c.name,
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
