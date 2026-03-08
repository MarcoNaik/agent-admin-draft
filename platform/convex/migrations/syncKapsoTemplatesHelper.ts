import { internalQuery } from "../_generated/server"

export const allConnections = internalQuery({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db.query("whatsappConnections").collect()
    return connections.filter((c) => c.status === "connected" && c.kapsoPhoneNumberId)
  },
})

export const debugAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db.query("whatsappConnections").collect()
    const orgs = await ctx.db.query("organizations").collect()
    const ownedTemplates = await ctx.db.query("whatsappOwnedTemplates").collect()
    return {
      connections: connections.map((c) => ({
        id: c._id,
        org: c.organizationId,
        env: c.environment,
        status: c.status,
        kapsoPhoneNumberId: c.kapsoPhoneNumberId,
        phoneNumber: c.phoneNumber,
        label: c.label,
      })),
      orgs: orgs.map((o) => ({ id: o._id, name: o.name, slug: o.slug })),
      ownedTemplates,
    }
  },
})
