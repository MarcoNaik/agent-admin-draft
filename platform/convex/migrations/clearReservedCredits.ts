import { internalMutation } from "../_generated/server"

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const balances = await ctx.db.query("creditBalances").collect()
    let cleared = 0
    for (const bal of balances) {
      if ((bal as any).reservedCredits) {
        await ctx.db.patch(bal._id, { reservedCredits: undefined } as any)
        cleared++
      }
    }
    return { cleared }
  },
})
