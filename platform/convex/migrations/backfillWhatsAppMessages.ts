import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { Id } from "../_generated/dataModel"

export const run = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    skipped: v.number(),
    cursor: v.optional(v.string()),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 50
    let processed = 0
    let skipped = 0

    const allMessages = await ctx.db
      .query("whatsappMessages")
      .order("asc")
      .take(batchSize + 1)

    const messages = allMessages.slice(0, batchSize)
    const hasMore = allMessages.length > batchSize

    for (const waMsg of messages) {
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_externalMessageId", (q) => q.eq("externalMessageId", waMsg.messageId))
        .first()

      if (existing) {
        skipped++
        continue
      }

      let threadId: Id<"threads"> | undefined

      if (waMsg.threadId) {
        threadId = waMsg.threadId
      } else if (waMsg.connectionId) {
        const externalId = `whatsapp:${waMsg.connectionId}:${waMsg.phoneNumber}`
        const thread = await ctx.db
          .query("threads")
          .withIndex("by_external", (q) => q.eq("externalId", externalId))
          .first()
        if (thread) {
          threadId = thread._id
        }
      }

      if (!threadId) {
        skipped++
        continue
      }

      const role = waMsg.direction === "inbound" ? "user" : "assistant"
      const channelData: Record<string, unknown> = {}
      if (waMsg.type) channelData.type = waMsg.type
      if (waMsg.mediaStorageId) channelData.mediaStorageId = waMsg.mediaStorageId
      if (waMsg.mediaMimeType) channelData.mediaMimeType = waMsg.mediaMimeType
      if (waMsg.mediaFileName) channelData.mediaFileName = waMsg.mediaFileName
      if (waMsg.mediaCaption) channelData.mediaCaption = waMsg.mediaCaption
      if (waMsg.mediaDirectUrl) channelData.mediaDirectUrl = waMsg.mediaDirectUrl
      if (waMsg.interactiveData) channelData.interactiveData = waMsg.interactiveData
      if (waMsg.connectionId) channelData.connectionId = waMsg.connectionId
      if (waMsg.pricingBillable !== undefined) channelData.pricingBillable = waMsg.pricingBillable
      if (waMsg.pricingModel) channelData.pricingModel = waMsg.pricingModel
      if (waMsg.pricingCategory) channelData.pricingCategory = waMsg.pricingCategory
      if (waMsg.creditsConsumed) channelData.creditsConsumed = waMsg.creditsConsumed

      await ctx.db.insert("messages", {
        threadId,
        organizationId: waMsg.organizationId,
        role: role as "user" | "assistant",
        content: waMsg.text ?? "",
        externalMessageId: waMsg.messageId,
        direction: waMsg.direction as "inbound" | "outbound",
        status: waMsg.status as "sent" | "delivered" | "read" | "failed" | "received",
        channelData: Object.keys(channelData).length > 0 ? channelData : undefined,
        createdAt: waMsg.createdAt,
      })

      processed++
    }

    return {
      processed,
      skipped,
      cursor: hasMore ? messages[messages.length - 1]?._id : undefined,
      done: !hasMore,
    }
  },
})
