import { MutationCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { deleteEntityMutation } from "./entityMutations"

interface CleanupActor {
  actorId: string
  actorType: "user" | "system" | "agent" | "webhook"
}

interface CleanupParams {
  userId: Id<"users">
  organizationId: Id<"organizations">
  clerkUserId: string
  deleteLinkedEntities?: boolean
  actor: CleanupActor
}

interface CleanupSummary {
  rolesRemoved: number
  pendingAssignmentsRemoved: number
  calendarConnectionsRemoved: number
  sandboxSessionsRemoved: number
  entitiesDeleted: number
}

export async function cleanupMembershipData(
  ctx: MutationCtx,
  params: CleanupParams,
): Promise<CleanupSummary> {
  const { userId, organizationId, clerkUserId, deleteLinkedEntities, actor } = params

  const summary: CleanupSummary = {
    rolesRemoved: 0,
    pendingAssignmentsRemoved: 0,
    calendarConnectionsRemoved: 0,
    sandboxSessionsRemoved: 0,
    entitiesDeleted: 0,
  }

  await ctx.db.insert("events", {
    organizationId,
    environment: "production" as const,
    entityTypeSlug: "user",
    eventType: "user.removed",
    schemaVersion: 1,
    actorId: actor.actorId,
    actorType: actor.actorType,
    payload: { userId, clerkUserId },
    timestamp: Date.now(),
  })

  const userRoles = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()

  for (const ur of userRoles) {
    const role = await ctx.db.get(ur.roleId)
    if (role && role.organizationId === organizationId) {
      await ctx.db.delete(ur._id)
      summary.rolesRemoved++
    }
  }

  const user = await ctx.db.get(userId)
  if (user?.email) {
    const pendingAssignments = await ctx.db
      .query("pendingRoleAssignments")
      .withIndex("by_org_email", (q) =>
        q.eq("organizationId", organizationId).eq("email", user.email!)
      )
      .collect()
    for (const pa of pendingAssignments) {
      await ctx.db.delete(pa._id)
      summary.pendingAssignmentsRemoved++
    }
  }

  for (const env of ["development", "production", "eval"] as const) {
    const calConnections = await ctx.db
      .query("calendarConnections")
      .withIndex("by_user_org_env", (q) =>
        q.eq("userId", userId).eq("organizationId", organizationId).eq("environment", env)
      )
      .collect()
    for (const cc of calConnections) {
      await ctx.db.delete(cc._id)
      summary.calendarConnectionsRemoved++
    }

    const sandboxSessions = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_org_env_user", (q) =>
        q.eq("organizationId", organizationId).eq("environment", env).eq("userId", userId)
      )
      .collect()
    for (const ss of sandboxSessions) {
      await ctx.db.delete(ss._id)
      summary.sandboxSessionsRemoved++
    }

    if (deleteLinkedEntities) {
      const entityTypes = await ctx.db
        .query("entityTypes")
        .withIndex("by_org_env", (q) =>
          q.eq("organizationId", organizationId).eq("environment", env)
        )
        .collect()

      for (const et of entityTypes) {
        if (!et.userIdField) continue
        const entities = await ctx.db
          .query("entities")
          .withIndex("by_org_env_type", (q) =>
            q.eq("organizationId", organizationId).eq("environment", env).eq("entityTypeId", et._id)
          )
          .collect()

        for (const entity of entities) {
          if (entity.deletedAt) continue
          if (entity.data?.[et.userIdField] === clerkUserId) {
            await deleteEntityMutation(ctx, {
              organizationId,
              environment: env,
              entityId: entity._id,
              entityTypeSlug: et.slug,
              previousData: entity.data as Record<string, unknown>,
              actor,
              skipTriggers: true,
            })
            summary.entitiesDeleted++
          }
        }
      }
    }
  }

  return summary
}
