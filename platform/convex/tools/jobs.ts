import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"

export const jobEnqueue = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    jobType: v.string(),
    payload: v.any(),
    scheduledFor: v.optional(v.number()),
    priority: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_idempotency", (q) =>
          q
            .eq("organizationId", args.organizationId)
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
      organizationId: args.organizationId,
      entityId: args.entityId as Id<"entities"> | undefined,
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

export const jobStatus = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id as Id<"jobs">)

    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Job not found")
    }

    return {
      id: job._id,
      jobType: job.jobType,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      result: job.result,
      errorMessage: job.errorMessage,
      scheduledFor: job.scheduledFor,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    }
  },
})
