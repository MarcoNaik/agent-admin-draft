import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

export const patchThread = internalMutation({
  args: {
    externalId: v.string(),
    contactName: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_external", (q) => q.eq("externalId", args.externalId))
      .first()

    if (!thread) return false

    const existing = (thread.channelParams ?? {}) as Record<string, unknown>
    await ctx.db.patch(thread._id, {
      channelParams: { ...existing, contactName: args.contactName },
    })
    return true
  },
})
