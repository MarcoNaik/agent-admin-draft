import { v } from "convex/values"
import { internalAction, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { hashApiKey, generateId } from "./lib/utils"
import { calculateCost } from "./lib/creditPricing"
import { processTemplates, TemplateContext, ToolExecutor, EntityTypeContext } from "./lib/templateEngine"
import { ActorContext, ActorType, Environment } from "./lib/permissions/types"
import { generateText, tool, jsonSchema, stepCountIs } from "ai"
import { createModel, sanitizeToolName, desanitizeToolName, toAIMessages, fromSteps } from "./lib/llm"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

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

interface ExecuteChatParams {
  ctx: any
  organizationId: Id<"organizations">
  agentId: Id<"agents">
  message: string
  threadId: Id<"threads">
  environment: Environment
  actor: ActorContext
  agent: { name: string; slug: string }
  config: any
  thread: any
  userId?: Id<"users">
  conversationId?: string
  depth?: number
  evalRunId?: Id<"evalRuns">
}

async function executeChat(params: ExecuteChatParams): Promise<ChatResponse> {
  const { ctx, organizationId, agentId, message, threadId, environment, actor, agent, config, thread, userId } = params
  const conversationId = params.conversationId ?? generateId("conv")
  const depth = params.depth ?? 0
  const startTime = Date.now()

  const existingMessages = await ctx.runQuery(internal.agent.getThreadMessages, { threadId })

  const [organization, entityTypesRaw, rolesRaw] = await Promise.all([
    ctx.runQuery(internal.organizations.getInternal, { organizationId }),
    ctx.runQuery(internal.entityTypes.listInternal, { organizationId, environment }),
    ctx.runQuery(internal.roles.listInternal, { organizationId, environment }),
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
    organizationId,
    organizationName: organization?.name ?? "Unknown Organization",
    userId,
    threadId,
    agentId,
    actor,
    agent: { name: agent.name, slug: agent.slug },
    agentName: agent.name,
    thread: { metadata: thread?.metadata as Record<string, unknown> | undefined },
    message,
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
        { actor: serializeActor(actor), agentId, toolName: name }
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
    executeCustom: (toolName, toolArgs) =>
      ctx.runAction(internal.agent.executeCustomTool, {
        toolName,
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

  const historyMessages: Message[] = existingMessages.map((m: { role: string; content: string; toolCalls?: unknown; toolCallId?: string }) => ({
    role: m.role as Message["role"],
    content: m.content,
    toolCalls: m.toolCalls as ToolCall[] | undefined,
    toolCallId: m.toolCallId,
  }))

  const aiTools: Record<string, any> = {}
  for (const t of config.tools as ToolConfig[]) {
    const sanitized = sanitizeToolName(t.name)
    aiTools[sanitized] = tool<Record<string, unknown>, unknown>({
      description: t.description,
      inputSchema: jsonSchema<Record<string, unknown>>(t.parameters as any),
      execute: async (args) => {
        const originalName = desanitizeToolName(sanitized)
        const toolConfig = config.tools.find((tc: ToolConfig) => tc.name === originalName)

        const permissionResult = await ctx.runQuery(
          internal.permissions.canUseToolQuery,
          { actor: serializeActor(actor), agentId, toolName: originalName }
        )

        if (!permissionResult.allowed) {
          return { error: `Permission denied: ${permissionResult.reason}` }
        }

        try {
          const toolIdentity = await ctx.runQuery(
            internal.permissions.getToolIdentityQuery,
            { actor: serializeActor(actor), agentId, toolName: originalName }
          )

          if (toolConfig?.isBuiltin) {
            return await executeBuiltinTool(ctx, {
              organizationId: toolIdentity.organizationId,
              actorId: toolIdentity.actorId,
              actorType: toolIdentity.actorType,
              isOrgAdmin: toolIdentity.isOrgAdmin,
              environment,
              toolName: originalName,
              args,
              conversationId,
              depth,
              callerAgentSlug: agent.slug,
            })
          } else if (toolConfig?.handlerCode) {
            return await ctx.runAction(internal.agent.executeCustomTool, {
              toolName: originalName,
              args,
              context: {
                organizationId: toolIdentity.organizationId,
                actorId: toolIdentity.actorId,
                actorType: toolIdentity.actorType,
              },
            })
          }

          return { error: "Tool has no handler" }
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Tool execution failed" }
        }
      },
    })
  }

  const providerKey = await ctx.runQuery(internal.providers.resolveApiKey, {
    organizationId,
    provider: config.model.provider,
  })

  const usedPlatformKey = providerKey === null
  if (usedPlatformKey) {
    const balance = await ctx.runQuery(internal.billing.getBalanceInternal, { organizationId })
    if (balance <= 0) {
      throw new Error("Insufficient credits. Please add credits to your account to continue using platform API keys.")
    }
  }

  const result = await generateText({
    model: createModel(config.model, providerKey?.apiKey),
    system: processedSystemPrompt,
    messages: toAIMessages([
      ...historyMessages,
      { role: "user", content: message },
    ]),
    tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
    stopWhen: stepCountIs(10),
    maxRetries: 2,
    temperature: config.model.temperature ?? 0.7,
    maxOutputTokens: config.model.maxTokens ?? 4096,
  })

  const stepsMessages = fromSteps(result.steps as any)
  const finalContent = result.text ?? ""

  const lastMsg = stepsMessages[stepsMessages.length - 1]
  const lastIsTextOnly = lastMsg?.role === "assistant" && !lastMsg.toolCalls?.length

  const newMessages: Message[] = [
    { role: "user", content: message },
    ...stepsMessages,
  ]

  if (!lastIsTextOnly) {
    newMessages.push({ role: "assistant", content: finalContent })
  }

  await ctx.runMutation(internal.threads.appendMessages, {
    threadId,
    messages: newMessages,
  })

  const durationMs = Date.now() - startTime
  const totalInputTokens = result.totalUsage.inputTokens ?? 0
  const totalOutputTokens = result.totalUsage.outputTokens ?? 0

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

  const creditsConsumed = usedPlatformKey ? calculateCost(config.model.name, totalInputTokens, totalOutputTokens) : 0

  const executionId = await ctx.runMutation(internal.executions.record, {
    organizationId,
    agentId,
    threadId,
    environment,
    conversationId,
    inputMessage: message,
    outputMessage: finalContent,
    toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    durationMs,
    model: config.model.name,
    status: "success",
    usedPlatformKey,
    creditsConsumed,
    evalRunId: params.evalRunId,
  })

  if (usedPlatformKey && creditsConsumed > 0) {
    await ctx.runMutation(internal.billing.deductCredits, {
      organizationId,
      amount: creditsConsumed,
      description: `${config.model.name} — ${totalInputTokens} in / ${totalOutputTokens} out`,
      executionId,
      metadata: {
        model: config.model.name,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    })
  }

  return {
    threadId,
    message: finalContent,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
    },
  }
}

export const executeChatAction = internalAction({
  args: {
    organizationId: v.id("organizations"),
    agentId: v.id("agents"),
    message: v.string(),
    threadId: v.id("threads"),
    environment: environmentValidator,
    actor: v.object({
      organizationId: v.id("organizations"),
      actorType: v.union(v.literal("user"), v.literal("agent"), v.literal("system"), v.literal("webhook")),
      actorId: v.string(),
      roleIds: v.array(v.id("roles")),
      isOrgAdmin: v.optional(v.boolean()),
      environment: environmentValidator,
    }),
    agent: v.object({ name: v.string(), slug: v.string() }),
    config: v.any(),
    thread: v.any(),
    userId: v.optional(v.id("users")),
    conversationId: v.optional(v.string()),
    depth: v.optional(v.number()),
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
    return executeChat({
      ctx,
      organizationId: args.organizationId,
      agentId: args.agentId,
      message: args.message,
      threadId: args.threadId,
      environment: args.environment,
      actor: args.actor as ActorContext,
      agent: args.agent,
      config: args.config,
      thread: args.thread,
      userId: args.userId,
      conversationId: args.conversationId,
      depth: args.depth,
    })
  },
})

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

    const thread = await ctx.runQuery(internal.threads.getThreadInternal, { threadId })

    const actor: ActorContext = await ctx.runQuery(internal.agent.buildActorContextForAgent, {
      organizationId: auth.organizationId,
      actorType: "agent",
      actorId: `apikey:${auth.keyPrefix}`,
      environment,
    })

    return executeChat({
      ctx,
      organizationId: auth.organizationId,
      agentId: args.agentId,
      message: args.message,
      threadId,
      environment,
      actor,
      agent: { name: agent.name, slug: agent.slug },
      config,
      thread,
    })
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
    userId: v.optional(v.id("users")),
    agentId: v.id("agents"),
    message: v.string(),
    threadId: v.optional(v.id("threads")),
    environment: v.optional(environmentValidator),
    evalRunId: v.optional(v.id("evalRuns")),
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

    const thread = await ctx.runQuery(internal.threads.getThreadInternal, { threadId })

    const actorType = args.userId ? "user" : "system"
    const actorId = args.userId ? (args.userId as unknown as string) : `agent:${args.agentId}`

    const actor: ActorContext = await ctx.runQuery(internal.agent.buildActorContextForAgent, {
      organizationId: args.organizationId,
      actorType,
      actorId,
      environment,
    })

    return executeChat({
      ctx,
      organizationId: args.organizationId,
      agentId: args.agentId,
      message: args.message,
      threadId,
      environment,
      actor,
      agent: { name: agent.name, slug: agent.slug },
      config,
      thread,
      userId: args.userId,
      evalRunId: args.evalRunId,
    })
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

      if (membership && membership.role === "admin") {
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
    toolName: v.string(),
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
    const allowedDomains = [
      "api.openai.com",
      "api.anthropic.com",
      "api.stripe.com",
      "api.sendgrid.com",
      "api.twilio.com",
      "hooks.slack.com",
      "discord.com",
      "api.github.com",
    ]

    const sandboxedFetch = async (url: string, options?: RequestInit) => {
      const urlObj = new URL(url)
      const isAllowed = allowedDomains.some(
        (domain) =>
          urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      )
      if (!isAllowed) {
        throw new Error(
          `Fetch to ${urlObj.hostname} is not allowed. Allowed domains: ${allowedDomains.join(", ")}`
        )
      }
      return fetch(url, options)
    }

    const toolContext = args.context ?? {}
    const toolArgs = args.args as Record<string, any>
    const handler = customToolHandlers[args.toolName]

    if (!handler) {
      throw new Error(`Unknown custom tool: ${args.toolName}`)
    }

    return await handler(toolArgs, toolContext, sandboxedFetch)
  },
})

const customToolHandlers: Record<string, (args: any, context: any, fetch: (url: string, options?: RequestInit) => Promise<Response>) => Promise<any>> = {
  send_whatsapp_message: async (args, context, fetch) => {
    const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: `whatsapp:${args.to}`,
        body: args.body,
        templateName: args.templateName,
        organizationId: context.organizationId,
      }),
    })
    return await response.json()
  },

  generate_flow_payment_link: async (args, context, fetch) => {
    return {
      method: "bank_transfer",
      bankDetails: {
        name: "Educaland Spa",
        rut: "77.528.846-9",
        bank: "Banco Crédito e Inversión (BCI)",
        account: "Cta Cte 63542501",
        email: "Educalandspa@gmail.com",
      },
      amount: args.amount,
      description: args.description,
      referenceEmail: args.email,
      paymentId: args.paymentId,
    }
  },

  notify_admin: async (args, context, fetch) => {
    const response = await fetch("https://hooks.slack.com/services/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[${args.type.toUpperCase()}] ${args.message}`,
        attachments: [{
          fields: [
            { title: "Guardian", value: args.guardianPhone || "N/A", short: true },
            { title: "Context", value: args.context || "N/A", short: false },
            { title: "Org", value: context.organizationId, short: true },
          ],
        }],
      }),
    })
    return { success: response.ok, status: response.status }
  },

  get_current_time: async (args, context, fetch) => {
    const timezone = args.timezone || "America/Santiago"
    const now = new Date()
    return {
      iso: now.toISOString(),
      local: now.toLocaleString("es-CL", { timeZone: timezone }),
      timezone,
      timestamp: now.getTime(),
    }
  },

  format_teacher_schedule: async (args, context, fetch) => {
    if (!args.teachers || !Array.isArray(args.teachers) || args.teachers.length === 0) {
      return { error: "REQUIRED: Pass the full teachers array from entity.query({type: 'teacher'}). Example: format_teacher_schedule({teachers: <array>, names: [\"Carolina\"]})", markdown: "", teachers: [] }
    }
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    const fmt = (h: number) => {
      const hr = Math.floor(h)
      const min = Math.round((h - hr) * 60)
      const suffix = hr >= 12 ? "PM" : "AM"
      const display = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr)
      return `${display}:${String(min).padStart(2, "0")} ${suffix}`
    }

    let filtered = args.teachers
    if (args.names && args.names.length > 0) {
      const lowerNames = args.names.map((n: string) => n.toLowerCase())
      filtered = args.teachers.filter((t: any) => {
        const tName = (t.name || (t.data && t.data.name) || "").toLowerCase()
        return lowerNames.some((n: string) => tName.includes(n) || n.includes(tName))
      })
    }

    const results = filtered.map((teacher: any) => {
      const name = teacher.name || (teacher.data && teacher.data.name) || "Unknown"
      const availability = teacher.availability || (teacher.data && teacher.data.availability)
      const id = teacher._id || teacher.id || ""
      const schedule: Record<string, string[]> = {}

      if (availability && typeof availability === "object" && !Array.isArray(availability)) {
        const keyMap: Record<string, string> = {
          monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
          thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
        }
        for (const [key, dayName] of Object.entries(keyMap)) {
          if (availability[key] && availability[key].length > 0) {
            schedule[dayName] = availability[key].map((h: number) => fmt(h))
          }
        }
      }

      let text = ""
      for (const day of dayOrder) {
        if (schedule[day] && schedule[day].length > 0) {
          text += `  ${day}: ${schedule[day].join(", ")}\n`
        }
      }

      return { name, id, formattedSchedule: text || "  No availability\n", slotsByDay: schedule }
    })

    const markdown = results.map((r: any) => `**${r.name}**\n${r.formattedSchedule}`).join("\n")
    return { markdown, teachers: results }
  },
}

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
    conversationId?: string
    depth?: number
    callerAgentSlug?: string
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
        filters: args.filters ? sanitizeFilters(args.filters) : undefined,
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

    case "calendar.list":
      if (!args.userId) throw new Error("calendar.list requires 'userId' parameter")
      if (!args.timeMin) throw new Error("calendar.list requires 'timeMin' parameter")
      if (!args.timeMax) throw new Error("calendar.list requires 'timeMax' parameter")
      return await ctx.runAction(internal.tools.calendar.calendarList, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        timeMin: args.timeMin as string,
        timeMax: args.timeMax as string,
        maxResults: args.maxResults as number | undefined,
      })

    case "calendar.create":
      if (!args.userId) throw new Error("calendar.create requires 'userId' parameter")
      if (!args.summary) throw new Error("calendar.create requires 'summary' parameter")
      if (!args.startTime) throw new Error("calendar.create requires 'startTime' parameter")
      if (!args.endTime) throw new Error("calendar.create requires 'endTime' parameter")
      return await ctx.runAction(internal.tools.calendar.calendarCreate, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        summary: args.summary as string,
        startTime: args.startTime as string,
        endTime: args.endTime as string,
        description: args.description as string | undefined,
        attendees: args.attendees as string[] | undefined,
        timeZone: args.timeZone as string | undefined,
      })

    case "calendar.update":
      if (!args.userId) throw new Error("calendar.update requires 'userId' parameter")
      if (!args.eventId) throw new Error("calendar.update requires 'eventId' parameter")
      return await ctx.runAction(internal.tools.calendar.calendarUpdate, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        eventId: args.eventId as string,
        summary: args.summary as string | undefined,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
        description: args.description as string | undefined,
        attendees: args.attendees as string[] | undefined,
        status: args.status as string | undefined,
      })

    case "calendar.delete":
      if (!args.userId) throw new Error("calendar.delete requires 'userId' parameter")
      if (!args.eventId) throw new Error("calendar.delete requires 'eventId' parameter")
      return await ctx.runAction(internal.tools.calendar.calendarDelete, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        eventId: args.eventId as string,
      })

    case "calendar.freeBusy":
      if (!args.userId) throw new Error("calendar.freeBusy requires 'userId' parameter")
      if (!args.timeMin) throw new Error("calendar.freeBusy requires 'timeMin' parameter")
      if (!args.timeMax) throw new Error("calendar.freeBusy requires 'timeMax' parameter")
      return await ctx.runAction(internal.tools.calendar.calendarFreeBusy, {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        timeMin: args.timeMin as string,
        timeMax: args.timeMax as string,
      })

    case "whatsapp.send":
      if (!args.to) throw new Error("whatsapp.send requires 'to' parameter")
      if (!args.text) throw new Error("whatsapp.send requires 'text' parameter")
      return await ctx.runAction(internal.tools.whatsapp.whatsappSend, {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        text: args.text as string,
      })

    case "whatsapp.sendTemplate":
      if (!args.to) throw new Error("whatsapp.sendTemplate requires 'to' parameter")
      if (!args.templateName) throw new Error("whatsapp.sendTemplate requires 'templateName' parameter")
      if (!args.language) throw new Error("whatsapp.sendTemplate requires 'language' parameter")
      return await ctx.runAction(internal.tools.whatsapp.whatsappSendTemplate, {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        templateName: args.templateName as string,
        language: args.language as string,
        components: args.components as any,
      })

    case "whatsapp.sendInteractive":
      if (!args.to) throw new Error("whatsapp.sendInteractive requires 'to' parameter")
      if (!args.bodyText) throw new Error("whatsapp.sendInteractive requires 'bodyText' parameter")
      if (!args.buttons) throw new Error("whatsapp.sendInteractive requires 'buttons' parameter")
      return await ctx.runAction(internal.tools.whatsapp.whatsappSendInteractive, {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        bodyText: args.bodyText as string,
        buttons: args.buttons as any,
        footerText: args.footerText as string | undefined,
      })

    case "whatsapp.sendMedia":
      if (!args.to) throw new Error("whatsapp.sendMedia requires 'to' parameter")
      if (!args.mediaUrl) throw new Error("whatsapp.sendMedia requires 'mediaUrl' parameter")
      if (!args.mediaType) throw new Error("whatsapp.sendMedia requires 'mediaType' parameter")
      return await ctx.runAction(internal.tools.whatsapp.whatsappSendMedia, {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        mediaUrl: args.mediaUrl as string,
        mediaType: args.mediaType as "image" | "audio",
        caption: args.caption as string | undefined,
      })

    case "whatsapp.listTemplates":
      return await ctx.runAction(internal.tools.whatsapp.whatsappListTemplates, {
        organizationId, actorId, actorType, environment,
      })

    case "whatsapp.getConversation":
      if (!args.phoneNumber) throw new Error("whatsapp.getConversation requires 'phoneNumber' parameter")
      return await ctx.runAction(internal.tools.whatsapp.whatsappGetConversation, {
        organizationId, actorId, actorType, environment,
        phoneNumber: args.phoneNumber as string,
        limit: args.limit as number | undefined,
      })

    case "whatsapp.getStatus":
      return await ctx.runAction(internal.tools.whatsapp.whatsappGetStatus, {
        organizationId, actorId, actorType, environment,
      })

    case "agent.chat":
      if (!args.agent) throw new Error("agent.chat requires 'agent' parameter")
      if (!args.message) throw new Error("agent.chat requires 'message' parameter")
      return await ctx.runAction(internal.tools.agents.agentChat, {
        organizationId,
        actorId,
        actorType,
        environment,
        agentSlug: args.agent as string,
        message: args.message as string,
        context: (args.context as Record<string, unknown>) ?? undefined,
        conversationId: params.conversationId,
        depth: params.depth ?? 0,
        callerAgentSlug: params.callerAgentSlug,
      })

    default:
      throw new Error(`Unknown builtin tool: ${toolName}`)
  }
}

function sanitizeFilters(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(sanitizeFilters)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const safeKey = key.startsWith("$") ? `_op_${key.slice(1)}` : key
    result[safeKey] = sanitizeFilters(value)
  }
  return result
}
