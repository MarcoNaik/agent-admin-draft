import { internalMutation } from "../_generated/server"

const BATCH_SIZE = 100

export const cleanupOldMessages = internalMutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    const oldMessages = await ctx.db
      .query("messages")
      .order("asc")
      .take(BATCH_SIZE * 10)

    let deleted = 0
    for (const msg of oldMessages) {
      if (msg.createdAt < cutoff && deleted < BATCH_SIZE) {
        await ctx.db.delete(msg._id)
        deleted++
      }
    }
  },
})

export const cleanupOldExecutions = internalMutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    const oldExecutions = await ctx.db
      .query("executions")
      .withIndex("by_timestamp")
      .order("asc")
      .take(BATCH_SIZE * 10)

    let deleted = 0
    for (const exec of oldExecutions) {
      if (exec.createdAt < cutoff && deleted < BATCH_SIZE) {
        await ctx.db.delete(exec._id)
        deleted++
      }
    }
  },
})

export const cleanupOldEvents = internalMutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000
    const oldEvents = await ctx.db
      .query("events")
      .order("asc")
      .take(BATCH_SIZE * 10)

    let deleted = 0
    for (const event of oldEvents) {
      if (event.timestamp < cutoff && deleted < BATCH_SIZE) {
        await ctx.db.delete(event._id)
        deleted++
      }
    }
  },
})
