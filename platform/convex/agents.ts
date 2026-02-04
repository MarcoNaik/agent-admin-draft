import { v } from "convex/values"
import { query, mutation, internalQuery, action } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { getAuthContext, requireAuth } from "./lib/auth"
import { generateSlug } from "./lib/utils"
import { processTemplates, TemplateContext, ToolExecutor, EntityTypeContext } from "./lib/templateEngine"
import { ActorContext } from "./lib/permissions/types"

const environmentValidator = v.union(v.literal("development"), v.literal("production"))

export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("deleted"))
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    if (args.status) {
      return agents.filter((a) => a.status === args.status)
    }

    return agents.filter((a) => a.status !== "deleted")
  },
})

export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      return null
    }

    return agent
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    return await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", args.slug)
      )
      .first()
  },
})

export const getWithConfig = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      return null
    }

    const devConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id).eq("environment", "development"))
      .first()

    const prodConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id).eq("environment", "production"))
      .first()

    return {
      ...agent,
      developmentConfig: devConfig,
      productionConfig: prodConfig,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const slug = args.slug || generateSlug(args.name)

    const existing = await ctx.db
      .query("agents")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", auth.organizationId).eq("slug", slug)
      )
      .first()

    if (existing) {
      throw new Error("Agent with this slug already exists")
    }

    const now = Date.now()
    return await ctx.db.insert("agents", {
      organizationId: auth.organizationId,
      name: args.name,
      slug,
      description: args.description,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("agents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("deleted"))
    ),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.status !== undefined) updates.status = args.status

    await ctx.db.patch(args.id, updates)
    return await ctx.db.get(args.id)
  },
})

