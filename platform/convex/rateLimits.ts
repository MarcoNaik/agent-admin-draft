import { defineRateLimits } from "convex-helpers/server/rateLimit"
import { internalMutation } from "./_generated/server"
import { v } from "convex/values"

const MINUTE = 60_000

const { rateLimit } = defineRateLimits({
  chatPerKey: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
  chatPerOrg: { kind: "token bucket", rate: 100, period: MINUTE, capacity: 30 },
  authRefresh: { kind: "fixed window", rate: 20, period: MINUTE },
})

export const checkChatRateLimit = internalMutation({
  args: {
    key: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const perKey = await rateLimit(ctx, { name: "chatPerKey", key: args.key })
    if (!perKey.ok) {
      return { ok: false as const, retryAt: perKey.retryAt }
    }

    const perOrg = await rateLimit(ctx, { name: "chatPerOrg", key: args.organizationId })
    if (!perOrg.ok) {
      return { ok: false as const, retryAt: perOrg.retryAt }
    }

    return { ok: true as const, retryAt: undefined }
  },
})

export const checkAuthRefreshLimit = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await rateLimit(ctx, { name: "authRefresh", key: args.key })
    if (!result.ok) {
      return { ok: false as const, retryAt: result.retryAt }
    }
    return { ok: true as const, retryAt: undefined }
  },
})
