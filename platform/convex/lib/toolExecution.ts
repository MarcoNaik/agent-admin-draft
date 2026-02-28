import { Id } from "../_generated/dataModel"
import { ActorContext, ActorType, Environment } from "./permissions/types"
import { makeFunctionReference } from "convex/server"

const ref = (name: string) => makeFunctionReference<"mutation" | "query" | "action">(name as any)

export function serializeActor(actor: ActorContext) {
  return {
    organizationId: actor.organizationId,
    actorType: actor.actorType,
    actorId: actor.actorId,
    roleIds: actor.roleIds,
    isOrgAdmin: actor.isOrgAdmin,
    environment: actor.environment,
  }
}

export function sanitizeFilters(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(sanitizeFilters)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const safeKey = key.startsWith("$") ? `_op_${key.slice(1)}` : key
    result[safeKey] = sanitizeFilters(value)
  }
  return result
}

export async function executeBuiltinTool(
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
      return await ctx.runMutation(ref("tools/entities:entityCreate"), {
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
      return await ctx.runQuery(ref("tools/entities:entityGet"), {
        organizationId,
        actorId,
        actorType,
        environment,
        id: args.id as string,
      })

    case "entity.query":
      if (!args.type) throw new Error("entity.query requires 'type' parameter")
      return await ctx.runQuery(ref("tools/entities:entityQuery"), {
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
      return await ctx.runMutation(ref("tools/entities:entityUpdate"), {
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
      return await ctx.runMutation(ref("tools/entities:entityDelete"), {
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
      return await ctx.runMutation(ref("tools/entities:entityLink"), {
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
      return await ctx.runMutation(ref("tools/entities:entityUnlink"), {
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
      return await ctx.runMutation(ref("tools/events:eventEmit"), {
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
      return await ctx.runQuery(ref("tools/events:eventQuery"), {
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
      return await ctx.runAction(ref("tools/calendar:calendarList"), {
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
      return await ctx.runAction(ref("tools/calendar:calendarCreate"), {
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
      return await ctx.runAction(ref("tools/calendar:calendarUpdate"), {
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
      return await ctx.runAction(ref("tools/calendar:calendarDelete"), {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        eventId: args.eventId as string,
      })

    case "calendar.freeBusy":
      if (!args.userId) throw new Error("calendar.freeBusy requires 'userId' parameter")
      if (!args.timeMin) throw new Error("calendar.freeBusy requires 'timeMin' parameter")
      if (!args.timeMax) throw new Error("calendar.freeBusy requires 'timeMax' parameter")
      return await ctx.runAction(ref("tools/calendar:calendarFreeBusy"), {
        organizationId, actorId, actorType, environment,
        userId: args.userId as string,
        timeMin: args.timeMin as string,
        timeMax: args.timeMax as string,
      })

    case "whatsapp.send":
      if (!args.to) throw new Error("whatsapp.send requires 'to' parameter")
      if (!args.text) throw new Error("whatsapp.send requires 'text' parameter")
      return await ctx.runAction(ref("tools/whatsapp:whatsappSend"), {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        text: args.text as string,
      })

    case "whatsapp.sendTemplate":
      if (!args.to) throw new Error("whatsapp.sendTemplate requires 'to' parameter")
      if (!args.templateName) throw new Error("whatsapp.sendTemplate requires 'templateName' parameter")
      if (!args.language) throw new Error("whatsapp.sendTemplate requires 'language' parameter")
      return await ctx.runAction(ref("tools/whatsapp:whatsappSendTemplate"), {
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
      return await ctx.runAction(ref("tools/whatsapp:whatsappSendInteractive"), {
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
      return await ctx.runAction(ref("tools/whatsapp:whatsappSendMedia"), {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        mediaUrl: args.mediaUrl as string,
        mediaType: args.mediaType as "image" | "audio",
        caption: args.caption as string | undefined,
      })

    case "whatsapp.listTemplates":
      return await ctx.runAction(ref("tools/whatsapp:whatsappListTemplates"), {
        organizationId, actorId, actorType, environment,
      })

    case "whatsapp.getConversation":
      if (!args.phoneNumber) throw new Error("whatsapp.getConversation requires 'phoneNumber' parameter")
      return await ctx.runAction(ref("tools/whatsapp:whatsappGetConversation"), {
        organizationId, actorId, actorType, environment,
        phoneNumber: args.phoneNumber as string,
        limit: args.limit as number | undefined,
      })

    case "whatsapp.getStatus":
      return await ctx.runAction(ref("tools/whatsapp:whatsappGetStatus"), {
        organizationId, actorId, actorType, environment,
      })

    case "agent.chat":
      if (!args.agent) throw new Error("agent.chat requires 'agent' parameter")
      if (!args.message) throw new Error("agent.chat requires 'message' parameter")
      return await ctx.runAction(ref("tools/agents:agentChat"), {
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

    case "airtable.listBases":
      return await ctx.runAction(ref("tools/airtable:airtableListBases"), {
        organizationId, actorId, actorType, environment,
      })

    case "airtable.listTables":
      if (!args.baseId) throw new Error("airtable.listTables requires 'baseId' parameter")
      return await ctx.runAction(ref("tools/airtable:airtableListTables"), {
        organizationId, actorId, actorType, environment,
        baseId: args.baseId as string,
      })

    case "airtable.listRecords":
      if (!args.baseId) throw new Error("airtable.listRecords requires 'baseId' parameter")
      if (!args.tableIdOrName) throw new Error("airtable.listRecords requires 'tableIdOrName' parameter")
      return await ctx.runAction(ref("tools/airtable:airtableListRecords"), {
        organizationId, actorId, actorType, environment,
        baseId: args.baseId as string,
        tableIdOrName: args.tableIdOrName as string,
        pageSize: args.pageSize as number | undefined,
        offset: args.offset as string | undefined,
        filterByFormula: args.filterByFormula as string | undefined,
        sort: args.sort,
        fields: args.fields as string[] | undefined,
        view: args.view as string | undefined,
      })

    case "airtable.getRecord":
      if (!args.baseId) throw new Error("airtable.getRecord requires 'baseId' parameter")
      if (!args.tableIdOrName) throw new Error("airtable.getRecord requires 'tableIdOrName' parameter")
      if (!args.recordId) throw new Error("airtable.getRecord requires 'recordId' parameter")
      return await ctx.runAction(ref("tools/airtable:airtableGetRecord"), {
        organizationId, actorId, actorType, environment,
        baseId: args.baseId as string,
        tableIdOrName: args.tableIdOrName as string,
        recordId: args.recordId as string,
      })

    case "airtable.createRecords":
      if (!args.baseId) throw new Error("airtable.createRecords requires 'baseId' parameter")
      if (!args.tableIdOrName) throw new Error("airtable.createRecords requires 'tableIdOrName' parameter")
      if (!args.records) throw new Error("airtable.createRecords requires 'records' parameter")
      return await ctx.runAction(ref("tools/airtable:airtableCreateRecords"), {
        organizationId, actorId, actorType, environment,
        baseId: args.baseId as string,
        tableIdOrName: args.tableIdOrName as string,
        records: args.records,
      })

    case "airtable.updateRecords":
      if (!args.baseId) throw new Error("airtable.updateRecords requires 'baseId' parameter")
      if (!args.tableIdOrName) throw new Error("airtable.updateRecords requires 'tableIdOrName' parameter")
      if (!args.records) throw new Error("airtable.updateRecords requires 'records' parameter")
      return await ctx.runAction(ref("tools/airtable:airtableUpdateRecords"), {
        organizationId, actorId, actorType, environment,
        baseId: args.baseId as string,
        tableIdOrName: args.tableIdOrName as string,
        records: args.records,
      })

    case "airtable.deleteRecords":
      if (!args.baseId) throw new Error("airtable.deleteRecords requires 'baseId' parameter")
      if (!args.tableIdOrName) throw new Error("airtable.deleteRecords requires 'tableIdOrName' parameter")
      if (!args.recordIds) throw new Error("airtable.deleteRecords requires 'recordIds' parameter")
      return await ctx.runAction(ref("tools/airtable:airtableDeleteRecords"), {
        organizationId, actorId, actorType, environment,
        baseId: args.baseId as string,
        tableIdOrName: args.tableIdOrName as string,
        recordIds: args.recordIds as string[],
      })

    case "email.send":
      if (!args.to) throw new Error("email.send requires 'to' parameter")
      if (!args.subject) throw new Error("email.send requires 'subject' parameter")
      if (!args.html && !args.text) throw new Error("email.send requires 'html' or 'text' parameter")
      return await ctx.runAction(ref("tools/email:emailSend"), {
        organizationId, actorId, actorType, environment,
        to: args.to as string,
        subject: args.subject as string,
        html: args.html as string | undefined,
        text: args.text as string | undefined,
        replyTo: args.replyTo as string | undefined,
      })

    case "payment.create":
      if (!args.amount) throw new Error("payment.create requires 'amount' parameter")
      if (!args.description) throw new Error("payment.create requires 'description' parameter")
      return await ctx.runAction(ref("tools/flow:paymentCreate"), {
        organizationId, actorId, actorType, environment,
        amount: args.amount as number,
        description: args.description as string,
        currency: args.currency as string | undefined,
        customerEmail: args.customerEmail as string | undefined,
        entityId: args.entityId as string | undefined,
      })

    case "payment.getStatus":
      if (!args.entityId) throw new Error("payment.getStatus requires 'entityId' parameter")
      return await ctx.runAction(ref("tools/flow:paymentGetStatus"), {
        organizationId, actorId, actorType, environment,
        entityId: args.entityId as string,
      })

    default:
      throw new Error(`Unknown builtin tool: ${toolName}`)
  }
}
