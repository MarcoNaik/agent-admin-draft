import { ActionCtx } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"
import { ActorContext, PermissionError } from "./permissions/types"
import { isBuiltinTool } from "../tools/helpers"

const MAX_RESULT_SIZE = 10 * 1024

export interface EntityTypeContext {
  name: string
  slug: string
  description?: string
  schema: Record<string, unknown>
  searchFields?: string[]
}

export interface TemplateContext {
  organizationId: Id<"organizations">
  organizationName: string
  userId?: Id<"users">
  threadId: Id<"threads">
  agentId: Id<"agents">
  actor: ActorContext
  agent: { name: string; slug: string }
  agentName: string
  threadContext: { channel?: string; params: Record<string, unknown> }
  message: string
  timestamp: number
  datetime: string
  currentTime: string
  entityTypes: EntityTypeContext[]
  roles: Array<{ name: string; description?: string }>
}

interface ToolConfig {
  name: string
  handlerCode?: string
}

export interface ToolExecutor {
  executeBuiltin: (name: string, args: Record<string, unknown>) => Promise<unknown>
  executeCustom: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
}

interface ParsedTemplate {
  fullMatch: string
  startIndex: number
  endIndex: number
  isFunction: boolean
  name: string
  argsRaw?: string
}

function parseTemplates(text: string): ParsedTemplate[] {
  const templates: ParsedTemplate[] = []
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

function resolveVariable(name: string, context: TemplateContext): string | undefined {
  const parts = name.split(".")
  let current: unknown = context

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  if (current === undefined || current === null) {
    return undefined
  }

  if (typeof current === "string") {
    return current
  }

  return JSON.stringify(current)
}

function resolveNestedTemplates(text: string, context: TemplateContext): string {
  const nested = parseTemplates(text)
  if (nested.length === 0) {
    return text
  }

  let result = text
  for (let i = nested.length - 1; i >= 0; i--) {
    const template = nested[i]
    if (!template.isFunction) {
      const value = resolveVariable(template.name, context)
      if (value !== undefined) {
        result =
          result.slice(0, template.startIndex) +
          value +
          result.slice(template.endIndex)
      }
    }
  }

  return result
}

async function resolveTemplateFunction(
  runQuery: ActionCtx["runQuery"],
  name: string,
  args: Record<string, unknown>,
  context: TemplateContext
): Promise<unknown> {
  try {
    const actorPayload = {
      organizationId: context.actor.organizationId,
      actorType: context.actor.actorType,
      actorId: context.actor.actorId,
      roleIds: context.actor.roleIds,
      isOrgAdmin: context.actor.isOrgAdmin,
      environment: context.actor.environment,
    } as const

    if (name === "entity.query") {
      const queryArgs = args as { type: string }
      const queryPayload = { actor: actorPayload, entityTypeSlug: queryArgs.type }
      // @ts-expect-error Convex type instantiation depth limit
      const results = await runQuery(internal.permissions.queryEntitiesAsActorQuery, queryPayload)
      return results
    }

    if (name === "entity.get") {
      const getArgs = args as { type: string; id: string }
      const getPayload = { actor: actorPayload, entityTypeSlug: getArgs.type, entityId: getArgs.id as Id<"entities"> }
      const result = await runQuery(internal.permissions.getEntityAsActorQuery, getPayload)
      return result
    }

    return null
  } catch (error) {
    if (error instanceof PermissionError) {
      return []
    }
    throw error
  }
}

async function executeTemplateFunction(
  runQuery: ActionCtx["runQuery"] | undefined,
  name: string,
  argsRaw: string,
  context: TemplateContext,
  tools: ToolConfig[],
  executor: ToolExecutor
): Promise<string> {
  const resolvedArgsRaw = resolveNestedTemplates(argsRaw, context)

  let args: Record<string, unknown>
  try {
    args = resolvedArgsRaw.trim() ? JSON.parse(resolvedArgsRaw) : {}
  } catch {
    return `[TEMPLATE_ERROR: ${name} - invalid JSON arguments]`
  }

  if (runQuery && (name === "entity.query" || name === "entity.get")) {
    try {
      const result = await resolveTemplateFunction(runQuery, name, args, context)
      const stringified = JSON.stringify(result)
      if (stringified.length > MAX_RESULT_SIZE) {
        return stringified.slice(0, MAX_RESULT_SIZE) + "...[truncated]"
      }
      return stringified
    } catch (error) {
      if (error instanceof PermissionError) {
        return "[]"
      }
      const message = error instanceof Error ? error.message : "execution failed"
      return `[TEMPLATE_ERROR: ${name} - ${message}]`
    }
  }

  if (runQuery && name === "format_teacher_schedule") {
    try {
      const actorPayload = {
        organizationId: context.actor.organizationId,
        actorType: context.actor.actorType,
        actorId: context.actor.actorId,
        roleIds: context.actor.roleIds,
        isOrgAdmin: context.actor.isOrgAdmin,
        environment: context.actor.environment,
      } as const
      const teachers = await runQuery(
        internal.permissions.queryEntitiesAsActorQuery,
        { actor: actorPayload, entityTypeSlug: "teacher" }
      ) as Array<{ _id?: string; data?: { name?: string; availability?: unknown; subjects?: string[] } }>

      let filtered = teachers
      const filterNames = (args as { names?: string[] }).names
      if (filterNames && filterNames.length > 0) {
        const lower = filterNames.map((n: string) => n.toLowerCase())
        filtered = teachers.filter((t) => {
          const tName = (t.data?.name ?? "").toLowerCase()
          return lower.some((n) => tName.includes(n) || n.includes(tName))
        })
      }

      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      const keyMap: Record<string, string> = {
        monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
        thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
      }

      const fmt = (h: number) => {
        const hr = Math.floor(h)
        const min = Math.round((h - hr) * 60)
        const suffix = hr >= 12 ? "PM" : "AM"
        const display = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr)
        return `${display}:${String(min).padStart(2, "0")} ${suffix}`
      }

      const lines = filtered.map((teacher) => {
        const tName = teacher.data?.name ?? "Unknown"
        const tId = teacher._id ?? ""
        const subjects = teacher.data?.subjects ?? []
        const availability = teacher.data?.availability as unknown
        const schedule: Record<string, string[]> = {}

        if (availability && typeof availability === "object" && !Array.isArray(availability)) {
          for (const [key, dayName] of Object.entries(keyMap)) {
            const slots = (availability as Record<string, number[]>)[key]
            if (slots && slots.length > 0) {
              schedule[dayName] = slots.map((h: number) => fmt(h))
            }
          }
        }

        let text = `${tName} [id:${tId}] (${subjects.join(", ") || "no subjects"}):\n`
        for (const day of dayOrder) {
          if (schedule[day] && schedule[day].length > 0) {
            text += `  ${day}: ${schedule[day].join(", ")}\n`
          }
        }
        return text
      })

      return lines.join("\n")
    } catch (error) {
      if (error instanceof PermissionError) {
        return "[No teacher data available]"
      }
      const message = error instanceof Error ? error.message : "execution failed"
      return `[TEMPLATE_ERROR: ${name} - ${message}]`
    }
  }

  if (runQuery && name === "format_session_schedule") {
    try {
      const actorPayload = {
        organizationId: context.actor.organizationId,
        actorType: context.actor.actorType,
        actorId: context.actor.actorId,
        roleIds: context.actor.roleIds,
        isOrgAdmin: context.actor.isOrgAdmin,
        environment: context.actor.environment,
      } as const

      const [sessions, students, teachers] = await Promise.all([
        runQuery(internal.permissions.queryEntitiesAsActorQuery, { actor: actorPayload, entityTypeSlug: "session" }),
        runQuery(internal.permissions.queryEntitiesAsActorQuery, { actor: actorPayload, entityTypeSlug: "student" }),
        runQuery(internal.permissions.queryEntitiesAsActorQuery, { actor: actorPayload, entityTypeSlug: "teacher" }),
      ]) as [
        Array<{ _id?: string; data?: Record<string, unknown> }>,
        Array<{ _id?: string; data?: Record<string, unknown> }>,
        Array<{ _id?: string; data?: Record<string, unknown> }>,
      ]

      const studentMap = new Map<string, string>()
      for (const s of students) {
        if (s._id && s.data?.name) studentMap.set(s._id, s.data.name as string)
      }

      const teacherMap = new Map<string, string>()
      for (const t of teachers) {
        if (t._id && t.data?.name) teacherMap.set(t._id, t.data.name as string)
      }

      const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

      const parsed: Array<{
        id: string
        dateKey: string
        sortKey: string
        time: string
        status: string
        studentId: string
        teacherId: string
        subject: string
        duration: number
      }> = []

      for (const s of sessions) {
        const status = s.data?.status as string | undefined
        if (status !== "scheduled" && status !== "completed") continue
        const scheduledAt = s.data?.scheduledAt as string | undefined
        if (!scheduledAt) continue
        const m = scheduledAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
        if (!m) continue
        const [, yy, mm, dd, hh, min] = m
        const dayOfWeek = new Date(parseInt(yy), parseInt(mm) - 1, parseInt(dd)).getDay()
        parsed.push({
          id: s._id ?? "",
          dateKey: `${dayNames[dayOfWeek]} ${dd}/${mm}/${yy}`,
          sortKey: `${yy}-${mm}-${dd}T${hh}:${min}`,
          time: `${hh}:${min}`,
          status,
          studentId: (s.data?.studentId as string) ?? "",
          teacherId: (s.data?.teacherId as string) ?? "",
          subject: (s.data?.subject as string) ?? "",
          duration: (s.data?.duration as number) ?? 60,
        })
      }

      parsed.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

      const grouped = new Map<string, typeof parsed>()
      for (const p of parsed) {
        if (!grouped.has(p.dateKey)) grouped.set(p.dateKey, [])
        grouped.get(p.dateKey)!.push(p)
      }

      const lines: string[] = []
      for (const [dateKey, daySessions] of grouped) {
        lines.push(`${dateKey}:`)
        for (const s of daySessions) {
          const studentName = studentMap.get(s.studentId) ?? "Desconocido"
          const teacherName = teacherMap.get(s.teacherId) ?? "Desconocido"
          lines.push(`  ${s.time} — ${studentName} [student:${s.studentId}] (${s.subject}, ${s.duration} min) con ${teacherName} [id:${s.teacherId}] — ${s.status} [session:${s.id}]`)
        }
        lines.push("")
      }

      if (lines.length === 0) return "No hay sesiones agendadas."
      return lines.join("\n")
    } catch (error) {
      if (error instanceof PermissionError) {
        return "[No session data available]"
      }
      const message = error instanceof Error ? error.message : "execution failed"
      return `[TEMPLATE_ERROR: ${name} - ${message}]`
    }
  }

  const tool = tools.find((t) => t.name === name)

  if (!tool) {
    return `[TEMPLATE_ERROR: ${name} - tool not found]`
  }

  try {
    let result: unknown

    if (isBuiltinTool(name)) {
      result = await executor.executeBuiltin(name, args)
    } else if (tool.handlerCode) {
      result = await executor.executeCustom(name, args)
    } else {
      return `[TEMPLATE_ERROR: ${name} - no handler]`
    }

    const stringified = JSON.stringify(result)
    if (stringified.length > MAX_RESULT_SIZE) {
      return stringified.slice(0, MAX_RESULT_SIZE) + "...[truncated]"
    }

    return stringified
  } catch (error) {
    if (error instanceof PermissionError) {
      return "[]"
    }
    const message = error instanceof Error ? error.message : "execution failed"
    return `[TEMPLATE_ERROR: ${name} - ${message}]`
  }
}

