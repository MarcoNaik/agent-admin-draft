"use node"

import { v } from "convex/values"
import { action, internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import {
  createKapsoCustomer,
  createSetupLink,
  registerProjectWebhook,
  registerPhoneWebhook,
  deletePhoneNumber,
  sendTextMessage,
  sendTemplateMessage,
  getKapsoWebhookSecret,
  listPhoneTemplates,
  createPhoneTemplate,
  deletePhoneTemplate,
  getPhoneTemplateStatus,
  sendInteractiveButtons,
  sendImageMessage,
  sendAudioMessage,
  downloadMedia,
  uploadMedia,
} from "./lib/integrations/kapso"
import { parseWhatsAppExternalId } from "./whatsapp"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

export const sendTextToPhone = internalAction({
  args: {
    kapsoPhoneNumberId: v.string(),
    to: v.string(),
    text: v.string(),
  },
  returns: v.object({ messageId: v.string() }),
  handler: async (ctx, args): Promise<{ messageId: string }> => {
    return await sendTextMessage(args.kapsoPhoneNumberId, args.to, args.text)
  },
})

export const createKapsoSetup = internalAction({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    label: v.optional(v.string()),
    existingKapsoCustomerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let kapsoCustomerId = args.existingKapsoCustomerId

    if (!kapsoCustomerId) {
      const org = await ctx.runQuery(internal.organizations.getInternal, {
        organizationId: args.organizationId,
      }) as { name: string } | null

      const customer = await createKapsoCustomer(
        org?.name ?? "Organization",
        args.organizationId as string
      )
      kapsoCustomerId = customer.id

      const integrationConfig = await ctx.runQuery(internal.integrations.getConfigInternal, {
        organizationId: args.organizationId,
        environment: args.environment,
        provider: "whatsapp",
      }) as { _id: Id<"integrationConfigs">; config: Record<string, unknown> } | null

      if (integrationConfig) {
        await ctx.runMutation(internal.integrations.patchConfigInternal, {
          configId: integrationConfig._id,
          config: { ...integrationConfig.config, kapsoCustomerId },
        })
      }
    }

    try {
      const siteUrl = process.env.CONVEX_SITE_URL ?? ""
      const secret = getKapsoWebhookSecret()
      await registerProjectWebhook(
        `${siteUrl}/webhook/kapso/project`,
        secret
      )
    } catch (e) {
      console.error("Failed to register project webhook:", e)
    }

    const dashboardUrl = process.env.DASHBOARD_URL ?? ""
    const setupLink = await createSetupLink(
      kapsoCustomerId,
      `${dashboardUrl}/settings/integrations/whatsapp`,
      `${dashboardUrl}/settings/integrations/whatsapp`
    )

    await ctx.runMutation(internal.whatsapp.createConnection, {
      organizationId: args.organizationId,
      environment: args.environment,
      status: "pending_setup",
      kapsoCustomerId,
      setupLinkUrl: setupLink.url,
      label: args.label,
    })

    return null
  },
})

export const disconnectFromKapso = internalAction({
  args: {
    kapsoPhoneNumberId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deletePhoneNumber(args.kapsoPhoneNumberId)
    return null
  },
})

export const registerNumberWebhook = internalAction({
  args: {
    kapsoPhoneNumberId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const siteUrl = process.env.CONVEX_SITE_URL ?? ""
    const webhookUrl = `${siteUrl}/webhook/kapso/messages`
    const secret = getKapsoWebhookSecret()
    await registerPhoneWebhook(args.kapsoPhoneNumberId, webhookUrl, secret)
    return null
  },
})

export const routeInboundToAgent = internalAction({
  args: {
    organizationId: v.id("organizations"),
    phoneNumber: v.string(),
    text: v.string(),
    environment: environmentValidator,
    agentId: v.id("agents"),
    connectionId: v.id("whatsappConnections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const externalThreadId = `whatsapp:${args.connectionId}:${args.phoneNumber}`

    const threadId = await ctx.runMutation(internal.threads.getOrCreate, {
      organizationId: args.organizationId,
      agentId: args.agentId,
      externalId: externalThreadId,
      environment: args.environment,
    })

    const result = await ctx.runAction(internal.agent.chatAuthenticated, {
      organizationId: args.organizationId,
      agentId: args.agentId,
      message: args.text,
      threadId,
      environment: args.environment,
    })

    const responseText = result.message

    if (responseText) {
      let messageId = `failed_${Date.now()}`
      let status: "sent" | "failed" = "sent"

      const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
        connectionId: args.connectionId,
      }) as { kapsoPhoneNumberId?: string; status: string } | null

      if (connection?.kapsoPhoneNumberId && connection.status === "connected") {
        try {
          const sendResult = await sendTextMessage(
            connection.kapsoPhoneNumberId,
            args.phoneNumber,
            responseText
          )
          messageId = sendResult.messageId
        } catch {
          status = "failed"
        }
      } else {
        status = "failed"
      }

      await ctx.runMutation(internal.whatsapp.storeOutboundMessage, {
        organizationId: args.organizationId,
        connectionId: args.connectionId,
        phoneNumber: args.phoneNumber,
        messageId,
        text: responseText,
        threadId: result.threadId,
        status,
      })
    }

    return null
  },
})

