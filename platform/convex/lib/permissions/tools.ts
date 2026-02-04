import { QueryCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { ActorContext, Environment, PermissionError } from "./types"

export interface ToolPermissionResult {
  allowed: boolean
  reason?: string
  identityMode: "inherit" | "system" | "configured"
  configuredRoleId?: Id<"roles">
}

export async function canUseTool(
  ctx: QueryCtx,
  actor: ActorContext,
  agentId: Id<"agents">,
  toolName: string
): Promise<ToolPermissionResult> {
  const toolPermission = await ctx.db
    .query("toolPermissions")
    .withIndex("by_agent_tool", (q) =>
      q.eq("agentId", agentId).eq("toolName", toolName)
    )
    .first()

  if (!toolPermission) {
    return {
      allowed: true,
      reason: "No explicit permission defined (default allow)",
      identityMode: "inherit",
    }
  }

  if (actor.actorType === "system") {
    return {
      allowed: true,
      identityMode: toolPermission.identityMode ?? "inherit",
      configuredRoleId: toolPermission.configuredRoleId,
    }
  }

  if (toolPermission.allowedActions && toolPermission.allowedActions.length > 0) {
    return {
      allowed: true,
      identityMode: toolPermission.identityMode ?? "inherit",
      configuredRoleId: toolPermission.configuredRoleId,
    }
  }

  return {
    allowed: true,
    identityMode: toolPermission.identityMode ?? "inherit",
    configuredRoleId: toolPermission.configuredRoleId,
  }
}

export async function getToolIdentity(
  ctx: QueryCtx,
  actor: ActorContext,
  agentId: Id<"agents">,
  toolName: string
): Promise<ActorContext> {
  const permission = await canUseTool(ctx, actor, agentId, toolName)

  if (!permission.allowed) {
    throw new PermissionError(
      permission.reason ?? "Tool not allowed",
      actor,
      "read",
      toolName
    )
  }

  switch (permission.identityMode) {
    case "inherit":
      return actor

    case "system":
      return {
        organizationId: actor.organizationId,
        actorType: "system",
        actorId: "system",
        roleIds: await getSystemRoleIds(ctx, actor.organizationId, actor.environment),
        isOrgAdmin: true,
        environment: actor.environment,
      }

    case "configured":
      if (!permission.configuredRoleId) {
        throw new Error(`Tool ${toolName} configured for specific role but none specified`)
      }
      return {
        ...actor,
        roleIds: [permission.configuredRoleId],
      }

    default:
      return actor
  }
}

async function getSystemRoleIds(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  environment: Environment
): Promise<Id<"roles">[]> {
  const systemRoles = await ctx.db
    .query("roles")
    .withIndex("by_org_isSystem", (q) =>
      q.eq("organizationId", organizationId).eq("isSystem", true)
    )
    .collect()
  const systemRole = systemRoles.find((r) => r.environment === environment)

  return systemRole ? [systemRole._id] : []
}
