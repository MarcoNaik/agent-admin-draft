import { QueryCtx, MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { ActorContext, ActorType, Environment } from "./types"

export async function buildActorContext(
  ctx: QueryCtx | MutationCtx,
  options: {
    organizationId: Id<"organizations">
    actorType: ActorType
    actorId: string
    environment: Environment
  }
): Promise<ActorContext> {
  const { organizationId, actorType, actorId, environment } = options

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
  }

  return {
    organizationId,
    actorType,
    actorId,
    roleIds,
    isOrgAdmin,
    environment,
  }
}

export function buildSystemActorContext(
  organizationId: Id<"organizations">,
  environment: Environment
): ActorContext {
  return {
    organizationId,
    actorType: "system",
    actorId: "system",
    roleIds: [],
    isOrgAdmin: true,
    environment,
  }
}
