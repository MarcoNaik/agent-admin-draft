import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { getAuthContext, requireAuth } from "./lib/auth"
import { ActorContext, ActorType, buildSystemActorContext } from "./lib/permissions"
import { handleSessionReminder } from "./jobs/sessionReminder"
import { handleSessionFollowup } from "./jobs/sessionFollowup"

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
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    if (args.status) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", auth.organizationId).eq("status", args.status!)
        )
        .order("desc")
        .take(args.limit ?? 50)

      if (args.jobType) {
        const filteredJobs: typeof jobs = []
        for (const j of jobs) {
          if (j.jobType === args.jobType) {
            filteredJobs.push(j)
          }
        }
        return filteredJobs
      }

      return jobs
    }

    const allJobs = await ctx.db
      .query("jobs")
      .withIndex("by_org_status", (q) => q.eq("organizationId", auth.organizationId))
      .order("desc")
      .take(args.limit ?? 50)

    if (args.jobType) {
      const filteredJobs: typeof allJobs = []
      for (const j of allJobs) {
        if (j.jobType === args.jobType) {
          filteredJobs.push(j)
        }
      }
      return filteredJobs
    }

    return allJobs
  },
})

export const get = query({
  args: { id: v.id("jobs") },
  returns: v.union(v.any(), v.null()),
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
  returns: v.object({
    id: v.id("jobs"),
    existing: v.boolean(),
  }),
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

    let roleIds: Id<"roles">[] = []
    if (auth.userId) {
      const userRoles = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", auth.userId))
        .filter((q) =>
          q.or(
            q.eq(q.field("expiresAt"), undefined),
            q.gt(q.field("expiresAt"), Date.now())
          )
        )
        .collect()

      for (const ur of userRoles) {
        const role = await ctx.db.get(ur.roleId)
        if (role && role.organizationId === auth.organizationId) {
          roleIds.push(ur.roleId)
        }
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
      actorContext: auth.userId
        ? {
            actorType: "user",
            actorId: auth.userId,
            roleIds: roleIds.map((id) => id.toString()),
          }
        : undefined,
    })

    const delay = Math.max(0, scheduledFor - now)
    await ctx.scheduler.runAfter(delay, internal.jobs.execute, { jobId })

    return { id: jobId, existing: false }
  },
})

export const execute = internalMutation({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job) return null

    if (job.status !== "pending") {
      return null
    }

    const now = Date.now()

    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: now,
      attempts: job.attempts + 1,
    })

    let actor: ActorContext
    if (job.actorContext) {
      actor = {
        organizationId: job.organizationId,
        actorType: job.actorContext.actorType as ActorType,
        actorId: job.actorContext.actorId,
        roleIds: job.actorContext.roleIds.map((id) => id as Id<"roles">),
      }
    } else {
      actor = buildSystemActorContext(job.organizationId)
    }

    try {
      const result = await executeJobHandler(ctx, actor, job)

      await ctx.db.patch(args.jobId, {
        status: "completed",
        result,
        completedAt: Date.now(),
      })

      await ctx.db.insert("events", {
        organizationId: job.organizationId,
        entityId: job.entityId,
        eventType: "job.completed",
        schemaVersion: 1,
        payload: { jobType: job.jobType, result },
        actorId: actor.actorId,
        actorType: actor.actorType,
        timestamp: Date.now(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const newAttempts = job.attempts + 1
      const shouldRetry = newAttempts < job.maxAttempts

      await ctx.db.patch(args.jobId, {
        status: shouldRetry ? "pending" : "dead",
        errorMessage,
      })

      await ctx.db.insert("events", {
        organizationId: job.organizationId,
        entityId: job.entityId,
        eventType: shouldRetry ? "job.failed" : "job.dead",
        schemaVersion: 1,
        payload: { jobType: job.jobType, errorMessage, attempts: newAttempts },
        actorId: actor.actorId,
        actorType: actor.actorType,
        timestamp: Date.now(),
      })

      if (shouldRetry) {
        const backoffMs = Math.min(60000 * Math.pow(2, newAttempts - 1), 3600000)
        await ctx.scheduler.runAfter(backoffMs, internal.jobs.execute, {
          jobId: args.jobId,
        })
      }
    }

    return null
  },
})

async function executeJobHandler(
  ctx: { db: any },
  actor: ActorContext,
  job: {
    jobType: string
    payload: Record<string, unknown>
    organizationId: Id<"organizations">
  }
): Promise<Record<string, unknown>> {
  switch (job.jobType) {
    case "session.reminder":
      return await handleSessionReminder(ctx as any, actor, job.payload as any)

    case "session.followup":
      return await handleSessionFollowup(ctx as any, actor, job.payload as any)

    case "entity.process":
      return { processed: true, entityId: job.payload.entityId, executedBy: actor.actorId }

    case "notification.send":
      return { sent: true, channel: job.payload.channel, executedBy: actor.actorId }

    case "cleanup.expired":
      return { cleaned: true, executedBy: actor.actorId }

    default:
      return { executed: true, jobType: job.jobType, executedBy: actor.actorId }
  }
}

export const retry = mutation({
  args: { id: v.id("jobs") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx)
    const job = await ctx.db.get(args.id)

    if (!job || job.organizationId !== auth.organizationId) {
      throw new Error("Job not found")
    }

    if (job.status !== "failed" && job.status !== "dead") {
      throw new Error("Can only retry failed or dead jobs")
    }

    let roleIds: Id<"roles">[] = []
    if (auth.userId) {
      const userRoles = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", auth.userId))
        .filter((q) =>
          q.or(
            q.eq(q.field("expiresAt"), undefined),
            q.gt(q.field("expiresAt"), Date.now())
          )
        )
        .collect()

      for (const ur of userRoles) {
        const role = await ctx.db.get(ur.roleId)
        if (role && role.organizationId === auth.organizationId) {
          roleIds.push(ur.roleId)
        }
      }
    }

    await ctx.db.patch(args.id, {
      status: "pending",
      attempts: 0,
      errorMessage: undefined,
      scheduledFor: Date.now(),
      actorContext: auth.userId
        ? {
            actorType: "user",
            actorId: auth.userId,
            roleIds: roleIds.map((id) => id.toString()),
          }
        : undefined,
    })

    await ctx.scheduler.runAfter(0, internal.jobs.execute, { jobId: args.id })

    return { success: true }
  },
})

export const cancel = mutation({
  args: { id: v.id("jobs") },
  returns: v.object({ success: v.boolean() }),
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
  returns: v.record(v.string(), v.number()),
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
