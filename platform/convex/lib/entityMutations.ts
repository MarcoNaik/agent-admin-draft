import { MutationCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { Environment } from "./permissions/types"
import { buildSearchText } from "./utils"
import { checkAndScheduleTriggers } from "./triggers"

type ActorType = "user" | "agent" | "system" | "webhook"

interface EntityActor {
  actorId: string
  actorType: ActorType
}

interface CreateEntityParams {
  organizationId: Id<"organizations">
  environment: Environment
  entityTypeId: Id<"entityTypes">
  entityTypeSlug: string
  data: Record<string, unknown>
  status?: string
  searchFields?: string[]
  actor: EntityActor
  extraFields?: Record<string, unknown>
  eventType?: string
  eventPayload?: Record<string, unknown>
  skipTriggers?: boolean
}

interface UpdateEntityParams {
  organizationId: Id<"organizations">
  environment: Environment
  entityId: Id<"entities">
  entityTypeSlug: string
  data: Record<string, unknown>
  previousData: Record<string, unknown>
  status?: string
  searchFields?: string[]
  actor: EntityActor
  extraFields?: Record<string, unknown>
  eventType?: string
  eventPayload?: Record<string, unknown>
  skipTriggers?: boolean
}

interface DeleteEntityParams {
  organizationId: Id<"organizations">
  environment: Environment
  entityId: Id<"entities">
  entityTypeSlug: string
  previousData: Record<string, unknown>
  actor: EntityActor
  skipTriggers?: boolean
}

export async function createEntityMutation(
  ctx: MutationCtx,
  params: CreateEntityParams
): Promise<Id<"entities">> {
  const now = Date.now()
  const searchText = buildSearchText(params.data, params.searchFields)

  const entityId = await ctx.db.insert("entities", {
    organizationId: params.organizationId,
    entityTypeId: params.entityTypeId,
    environment: params.environment,
    status: params.status ?? "active",
    data: params.data,
    searchText,
    createdAt: now,
    updatedAt: now,
    ...params.extraFields,
  })

  await ctx.db.insert("events", {
    organizationId: params.organizationId,
    environment: params.environment,
    entityId,
    entityTypeSlug: params.entityTypeSlug,
    eventType: params.eventType ?? `${params.entityTypeSlug}.created`,
    schemaVersion: 1,
    actorId: params.actor.actorId,
    actorType: params.actor.actorType,
    payload: params.eventPayload ?? { data: params.data },
    timestamp: now,
  })

  if (!params.skipTriggers) {
    await checkAndScheduleTriggers(ctx, {
      organizationId: params.organizationId,
      environment: params.environment,
      entityTypeSlug: params.entityTypeSlug,
      action: "created",
      entityId,
      data: params.data,
    })
  }

  return entityId
}

export async function updateEntityMutation(
  ctx: MutationCtx,
  params: UpdateEntityParams
): Promise<void> {
  const now = Date.now()
  const mergedData = { ...params.previousData, ...params.data }
  const searchText = buildSearchText(mergedData, params.searchFields)

  const updates: Record<string, unknown> = {
    data: mergedData,
    searchText,
    updatedAt: now,
    ...params.extraFields,
  }

  if (params.status !== undefined) {
    updates.status = params.status
  }

  await ctx.db.patch(params.entityId, updates)

  await ctx.db.insert("events", {
    organizationId: params.organizationId,
    environment: params.environment,
    entityId: params.entityId,
    entityTypeSlug: params.entityTypeSlug,
    eventType: params.eventType ?? `${params.entityTypeSlug}.updated`,
    schemaVersion: 1,
    actorId: params.actor.actorId,
    actorType: params.actor.actorType,
    payload: params.eventPayload ?? { changes: params.data, previousData: params.previousData },
    timestamp: now,
  })

  if (!params.skipTriggers) {
    await checkAndScheduleTriggers(ctx, {
      organizationId: params.organizationId,
      environment: params.environment,
      entityTypeSlug: params.entityTypeSlug,
      action: "updated",
      entityId: params.entityId,
      data: mergedData,
      previousData: params.previousData,
    })
  }
}

export async function deleteEntityMutation(
  ctx: MutationCtx,
  params: DeleteEntityParams
): Promise<void> {
  const now = Date.now()

  await ctx.db.patch(params.entityId, {
    status: "deleted",
    deletedAt: now,
    updatedAt: now,
  })

  await ctx.db.insert("events", {
    organizationId: params.organizationId,
    environment: params.environment,
    entityId: params.entityId,
    entityTypeSlug: params.entityTypeSlug,
    eventType: `${params.entityTypeSlug}.deleted`,
    schemaVersion: 1,
    actorId: params.actor.actorId,
    actorType: params.actor.actorType,
    payload: { previousData: params.previousData },
    timestamp: now,
  })

  if (!params.skipTriggers) {
    await checkAndScheduleTriggers(ctx, {
      organizationId: params.organizationId,
      environment: params.environment,
      entityTypeSlug: params.entityTypeSlug,
      action: "deleted",
      entityId: params.entityId,
      data: params.previousData,
      previousData: params.previousData,
    })
  }
}