export async function processTemplates(
  systemPrompt: string,
  context: TemplateContext,
  tools: ToolConfig[],
  executor: ToolExecutor,
  runQuery?: ActionCtx["runQuery"]
): Promise<string> {
  const templates = parseTemplates(systemPrompt)

  if (templates.length === 0) {
    return systemPrompt
  }

  const variables: ParsedTemplate[] = []
  const functions: ParsedTemplate[] = []

  for (const t of templates) {
    if (t.isFunction) {
      functions.push(t)
    } else {
      variables.push(t)
    }
  }

  let result = systemPrompt
  for (let i = variables.length - 1; i >= 0; i--) {
    const template = variables[i]
    const value = resolveVariable(template.name, context)
    const replacement =
      value !== undefined
        ? value
        : `[TEMPLATE_ERROR: ${template.name} not found]`
    result =
      result.slice(0, template.startIndex) +
      replacement +
      result.slice(template.endIndex)
  }

  if (functions.length === 0) {
    return result
  }

  const updatedTemplates = parseTemplates(result)
  const functionTemplates = updatedTemplates.filter((t) => t.isFunction)

  const functionResults = await Promise.all(
    functionTemplates.map((t) =>
      executeTemplateFunction(runQuery, t.name, t.argsRaw ?? "", context, tools, executor)
    )
  )

  for (let i = functionTemplates.length - 1; i >= 0; i--) {
    const template = functionTemplates[i]
    const replacement = functionResults[i]
    result =
      result.slice(0, template.startIndex) +
      replacement +
      result.slice(template.endIndex)
  }

  return result
}
