"use node"

import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { Id } from "../_generated/dataModel"
import { makeFunctionReference } from "convex/server"

const getConnectionByIdRef = makeFunctionReference<"query">("whatsapp:getConnectionByIdInternal")
const getConnectionByAgentRef = makeFunctionReference<"query">("whatsapp:getConnectionByAgentInternal")
const listConnectionsRef = makeFunctionReference<"query">("whatsapp:listConnectionsInternal")
const storeOutboundMessageRef = makeFunctionReference<"mutation">("whatsapp:storeOutboundMessage")
const getOwnedTemplateNamesRef = makeFunctionReference<"query">("whatsapp:getOwnedTemplateNames")
const getConversationMessagesRef = makeFunctionReference<"query">("whatsapp:getConversationMessagesInternal")
import {
  sendTextMessage,
  sendTemplateMessage,
  sendInteractiveButtons,
  sendImageMessage,
  sendAudioMessage,
  listPhoneTemplates,
} from "../lib/integrations/kapso"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

async function resolveConnection(
  ctx: any,
  args: {
    organizationId: Id<"organizations">
    actorId: string
    actorType: string
    environment: "development" | "production" | "eval"
    connectionId?: Id<"whatsappConnections">
    agentId?: Id<"agents">
  }
): Promise<any> {
  let connection: any

  if (args.connectionId) {
    connection = await ctx.runQuery(getConnectionByIdRef, {
      connectionId: args.connectionId,
    } as any)
  } else if (args.agentId) {
    connection = await ctx.runQuery(getConnectionByAgentRef, {
      organizationId: args.organizationId,
      environment: args.environment,
      agentId: args.agentId,
    } as any)
  }

  if (!connection) {
    const connections: any[] = await ctx.runQuery(listConnectionsRef, {
      organizationId: args.organizationId,
      environment: args.environment,
    } as any)
    connection = connections.find((c: any) => c.status === "connected")
  }

  if (!connection || connection.status !== "connected" || !connection.kapsoPhoneNumberId) {
    throw new Error("No connected WhatsApp number found for this organization")
  }

  return connection
}

const connectionArgs = {
  organizationId: v.id("organizations"),
  actorId: v.string(),
  actorType: v.string(),
  environment: environmentValidator,
  connectionId: v.optional(v.id("whatsappConnections")),
  agentId: v.optional(v.id("agents")),
}

export const whatsappSend = internalAction({
  args: {
    ...connectionArgs,
    to: v.string(),
    text: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const connection = await resolveConnection(ctx, args)

    const result = await sendTextMessage(
      connection.kapsoPhoneNumberId,
      args.to,
      args.text
    )

    await ctx.runMutation(storeOutboundMessageRef, {
      organizationId: args.organizationId,
      connectionId: connection._id,
      phoneNumber: args.to,
      messageId: result.messageId,
      text: args.text,
    })

    return {
      messageId: result.messageId,
      to: args.to,
      status: "sent",
    }
  },
})

export const whatsappSendTemplate = internalAction({
  args: {
    ...connectionArgs,
    to: v.string(),
    templateName: v.string(),
    language: v.string(),
    components: v.optional(v.array(v.object({
      type: v.string(),
      parameters: v.array(v.object({
        type: v.string(),
        text: v.optional(v.string()),
        parameterName: v.optional(v.string()),
      })),
    }))),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const connection = await resolveConnection(ctx, args)

    const coercedComponents = args.components?.map((c) => ({
      ...c,
      parameters: c.parameters.map((p) => ({
        ...p,
        text: p.text != null ? String(p.text) : p.text,
      })),
    }))

    const result = await sendTemplateMessage(
      connection.kapsoPhoneNumberId,
      args.to,
      args.templateName,
      args.language,
      coercedComponents as any
    )

    await ctx.runMutation(storeOutboundMessageRef, {
      organizationId: args.organizationId,
      connectionId: connection._id,
      phoneNumber: args.to,
      messageId: result.messageId,
      text: `[Template: ${args.templateName}]`,
      type: "template",
    })

    return {
      messageId: result.messageId,
      to: args.to,
      status: "sent",
      template: args.templateName,
    }
  },
})

