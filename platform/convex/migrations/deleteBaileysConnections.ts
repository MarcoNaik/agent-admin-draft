import { internalMutation } from "../_generated/server"

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db.query("whatsappConnections").collect()
    let deleted = 0
    const found = []

    for (const conn of connections) {
      found.push({ id: conn._id, status: conn.status, hasKapso: !!(conn as any).kapsoCustomerId })
      if (!(conn as any).kapsoCustomerId) {
        await ctx.db.delete(conn._id)
        deleted++
      }
    }

    return { total: connections.length, deleted, found }
  },
})