export const remove = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const agent = await ctx.db.get(args.id)

    if (!agent || agent.organizationId !== auth.organizationId) {
      throw new Error("Agent not found")
    }

    await ctx.db.patch(args.id, {
      status: "deleted",
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const getActiveConfig = internalQuery({
  args: {
    agentId: v.id("agents"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", args.agentId).eq("environment", args.environment))
      .first()

    if (!config) {
      throw new Error(`No ${args.environment} configuration found`)
    }

    return config
  },
})

function parseTemplatesSimple(text: string): Array<{
  fullMatch: string
  startIndex: number
  endIndex: number
  isFunction: boolean
  name: string
  argsRaw?: string
}> {
  const templates: Array<{
    fullMatch: string
    startIndex: number
    endIndex: number
    isFunction: boolean
    name: string
    argsRaw?: string
  }> = []
  let i = 0

  while (i < text.length) {
    if (text[i] === "{" && text[i + 1] === "{") {
      const startIndex = i
      i += 2

      let depth = 1
      let contentStart = i
      let contentEnd = -1

      while (i < text.length && depth > 0) {
        if (text[i] === "{" && text[i + 1] === "{") {
          depth++
          i += 2
        } else if (text[i] === "}" && text[i + 1] === "}") {
          depth--
          if (depth === 0) {
            contentEnd = i
          }
          i += 2
        } else {
          i++
        }
      }

      if (contentEnd !== -1) {
        const content = text.slice(contentStart, contentEnd).trim()
        const endIndex = i
        const fullMatch = text.slice(startIndex, endIndex)

        const funcMatch = content.match(/^([a-zA-Z_][\w.]*)\(([\s\S]*)\)$/)
        if (funcMatch) {
          templates.push({
            fullMatch,
            startIndex,
            endIndex,
            isFunction: true,
            name: funcMatch[1],
            argsRaw: funcMatch[2],
          })
        } else {
          templates.push({
            fullMatch,
            startIndex,
            endIndex,
            isFunction: false,
            name: content,
          })
        }
      }
    } else {
      i++
    }
  }

  return templates
}

function resolveVariableSimple(name: string, context: Record<string, unknown>): string | undefined {
  const parts = name.split(".")
  let current: unknown = context

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }

  if (current === undefined || current === null) return undefined
  if (typeof current === "string") return current
  return JSON.stringify(current)
}

function compileTemplatePreview(
  systemPrompt: string,
  context: Record<string, unknown>
): string {
  const templates = parseTemplatesSimple(systemPrompt)
  if (templates.length === 0) return systemPrompt

  let result = systemPrompt

  for (let i = templates.length - 1; i >= 0; i--) {
    const template = templates[i]
    let replacement: string

    if (template.isFunction) {
      replacement = `[PREVIEW: ${template.name}(${template.argsRaw || ""})]`
    } else {
      const value = resolveVariableSimple(template.name, context)
      replacement = value !== undefined ? value : `[UNRESOLVED: ${template.name}]`
    }

    result = result.slice(0, template.startIndex) + replacement + result.slice(template.endIndex)
  }

  return result
}

export const getCompileData = internalQuery({
  args: {
    agentId: v.id("agents"),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
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

    const organization = await ctx.db.get(auth.organizationId)

    const entityTypesRaw = await ctx.db
      .query("entityTypes")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    const rolesRaw = await ctx.db
      .query("roles")
      .withIndex("by_org_env", (q) => q.eq("organizationId", auth.organizationId).eq("environment", args.environment))
      .collect()

    return {
      agent: { name: agent.name, slug: agent.slug },
      config: {
        systemPrompt: config.systemPrompt,
        tools: config.tools,
      },
      organization: organization ? { name: organization.name } : null,
      entityTypesRaw: entityTypesRaw.map((et) => ({
        name: et.name,
        slug: et.slug,
        description: (et as { description?: string }).description,
        schema: et.schema,
        searchFields: et.searchFields,
      })),
      rolesRaw: rolesRaw.map((r) => ({
        name: r.name,
        description: r.description,
      })),
      organizationId: auth.organizationId,
      userId: auth.userId,
    }
  },
})

interface CompileData {
  agent: { name: string; slug: string }
  config: { systemPrompt: string; tools: Array<{ name: string; isBuiltin?: boolean; handlerCode?: string }> }
  organization: { name: string } | null
  entityTypesRaw: Array<{ name: string; slug: string; description?: string; schema: unknown; searchFields?: string[] }>
  rolesRaw: Array<{ name: string; description?: string }>
  organizationId: Id<"organizations">
  userId: Id<"users">
}

export const compileSystemPrompt = action({
  args: {
    agentId: v.id("agents"),
    environment: environmentValidator,
    sampleContext: v.optional(v.object({
      message: v.optional(v.string()),
      threadMetadata: v.optional(v.any()),
    })),
  },
  returns: v.union(
    v.object({
      raw: v.string(),
      compiled: v.string(),
      context: v.any(),
    }),
    v.null()
  ),
  handler: async (ctx, args): Promise<{ raw: string; compiled: string; context: TemplateContext } | null> => {
    const data: CompileData | null = await ctx.runQuery(internal.agents.getCompileData, {
      agentId: args.agentId,
      environment: args.environment,
    })

    if (!data) {
      return null
    }

    const { agent, config, organization, entityTypesRaw, rolesRaw, organizationId, userId } = data

    const sampleContext = args.sampleContext || {}
    const now = Date.now()
    const currentTimeStr = new Date(now).toISOString()

    const entityTypes: EntityTypeContext[] = entityTypesRaw.map((et) => ({
      name: et.name,
      slug: et.slug,
      description: et.description,
      schema: et.schema as Record<string, unknown>,
      searchFields: et.searchFields,
    }))

    const roles = rolesRaw.map((r) => ({
      name: r.name,
      description: r.description,
    }))

    const actor: ActorContext = await ctx.runQuery(internal.agent.buildActorContextForAgent, {
      organizationId,
      actorType: "user",
      actorId: userId as unknown as string,
      environment: args.environment,
    })

    const templateContext: TemplateContext = {
      organizationId,
      organizationName: organization?.name ?? "Unknown Organization",
      userId,
      threadId: "sample-thread-id" as Id<"threads">,
      agentId: args.agentId,
      actor,
      agent: { name: agent.name, slug: agent.slug },
      agentName: agent.name,
      thread: { metadata: sampleContext.threadMetadata || {} },
      message: sampleContext.message || "Hello, this is a sample message.",
      timestamp: now,
      datetime: currentTimeStr,
      currentTime: currentTimeStr,
      entityTypes,
      roles,
    }

    const toolExecutor: ToolExecutor = {
      executeBuiltin: async () => ({ error: "Preview mode - tool execution disabled" }),
      executeCustom: async () => ({ error: "Preview mode - tool execution disabled" }),
    }

    const compiled = await processTemplates(
      config.systemPrompt,
      templateContext,
      config.tools || [],
      toolExecutor,
      ctx.runQuery
    )

    return {
      raw: config.systemPrompt,
      compiled,
      context: templateContext,
    }
  },
})
