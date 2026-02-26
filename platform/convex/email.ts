import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

const MARKUP = 1.1
const COST_PER_EMAIL_MICRODOLLARS = Math.round(900 * MARKUP)

export const storeOutboundEmail = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    environment: environmentValidator,
    to: v.string(),
    from: v.string(),
    subject: v.string(),
    resendId: v.string(),
  },
  returns: v.id("emailMessages"),
  handler: async (ctx, args) => {
    const cost = COST_PER_EMAIL_MICRODOLLARS

    const id = await ctx.db.insert("emailMessages", {
      organizationId: args.organizationId,
      environment: args.environment,
      direction: "outbound",
      to: args.to,
      from: args.from,
      subject: args.subject,
      resendId: args.resendId,
      status: "sent",
      creditsConsumed: cost,
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.billing.deductCredits, {
      organizationId: args.organizationId,
      amount: cost,
      description: `Email to ${args.to}`,
      metadata: { emailMessageId: id },
    })

    return id
  },
})

export const updateEmailStatus = internalMutation({
  args: {
    resendId: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("failed")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const msg = await ctx.db
      .query("emailMessages")
      .withIndex("by_resend_id", (q) => q.eq("resendId", args.resendId))
      .first()

    if (msg) {
      await ctx.db.patch(msg._id, {
        status: args.status,
        updatedAt: Date.now(),
      })
    }

    return null
  },
})
