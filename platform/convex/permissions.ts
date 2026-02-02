import { v } from "convex/values"
import { internalQuery } from "./_generated/server"
import { ActorContext, ActorType } from "./lib/permissions/types"
import { canUseTool, getToolIdentity, ToolPermissionResult } from "./lib/permissions/tools"
import { queryEntitiesAsActor, getEntityAsActor } from "./lib/permissions"

const actorContextValidator = v.object({
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
})

const toolPermissionResultValidator = v.object({
  allowed: v.boolean(),
  reason: v.optional(v.string()),
  identityMode: v.union(
    v.literal("inherit"),
    v.literal("system"),
    v.literal("configured")
  ),
  configuredRoleId: v.optional(v.id("roles")),
})

export const canUseToolQuery = internalQuery({
  args: {
    actor: actorContextValidator,
    agentId: v.id("agents"),
    toolName: v.string(),
  },
  returns: toolPermissionResultValidator,
  handler: async (ctx, args): Promise<ToolPermissionResult> => {
    const actor: ActorContext = {
      organizationId: args.actor.organizationId,
      actorType: args.actor.actorType,
      actorId: args.actor.actorId,
      roleIds: args.actor.roleIds,
      isOrgAdmin: args.actor.isOrgAdmin,
    }
    return await canUseTool(ctx, actor, args.agentId, args.toolName)
  },
})

export const getToolIdentityQuery = internalQuery({
  args: {
    actor: actorContextValidator,
    agentId: v.id("agents"),
    toolName: v.string(),
  },
  returns: actorContextValidator,
  handler: async (ctx, args): Promise<ActorContext> => {
    const actor: ActorContext = {
      organizationId: args.actor.organizationId,
      actorType: args.actor.actorType,
      actorId: args.actor.actorId,
      roleIds: args.actor.roleIds,
      isOrgAdmin: args.actor.isOrgAdmin,
    }
    return await getToolIdentity(ctx, actor, args.agentId, args.toolName)
  },
})

export const queryEntitiesAsActorQuery = internalQuery({
  args: {
    actor: actorContextValidator,
    entityTypeSlug: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor: ActorContext = {
      organizationId: args.actor.organizationId,
      actorType: args.actor.actorType,
      actorId: args.actor.actorId,
      roleIds: args.actor.roleIds,
      isOrgAdmin: args.actor.isOrgAdmin,
    }
    return await queryEntitiesAsActor(ctx, actor, args.entityTypeSlug)
  },
})

export const getEntityAsActorQuery = internalQuery({
  args: {
    actor: actorContextValidator,
    entityTypeSlug: v.string(),
    entityId: v.id("entities"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const actor: ActorContext = {
      organizationId: args.actor.organizationId,
      actorType: args.actor.actorType,
      actorId: args.actor.actorId,
      roleIds: args.actor.roleIds,
      isOrgAdmin: args.actor.isOrgAdmin,
    }
    return await getEntityAsActor(ctx, actor, args.entityTypeSlug, args.entityId)
  },
})