export const downloadAndStoreMedia = internalAction({
  args: {
    whatsappMessageId: v.id("whatsappMessages"),
    mediaId: v.string(),
    kapsoPhoneNumberId: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let data: ArrayBuffer
    let mimeType: string
    let fileName: string | undefined

    if (args.mediaUrl) {
      const response = await fetch(args.mediaUrl)
      data = await response.arrayBuffer()
      mimeType = response.headers.get("content-type") ?? "application/octet-stream"
    } else {
      const result = await downloadMedia(args.mediaId, args.kapsoPhoneNumberId)
      data = result.data
      mimeType = result.mimeType
      fileName = result.fileName
    }

    const blob = new Blob([data], { type: mimeType })
    const storageId = await ctx.storage.store(blob)
    await ctx.runMutation(internal.whatsapp.attachMediaToMessage, {
      whatsappMessageId: args.whatsappMessageId,
      storageId,
      mimeType,
      fileName,
    })
    return null
  },
})

export const listTemplates = action({
  args: {
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as { userId: Id<"users">; organizationId: Id<"organizations"> } | null
    if (!auth) throw new Error("Not authenticated")

    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const ownedNames = await ctx.runQuery(internal.whatsapp.getOwnedTemplateNames, {
      organizationId: auth.organizationId,
      environment: args.environment,
    }) as string[]

    const allTemplates = await listPhoneTemplates(connection.kapsoPhoneNumberId) as { data?: Array<{ name: string; [key: string]: unknown }> }

    if (!allTemplates?.data || ownedNames.length === 0) {
      return { ...allTemplates, data: allTemplates?.data?.filter((t: { name: string }) => ownedNames.includes(t.name)) ?? [] }
    }

    return { ...allTemplates, data: allTemplates.data.filter((t: { name: string }) => ownedNames.includes(t.name)) }
  },
})

export const sendTemplate = action({
  args: {
    threadId: v.id("threads"),
    templateName: v.string(),
    language: v.string(),
    components: v.optional(v.array(v.any())),
  },
  returns: v.object({
    messageId: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args): Promise<{ messageId: string; status: string }> => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as { userId: Id<"users">; organizationId: Id<"organizations"> } | null
    if (!auth) throw new Error("Not authenticated")

    const thread = await ctx.runQuery(internal.threads.getThreadInternal, {
      threadId: args.threadId,
    }) as { _id: Id<"threads">; organizationId: Id<"organizations">; externalId?: string; environment?: string } | null

    if (!thread || thread.organizationId !== auth.organizationId) {
      throw new Error("Thread not found")
    }

    if (!thread.externalId?.startsWith("whatsapp:")) {
      throw new Error("Not a WhatsApp thread")
    }

    const parsed = parseWhatsAppExternalId(thread.externalId)
    if (!parsed) throw new Error("Invalid WhatsApp thread format")

    const { connectionId, customerPhone } = parsed

    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: connectionId as Id<"whatsappConnections">,
    }) as { kapsoPhoneNumberId?: string; status: string } | null

    if (!connection?.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const result = await sendTemplateMessage(
      connection.kapsoPhoneNumberId,
      customerPhone,
      args.templateName,
      args.language,
      args.components as any
    )

    await ctx.runMutation(internal.whatsapp.storeOutboundMessage, {
      organizationId: auth.organizationId,
      connectionId: connectionId as Id<"whatsappConnections">,
      phoneNumber: customerPhone,
      messageId: result.messageId,
      text: `[Template: ${args.templateName}]`,
      threadId: args.threadId,
      status: "sent",
    })

    await ctx.runMutation(internal.threads.appendMessages, {
      threadId: args.threadId,
      messages: [{ role: "assistant", content: `[Template: ${args.templateName}]` }],
    })

    return { messageId: result.messageId, status: "sent" }
  },
})

