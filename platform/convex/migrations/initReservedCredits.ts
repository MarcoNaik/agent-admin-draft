import { internalMutation } from "../_generated/server"

export const run = internalMutation({
  handler: async (ctx) => {
    const balances = await ctx.db.query("creditBalances").collect()
    for (const balance of balances) {
      if (balance.reservedCredits === undefined) {
        await ctx.db.patch(balance._id, { reservedCredits: 0 })
      }
    }
  },
})
