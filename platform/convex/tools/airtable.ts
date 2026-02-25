import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"
import {
  listBases,
  listTables,
  listRecords,
  getRecord,
  createRecords,
  updateRecords,
  deleteRecords,
} from "../lib/integrations/airtable"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

type Environment = "development" | "production" | "eval"

async function resolveToken(
  ctx: any,
  organizationId: Id<"organizations">,
  environment: Environment
): Promise<string> {
  const config = await ctx.runQuery(internal.integrations.getConfigInternal, {
    organizationId,
    environment,
    provider: "airtable" as const,
  })
  if (!config || config.status !== "active") {
    throw new Error("Airtable integration is not configured or not active")
  }
  const pat = (config.config as { personalAccessToken: string }).personalAccessToken
  if (!pat) {
    throw new Error("Airtable Personal Access Token is not configured")
  }
  return pat
}

export const airtableListBases = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
  },
  handler: async (ctx, args) => {
    const token = await resolveToken(ctx, args.organizationId, args.environment as Environment)
    return await listBases(token)
  },
})

export const airtableListTables = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    baseId: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await resolveToken(ctx, args.organizationId, args.environment as Environment)
    return await listTables(token, args.baseId)
  },
})

export const airtableListRecords = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    baseId: v.string(),
    tableIdOrName: v.string(),
    pageSize: v.optional(v.number()),
    offset: v.optional(v.string()),
    filterByFormula: v.optional(v.string()),
    sort: v.optional(v.any()),
    fields: v.optional(v.array(v.string())),
    view: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = await resolveToken(ctx, args.organizationId, args.environment as Environment)
    return await listRecords(token, args.baseId, args.tableIdOrName, {
      pageSize: args.pageSize,
      offset: args.offset,
      filterByFormula: args.filterByFormula,
      sort: args.sort,
      fields: args.fields,
      view: args.view,
    })
  },
})

export const airtableGetRecord = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    baseId: v.string(),
    tableIdOrName: v.string(),
    recordId: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await resolveToken(ctx, args.organizationId, args.environment as Environment)
    return await getRecord(token, args.baseId, args.tableIdOrName, args.recordId)
  },
})

export const airtableCreateRecords = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    baseId: v.string(),
    tableIdOrName: v.string(),
    records: v.any(),
  },
  handler: async (ctx, args) => {
    const token = await resolveToken(ctx, args.organizationId, args.environment as Environment)
    return await createRecords(token, args.baseId, args.tableIdOrName, args.records)
  },
})

export const airtableUpdateRecords = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    baseId: v.string(),
    tableIdOrName: v.string(),
    records: v.any(),
  },
  handler: async (ctx, args) => {
    const token = await resolveToken(ctx, args.organizationId, args.environment as Environment)
    return await updateRecords(token, args.baseId, args.tableIdOrName, args.records)
  },
})

export const airtableDeleteRecords = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    baseId: v.string(),
    tableIdOrName: v.string(),
    recordIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const token = await resolveToken(ctx, args.organizationId, args.environment as Environment)
    return await deleteRecords(token, args.baseId, args.tableIdOrName, args.recordIds)
  },
})