export const sendMedia = action({
  args: {
    threadId: v.id("threads"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("audio"), v.literal("document")),
    caption: v.optional(v.string()),
    fileName: v.optional(v.string()),
  },
  returns: v.object({ messageId: v.string() }),
  handler: async (ctx, args): Promise<{ messageId: string }> => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as { userId: Id<"users">; organizationId: Id<"organizations"> } | null
    if (!auth) throw new Error("Not authenticated")

    const thread = await ctx.runQuery(internal.threads.getThreadInternal, {
      threadId: args.threadId,
    }) as { _id: Id<"threads">; organizationId: Id<"organizations">; externalId?: string; environment?: string } | null

    if (!thread || thread.organizationId !== auth.organizationId) throw new Error("Thread not found")
    if (!thread.externalId?.startsWith("whatsapp:")) throw new Error("Not a WhatsApp thread")

    const parsed = parseWhatsAppExternalId(thread.externalId)
    if (!parsed) throw new Error("Invalid WhatsApp thread format")

    const { connectionId, customerPhone } = parsed

    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: connectionId as Id<"whatsappConnections">,
    }) as { kapsoPhoneNumberId?: string; status: string } | null

    if (!connection?.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const fileUrl = await ctx.storage.getUrl(args.storageId)
    if (!fileUrl) throw new Error("File not found in storage")

    const fileResponse = await fetch(fileUrl)
    const fileBlob = await fileResponse.blob()
    const mimeType = fileBlob.type || "application/octet-stream"

    const { mediaId: waMediaId } = await uploadMedia(connection.kapsoPhoneNumberId, mimeType, fileBlob)

    let messageId: string
    if (args.mediaType === "image") {
      const result = await sendImageMessage(connection.kapsoPhoneNumberId, customerPhone, { id: waMediaId, caption: args.caption })
      messageId = result.messageId
    } else if (args.mediaType === "audio") {
      const result = await sendAudioMessage(connection.kapsoPhoneNumberId, customerPhone, { id: waMediaId })
      messageId = result.messageId
    } else {
      const result = await sendImageMessage(connection.kapsoPhoneNumberId, customerPhone, { id: waMediaId, caption: args.caption })
      messageId = result.messageId
    }

    const displayText = args.caption ?? `[Sent ${args.mediaType}]`

    await ctx.runMutation(internal.whatsapp.storeOutboundMediaMessage, {
      organizationId: auth.organizationId,
      connectionId: connectionId as Id<"whatsappConnections">,
      phoneNumber: customerPhone,
      messageId,
      type: args.mediaType,
      text: displayText,
      threadId: args.threadId,
      mediaStorageId: args.storageId,
      mediaMimeType: mimeType,
      mediaFileName: args.fileName,
      mediaCaption: args.caption,
    })

    await ctx.runMutation(internal.threads.appendMessages, {
      threadId: args.threadId,
      messages: [{ role: "assistant", content: displayText }],
    })

    return { messageId }
  },
})

export const sendInteractive = action({
  args: {
    threadId: v.id("threads"),
    bodyText: v.string(),
    buttons: v.array(v.object({ id: v.string(), title: v.string() })),
    footerText: v.optional(v.string()),
  },
  returns: v.object({ messageId: v.string() }),
  handler: async (ctx, args): Promise<{ messageId: string }> => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as { userId: Id<"users">; organizationId: Id<"organizations"> } | null
    if (!auth) throw new Error("Not authenticated")

    const thread = await ctx.runQuery(internal.threads.getThreadInternal, {
      threadId: args.threadId,
    }) as { _id: Id<"threads">; organizationId: Id<"organizations">; externalId?: string; environment?: string; metadata?: Record<string, unknown> } | null

    if (!thread || thread.organizationId !== auth.organizationId) throw new Error("Thread not found")
    if (!thread.externalId?.startsWith("whatsapp:")) throw new Error("Not a WhatsApp thread")

    const lastInboundAt = thread.metadata?.lastInboundAt as number | undefined
    if (!lastInboundAt || (Date.now() - lastInboundAt) >= 24 * 60 * 60 * 1000) {
      throw new Error("24-hour messaging window expired")
    }

    const parsed = parseWhatsAppExternalId(thread.externalId)
    if (!parsed) throw new Error("Invalid WhatsApp thread format")

    const { connectionId, customerPhone } = parsed

    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: connectionId as Id<"whatsappConnections">,
    }) as { kapsoPhoneNumberId?: string; status: string } | null

    if (!connection?.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const result = await sendInteractiveButtons(
      connection.kapsoPhoneNumberId,
      customerPhone,
      args.bodyText,
      args.buttons,
      args.footerText
    )

    await ctx.runMutation(internal.whatsapp.storeOutboundMessage, {
      organizationId: auth.organizationId,
      connectionId: connectionId as Id<"whatsappConnections">,
      phoneNumber: customerPhone,
      messageId: result.messageId,
      text: args.bodyText,
      threadId: args.threadId,
      status: "sent",
    })

    await ctx.runMutation(internal.threads.appendMessages, {
      threadId: args.threadId,
      messages: [{ role: "assistant", content: args.bodyText }],
    })

    return { messageId: result.messageId }
  },
})

