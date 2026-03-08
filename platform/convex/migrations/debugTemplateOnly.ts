import { query } from "../_generated/server"
import { v } from "convex/values"

export const checkTools = query({
  args: { agentSlug: v.string() },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query("agents").collect()
    const agent = agents.find((a) => a.slug === args.agentSlug)
    if (!agent) return { error: "Agent not found", slugs: agents.map((a) => a.slug) }

    const configs = await ctx.db
      .query("agentConfigs")
      .withIndex("by_agent_env", (q) => q.eq("agentId", agent._id))
      .collect()

    return configs.map((c) => ({
      environment: c.environment,
      tools: (c.tools as any[]).map((t) => ({
        name: t.name,
        templateOnly: t.templateOnly,
        hasHandlerCode: !!t.handlerCode,
      })),
    }))
  },
})
