import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { getAuthContext, requireAuth } from "./lib/auth"

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("claimed"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("dead")
      )
    ),
    jobType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    if (args.status) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", auth.organizationId).eq("status", args.status!)
        )
        .order("desc")
        .take(args.limit ?? 50)
    }

    const jobs = await ctx.db
      .query("jobs")
      .filter((q) => q.eq(q.field("organizationId"), auth.organizationId))
      .order("desc")
      .take(args.limit ?? 50)

    if (args.jobType) {
      return jobs.filter((j) => j.jobType === args.jobType)
    }

    return jobs
  },
})

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)
    const job = await ctx.db.get(args.id)

    if (!job || job.organizationId !== auth.organizationId) {
      return null
    }

    return job
  },
})

export const enqueue = mutation({
  args: {
    jobType: v.string(),
    payload: v.any(),
    scheduledFor: v.optional(v.number()),
    priority: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
    entityId: v.optional(v.id("entities")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)

    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_idempotency", (q) =>
          q
            .eq("organizationId", auth.organizationId)
            .eq("idempotencyKey", args.idempotencyKey)
        )
        .first()

      if (existing) {
        return { id: existing._id, existing: true }
      }
    }

    const now = Date.now()
    const scheduledFor = args.scheduledFor ?? now

    const jobId = await ctx.db.insert("jobs", {
      organizationId: auth.organizationId,
      entityId: args.entityId,
      jobType: args.jobType,
      idempotencyKey: args.idempotencyKey,
      status: "pending",
      priority: args.priority ?? 0,
      payload: args.payload,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? 3,
      scheduledFor,
      createdAt: now,
    })

    const delay = Math.max(0, scheduledFor - now)
    await ctx.scheduler.runAfter(delay, internal.jobs.execute, { jobId })

    return { id: jobId, existing: false }
  },
})

export const execute = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job) return

    if (job.status !== "pending") {
      return
    }

    const now = Date.now()

    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: now,
      attempts: job.attempts + 1,
    })

    try {
      const result = await executeJobHandler(ctx, job)

      await ctx.db.patch(args.jobId, {
        status: "completed",
        result,
        completedAt: Date.now(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const newAttempts = job.attempts + 1
      const shouldRetry = newAttempts < job.maxAttempts

      await ctx.db.patch(args.jobId, {
        status: shouldRetry ? "pending" : "dead",
        errorMessage,
      })

      if (shouldRetry) {
        const backoffMs = Math.min(60000 * Math.pow(2, newAttempts - 1), 3600000)
        await ctx.scheduler.runAfter(backoffMs, internal.jobs.execute, {
          jobId: args.jobId,
        })
      }
    }
  },
})

async function executeJobHandler(
  ctx: { db: any },
  job: {
    jobType: string
    payload: Record<string, unknown>
    organizationId: any
  }
): Promise<Record<string, unknown>> {
  switch (job.jobType) {
    case "entity.process":
      return { processed: true, entityId: job.payload.entityId }

    case "notification.send":
      return { sent: true, channel: job.payload.channel }

    case "cleanup.expired":
      return { cleaned: true }

    default:
      return { executed: true, jobType: job.jobType }
  }
}

export const retry = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const job = await ctx.db.get(args.id)

    if (!job || job.organizationId !== auth.organizationId) {
      throw new Error("Job not found")
    }

    if (job.status !== "failed" && job.status !== "dead") {
      throw new Error("Can only retry failed or dead jobs")
    }

    await ctx.db.patch(args.id, {
      status: "pending",
      attempts: 0,
      errorMessage: undefined,
      scheduledFor: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.jobs.execute, { jobId: args.id })

    return { success: true }
  },
})

export const cancel = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const job = await ctx.db.get(args.id)

    if (!job || job.organizationId !== auth.organizationId) {
      throw new Error("Job not found")
    }

    if (job.status === "completed" || job.status === "dead") {
      throw new Error("Cannot cancel completed or dead jobs")
    }

    await ctx.db.patch(args.id, {
      status: "dead",
      errorMessage: "Cancelled by user",
      completedAt: Date.now(),
    })

    return { success: true }
  },
})

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)

    const statuses = ["pending", "claimed", "running", "completed", "failed", "dead"] as const
    const stats: Record<string, number> = {}

    for (const status of statuses) {
      const count = await ctx.db
        .query("jobs")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", auth.organizationId).eq("status", status)
        )
        .collect()

      stats[status] = count.length
    }

    return stats
  },
})
