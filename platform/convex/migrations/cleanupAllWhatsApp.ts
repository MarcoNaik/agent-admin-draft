import { internalMutation } from "../_generated/server"

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db.query("whatsappConnections").collect()
    for (const conn of connections) {
      await ctx.db.delete(conn._id)
    }

    const messages = await ctx.db.query("whatsappMessages").collect()
    for (const msg of messages) {
      await ctx.db.delete(msg._id)
    }

    const templates = await ctx.db.query("whatsappOwnedTemplates").collect()
    for (const tpl of templates) {
      await ctx.db.delete(tpl._id)
    }

    const configs = await ctx.db
      .query("integrationConfigs")
      .withIndex("by_provider", (q) => q.eq("provider", "whatsapp"))
      .collect()
    for (const cfg of configs) {
      await ctx.db.delete(cfg._id)
    }

    return {
      connections: connections.length,
      messages: messages.length,
      templates: templates.length,
      configs: configs.length,
    }
  },
})
