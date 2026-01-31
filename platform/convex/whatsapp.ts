import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/auth"
import {
  sendTemplateMessage,
  canSendFreeform,
  sendFreeformMessage,
} from "./lib/integrations/whatsapp"

export const processInboundMessage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    from: v.string(),
    messageId: v.string(),
    timestamp: v.number(),
    type: v.string(),
    text: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("whatsappConversations")
      .withIndex("by_org_phone", (q) =>
        q.eq("organizationId", args.organizationId).eq("phoneNumber", args.from)
      )
      .first()

    const now = args.timestamp
    const windowExpiry = now + 24 * 60 * 60 * 1000

    if (conversation) {
      await ctx.db.patch(conversation._id, {
        lastInboundAt: now,
        windowExpiresAt: windowExpiry,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("whatsappConversations", {
        organizationId: args.organizationId,
        phoneNumber: args.from,
        whatsappId: args.from,
        entityType: null,
        entityId: null,
        lastInboundAt: now,
        lastOutboundAt: null,
        windowExpiresAt: windowExpiry,
        createdAt: now,
        updatedAt: now,
      })
    }

    await ctx.db.insert("whatsappMessages", {
      organizationId: args.organizationId,
      direction: "inbound",
      phoneNumber: args.from,
      messageId: args.messageId,
      type: args.type,
      text: args.text,
      status: "received",
      createdAt: now,
    })

    return null
  },
})

export const sendTemplate = mutation({
  args: {
    toPhoneNumber: v.string(),
    templateName: v.string(),
    languageCode: v.string(),
    variables: v.any(),
  },
  returns: v.object({ messageId: v.string() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const result = await sendTemplateMessage(ctx, {
      organizationId: auth.organizationId,
      toPhoneNumber: args.toPhoneNumber,
      templateName: args.templateName,
      languageCode: args.languageCode,
      variables: args.variables as Record<string, string>,
    })

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: undefined,
      entityTypeSlug: undefined,
      eventType: "whatsapp.template_sent",
      schemaVersion: 1,
      actorId: auth.userId as unknown as string,
      actorType: auth.actorType,
      payload: {
        toPhoneNumber: args.toPhoneNumber,
        templateName: args.templateName,
        messageId: result.messageId,
      },
      timestamp: Date.now(),
    })

    return result
  },
})

export const sendMessage = mutation({
  args: {
    toPhoneNumber: v.string(),
    text: v.string(),
  },
  returns: v.object({ messageId: v.string() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const result = await sendFreeformMessage(
      ctx,
      auth.organizationId,
      args.toPhoneNumber,
      args.text
    )

    await ctx.db.insert("events", {
      organizationId: auth.organizationId,
      entityId: undefined,
      entityTypeSlug: undefined,
      eventType: "whatsapp.message_sent",
      schemaVersion: 1,
      actorId: auth.userId as unknown as string,
      actorType: auth.actorType,
      payload: {
        toPhoneNumber: args.toPhoneNumber,
        messageId: result.messageId,
      },
      timestamp: Date.now(),
    })

    return result
  },
})

export const getConversation = query({
  args: {
    phoneNumber: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("whatsappConversations"),
      organizationId: v.id("organizations"),
      phoneNumber: v.string(),
      whatsappId: v.string(),
      entityType: v.union(v.literal("guardian"), v.literal("teacher"), v.null()),
      entityId: v.union(v.id("entities"), v.null()),
      lastInboundAt: v.union(v.number(), v.null()),
      lastOutboundAt: v.union(v.number(), v.null()),
      windowExpiresAt: v.union(v.number(), v.null()),
      canSendFreeform: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const conversation = await ctx.db
      .query("whatsappConversations")
      .withIndex("by_org_phone", (q) =>
        q.eq("organizationId", auth.organizationId).eq("phoneNumber", args.phoneNumber)
      )
      .first()

    if (!conversation) {
      return null
    }

    const canSend = await canSendFreeform(ctx, auth.organizationId, args.phoneNumber)
    const { _creationTime, ...rest } = conversation

    return {
      ...rest,
      canSendFreeform: canSend,
    }
  },
})

export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const conversations = await ctx.db
      .query("whatsappConversations")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .take(args.limit ?? 50)

    return conversations
  },
})

export const linkConversationToEntity = mutation({
  args: {
    phoneNumber: v.string(),
    entityType: v.union(v.literal("guardian"), v.literal("teacher")),
    entityId: v.id("entities"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const conversation = await ctx.db
      .query("whatsappConversations")
      .withIndex("by_org_phone", (q) =>
        q.eq("organizationId", auth.organizationId).eq("phoneNumber", args.phoneNumber)
      )
      .first()

    if (!conversation) {
      throw new Error("Conversation not found")
    }

    const entity = await ctx.db.get(args.entityId)
    if (!entity || entity.organizationId !== auth.organizationId) {
      throw new Error("Entity not found")
    }

    await ctx.db.patch(conversation._id, {
      entityType: args.entityType,
      entityId: args.entityId,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const getConversationMessages = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_org_phone", (q) =>
        q.eq("organizationId", auth.organizationId).eq("phoneNumber", args.phoneNumber)
      )
      .order("desc")
      .take(args.limit ?? 50)

    return messages.reverse()
  },
})

export const listTemplates = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    let templates = await ctx.db
      .query("whatsappTemplates")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    if (args.status) {
      templates = templates.filter((t) => t.status === args.status)
    }

    return templates
  },
})

export const createTemplate = mutation({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.union(v.literal("UTILITY"), v.literal("MARKETING"), v.literal("AUTHENTICATION")),
    components: v.object({
      header: v.optional(v.object({
        type: v.union(v.literal("text"), v.literal("image"), v.literal("document")),
        text: v.optional(v.string()),
      })),
      body: v.object({
        text: v.string(),
        variables: v.array(v.string()),
      }),
      footer: v.optional(v.object({
        text: v.string(),
      })),
      buttons: v.optional(v.array(v.object({
        type: v.union(v.literal("url"), v.literal("quick_reply")),
        text: v.string(),
        url: v.optional(v.string()),
      }))),
    }),
  },
  returns: v.id("whatsappTemplates"),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    const existing = await ctx.db
      .query("whatsappTemplates")
      .withIndex("by_org_name", (q) =>
        q.eq("organizationId", auth.organizationId).eq("name", args.name)
      )
      .first()

    if (existing) {
      throw new Error(`Template with name "${args.name}" already exists`)
    }

    const now = Date.now()
    const templateId = await ctx.db.insert("whatsappTemplates", {
      organizationId: auth.organizationId,
      name: args.name,
      language: args.language,
      status: "pending",
      category: args.category,
      components: args.components,
      metaTemplateId: null,
      approvedAt: null,
      rejectedReason: null,
      createdAt: now,
      updatedAt: now,
    })

    return templateId
  },
})
