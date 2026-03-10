import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

export const patchPhone = internalMutation({
  args: {
    connectionId: v.id("whatsappConnections"),
    phoneNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, { phoneNumber: args.phoneNumber })
    return null
  },
})
