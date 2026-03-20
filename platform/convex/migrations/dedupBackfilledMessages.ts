import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

export const run = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    checked: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 200
    let deleted = 0

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_externalMessageId")
      .order("asc")
      .take(batchSize)

    const grouped = new Map<string, Array<{ _id: any; createdAt: number; channelData?: unknown; direction?: string }>>()

    for (const msg of messages) {
      if (!msg.externalMessageId) continue
      const key = `${msg.threadId}:${msg.externalMessageId}:${msg.role}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(msg)
    }

    for (const [, dupes] of grouped) {
      if (dupes.length <= 1) continue

      dupes.sort((a, b) => {
        const aHasChannel = a.channelData || a.direction
        const bHasChannel = b.channelData || b.direction
        if (aHasChannel && !bHasChannel) return -1
        if (!aHasChannel && bHasChannel) return 1
        return a.createdAt - b.createdAt
      })

      for (let i = 1; i < dupes.length; i++) {
        await ctx.db.delete(dupes[i]._id)
        deleted++
      }
    }

    return {
      deleted,
      checked: messages.length,
      done: messages.length < batchSize,
    }
  },
})
