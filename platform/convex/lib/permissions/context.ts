import { QueryCtx, MutationCtx } from "../../_generated/server"
import { Id } from "../../_generated/dataModel"
import { ActorContext, ActorType, Environment } from "./types"
import { isOrgAdmin as checkIsOrgAdmin } from "../auth"

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
  let adminFlag = false

  if (actorType === "user") {
    adminFlag = await checkIsOrgAdmin(ctx, {
      userId: actorId as Id<"users">,
      organizationId,
    })

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
    adminFlag = true
    const systemRole = await ctx.db
      .query("roles")
      .withIndex("by_org_isSystem", (q) =>
        q.eq("organizationId", organizationId).eq("isSystem", true).eq("environment", environment)
      )
      .first()

    if (systemRole) {
      roleIds = [systemRole._id]
    }
  }

  return {
    organizationId,
    actorType,
    actorId,
    roleIds,
    isOrgAdmin: adminFlag,
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