export const whatsappSendInteractive = internalAction({
  args: {
    ...connectionArgs,
    to: v.string(),
    bodyText: v.string(),
    buttons: v.array(v.object({
      id: v.string(),
      title: v.string(),
    })),
    footerText: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.buttons.length === 0 || args.buttons.length > 3) {
      throw new Error("Interactive messages require 1-3 buttons")
    }
    for (const button of args.buttons) {
      if (button.title.length > 20) {
        throw new Error(`Button title "${button.title}" exceeds 20 character limit`)
      }
    }

    const connection = await resolveConnection(ctx, args)

    const result = await sendInteractiveButtons(
      connection.kapsoPhoneNumberId,
      args.to,
      args.bodyText,
      args.buttons,
      args.footerText
    )

    await ctx.runMutation(storeOutboundMessageRef, {
      organizationId: args.organizationId,
      connectionId: connection._id,
      phoneNumber: args.to,
      messageId: result.messageId,
      text: args.bodyText,
      type: "interactive",
      interactiveData: { buttons: args.buttons, footerText: args.footerText },
    })

    return {
      messageId: result.messageId,
      to: args.to,
      status: "sent",
    }
  },
})

export const whatsappSendMedia = internalAction({
  args: {
    ...connectionArgs,
    to: v.string(),
    mediaUrl: v.string(),
    mediaType: v.union(v.literal("image"), v.literal("audio")),
    caption: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const connection = await resolveConnection(ctx, args)

    let result: { messageId: string }

    if (args.mediaType === "image") {
      result = await sendImageMessage(
        connection.kapsoPhoneNumberId,
        args.to,
        { link: args.mediaUrl, caption: args.caption }
      )
    } else {
      result = await sendAudioMessage(
        connection.kapsoPhoneNumberId,
        args.to,
        { link: args.mediaUrl }
      )
    }

    await ctx.runMutation(storeOutboundMessageRef, {
      organizationId: args.organizationId,
      connectionId: connection._id,
      phoneNumber: args.to,
      messageId: result.messageId,
      text: args.caption ?? `[${args.mediaType}]`,
      type: args.mediaType,
      mediaDirectUrl: args.mediaUrl,
      mediaCaption: args.caption,
    })

    return {
      messageId: result.messageId,
      to: args.to,
      status: "sent",
      mediaType: args.mediaType,
    }
  },
})

export const whatsappListTemplates = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    connectionId: v.optional(v.id("whatsappConnections")),
    agentId: v.optional(v.id("agents")),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const connection = await resolveConnection(ctx, args)

    const ownedNames = await ctx.runQuery(getOwnedTemplateNamesRef, {
      organizationId: args.organizationId,
    }) as string[]

    const allTemplates = await listPhoneTemplates(connection.kapsoPhoneNumberId) as { data?: Array<{ name: string }> }

    return { ...allTemplates, data: (allTemplates?.data ?? []).filter((t: { name: string }) => ownedNames.includes(t.name)) }
  },
})

export const whatsappGetConversation = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    phoneNumber: v.string(),
    connectionId: v.optional(v.id("whatsappConnections")),
    agentId: v.optional(v.id("agents")),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runQuery(getConversationMessagesRef, {
      organizationId: args.organizationId,
      phoneNumber: args.phoneNumber,
      connectionId: args.connectionId,
      limit: args.limit,
    })
  },
})

export const whatsappGetStatus = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const connections: any[] = await ctx.runQuery(listConnectionsRef, {
      organizationId: args.organizationId,
      environment: args.environment,
    } as any)

    if (connections.length === 0) {
      return { connected: false, status: "not_configured", connections: [] }
    }

    return {
      connected: connections.some((c: any) => c.status === "connected"),
      status: connections.some((c: any) => c.status === "connected") ? "connected" : "disconnected",
      connections: connections.map((c: any) => ({
        id: c._id,
        status: c.status,
        label: c.label,
        phoneNumber: c.phoneNumber,
        agentId: c.agentId,
        lastConnectedAt: c.lastConnectedAt,
      })),
    }
  },
})
