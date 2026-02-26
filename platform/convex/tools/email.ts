import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"
import { sendEmail } from "../lib/integrations/resend"

const environmentValidator = v.union(v.literal("development"), v.literal("production"), v.literal("eval"))

type Environment = "development" | "production" | "eval"

const DEFAULT_FROM_EMAIL = "noreply@mail.struere.dev"
const DEFAULT_FROM_NAME = "Struere"

async function resolveFromConfig(
  ctx: any,
  organizationId: Id<"organizations">,
  environment: Environment
): Promise<{ fromEmail: string; fromName?: string; replyTo?: string }> {
  const config = await ctx.runQuery(internal.integrations.getConfigInternal, {
    organizationId,
    environment,
    provider: "resend" as const,
  })

  if (config?.status === "active" && config.config) {
    const cfg = config.config as { fromName?: string; replyTo?: string }
    return {
      fromEmail: DEFAULT_FROM_EMAIL,
      fromName: cfg.fromName,
      replyTo: cfg.replyTo,
    }
  }

  return { fromEmail: DEFAULT_FROM_EMAIL }
}

function formatFrom(email: string, name?: string): string {
  if (name) return `${name} <${email}>`
  return email
}

export const emailSend = internalAction({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    actorType: v.string(),
    environment: environmentValidator,
    to: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.html && !args.text) {
      throw new Error("email.send requires either 'html' or 'text' parameter")
    }

    const fromConfig = await resolveFromConfig(ctx, args.organizationId, args.environment as Environment)
    const from = formatFrom(fromConfig.fromEmail, fromConfig.fromName)
    const replyTo = args.replyTo || fromConfig.replyTo

    const result = await sendEmail({
      to: args.to,
      from,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo,
    })

    await ctx.runMutation(internal.email.storeOutboundEmail, {
      organizationId: args.organizationId,
      environment: args.environment,
      to: args.to,
      from,
      subject: args.subject,
      resendId: result.id,
    })

    return {
      resendId: result.id,
      to: args.to,
      subject: args.subject,
      status: "sent",
    }
  },
})