export const createTemplate = action({
  args: {
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.array(v.any()),
    allowCategoryChange: v.optional(v.boolean()),
  },
  returns: v.object({ id: v.string(), status: v.string(), category: v.string() }),
  handler: async (ctx, args): Promise<{ id: string; status: string; category: string }> => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as { userId: Id<"users">; organizationId: Id<"organizations"> } | null
    if (!auth) throw new Error("Not authenticated")

    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const result = await createPhoneTemplate(
      connection.kapsoPhoneNumberId,
      args.name,
      args.language,
      args.category,
      args.components as Array<Record<string, unknown>>,
      args.allowCategoryChange
    )

    await ctx.runMutation(internal.whatsapp.registerOwnedTemplate, {
      organizationId: auth.organizationId,
      environment: args.environment,
      templateName: args.name,
    })

    return result
  },
})

export const deleteTemplate = action({
  args: {
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
    name: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as { userId: Id<"users">; organizationId: Id<"organizations"> } | null
    if (!auth) throw new Error("Not authenticated")

    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const result = await deletePhoneTemplate(connection.kapsoPhoneNumberId, args.name)

    await ctx.runMutation(internal.whatsapp.unregisterOwnedTemplate, {
      organizationId: auth.organizationId,
      environment: args.environment,
      templateName: args.name,
    })

    return result
  },
})

export const getTemplateStatus = action({
  args: {
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
    name: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(internal.chat.getAuthInfo) as { userId: Id<"users">; organizationId: Id<"organizations"> } | null
    if (!auth) throw new Error("Not authenticated")

    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== auth.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    return await getPhoneTemplateStatus(connection.kapsoPhoneNumberId, args.name)
  },
})

export const internalListTemplates = internalAction({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== args.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const ownedNames = await ctx.runQuery(internal.whatsapp.getOwnedTemplateNames, {
      organizationId: args.organizationId,
      environment: args.environment,
    }) as string[]

    const allTemplates = await listPhoneTemplates(connection.kapsoPhoneNumberId) as { data?: Array<{ name: string; [key: string]: unknown }> }

    if (!allTemplates?.data || ownedNames.length === 0) {
      return { ...allTemplates, data: allTemplates?.data?.filter((t: { name: string }) => ownedNames.includes(t.name)) ?? [] }
    }

    return { ...allTemplates, data: allTemplates.data.filter((t: { name: string }) => ownedNames.includes(t.name)) }
  },
})

export const internalCreateTemplate = internalAction({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.array(v.any()),
    allowCategoryChange: v.optional(v.boolean()),
  },
  returns: v.object({ id: v.string(), status: v.string(), category: v.string() }),
  handler: async (ctx, args): Promise<{ id: string; status: string; category: string }> => {
    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== args.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const result = await createPhoneTemplate(
      connection.kapsoPhoneNumberId,
      args.name,
      args.language,
      args.category,
      args.components as Array<Record<string, unknown>>,
      args.allowCategoryChange
    )

    await ctx.runMutation(internal.whatsapp.registerOwnedTemplate, {
      organizationId: args.organizationId,
      environment: args.environment,
      templateName: args.name,
    })

    return result
  },
})

export const internalDeleteTemplate = internalAction({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
    name: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== args.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    const result = await deletePhoneTemplate(connection.kapsoPhoneNumberId, args.name)

    await ctx.runMutation(internal.whatsapp.unregisterOwnedTemplate, {
      organizationId: args.organizationId,
      environment: args.environment,
      templateName: args.name,
    })

    return result
  },
})

export const internalGetTemplateStatus = internalAction({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    connectionId: v.id("whatsappConnections"),
    name: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.whatsapp.getConnectionByIdInternal, {
      connectionId: args.connectionId,
    }) as { organizationId: Id<"organizations">; kapsoPhoneNumberId?: string; status: string } | null

    if (!connection || connection.organizationId !== args.organizationId) {
      throw new Error("Connection not found")
    }

    if (!connection.kapsoPhoneNumberId || connection.status !== "connected") {
      throw new Error("WhatsApp not connected")
    }

    return await getPhoneTemplateStatus(connection.kapsoPhoneNumberId, args.name)
  },
})
