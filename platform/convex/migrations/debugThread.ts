import { v } from "convex/values"
import { internalQuery } from "../_generated/server"

export const inspect = internalQuery({
  args: { phoneNumber: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const allThreads = await ctx.db.query("threads").collect()
    const matchingThreads = allThreads.filter((t) =>
      t.externalId?.includes(args.phoneNumber)
    )

    const results = []
    for (const thread of matchingThreads) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .order("asc")
        .collect()

      const summary = messages.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content?.substring(0, 80),
        direction: m.direction,
        status: m.status,
        externalMessageId: m.externalMessageId,
        hasChannelData: !!m.channelData,
        hasToolCalls: !!m.toolCalls?.length,
        toolCallId: m.toolCallId,
        createdAt: m.createdAt,
      }))

      results.push({
        threadId: thread._id,
        externalId: thread.externalId,
        channel: thread.channel,
        environment: thread.environment,
        agentId: thread.agentId,
        totalMessages: messages.length,
        messages: summary,
      })
    }

    return { threadCount: results.length, threads: results }
  },
})
