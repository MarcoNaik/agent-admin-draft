import { internalMutation } from "../_generated/server"
import { v } from "convex/values"

export const run = internalMutation({
  args: {},
  returns: v.object({
    threadsUpdated: v.number(),
    messagesUpdated: v.number(),
    configsUpdated: v.number(),
  }),
  handler: async (ctx) => {
    let threadsUpdated = 0
    let messagesUpdated = 0
    let configsUpdated = 0

    const connections = await ctx.db.query("whatsappConnections").collect()

    const orgEnvToConnection = new Map<string, typeof connections[number]>()
    for (const conn of connections) {
      const key = `${conn.organizationId}:${conn.environment}`
      if (!orgEnvToConnection.has(key)) {
        orgEnvToConnection.set(key, conn)
      }
    }

    for (const conn of connections) {
      const integrationConfig = await ctx.db
        .query("integrationConfigs")
        .withIndex("by_org_env_provider", (q) =>
          q
            .eq("organizationId", conn.organizationId)
            .eq("environment", conn.environment)
            .eq("provider", "whatsapp")
        )
        .first()

      if (integrationConfig) {
        const config = (integrationConfig.config ?? {}) as Record<string, unknown>
        if (!config.kapsoCustomerId) {
          await ctx.db.patch(integrationConfig._id, {
            config: { ...config, kapsoCustomerId: conn.kapsoCustomerId },
            updatedAt: Date.now(),
          })
          configsUpdated++
        }
      }
    }

    const threads = await ctx.db.query("threads").collect()
    for (const thread of threads) {
      if (!thread.externalId) continue
      const match = thread.externalId.match(/^whatsapp:([^:]+)$/)
      if (!match) continue

      const phone = match[1]
      const key = `${thread.organizationId}:${thread.environment}`
      const conn = orgEnvToConnection.get(key)
      if (!conn) continue

      await ctx.db.patch(thread._id, {
        externalId: `whatsapp:${conn._id}:${phone}`,
      })
      threadsUpdated++
    }

    const messages = await ctx.db.query("whatsappMessages").collect()
    for (const msg of messages) {
      if (msg.connectionId) continue

      let conn: typeof connections[number] | undefined
      for (const c of connections) {
        if (c.organizationId === msg.organizationId) {
          conn = c
          break
        }
      }
      if (!conn) continue

      await ctx.db.patch(msg._id, { connectionId: conn._id })
      messagesUpdated++
    }

    return { threadsUpdated, messagesUpdated, configsUpdated }
  },
})
