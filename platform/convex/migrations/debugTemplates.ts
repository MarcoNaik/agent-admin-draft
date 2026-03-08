import { internalQuery } from "../_generated/server"

export const findOrg = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect()
    const allConnections = await ctx.db.query("whatsappConnections").collect()
    const allOwnedTemplates = await ctx.db.query("whatsappOwnedTemplates").collect()

    return {
      orgs: orgs.map((o) => ({ id: o._id, name: o.name, slug: o.slug })),
      connections: allConnections.map((c) => ({
        id: c._id,
        org: c.organizationId,
        env: c.environment,
        status: c.status,
        kapsoPhoneId: c.kapsoPhoneNumberId ?? "NONE",
        phone: c.phoneNumber ?? "NONE",
        label: c.label ?? "NONE",
      })),
      ownedTemplates: allOwnedTemplates,
    }
  },
})
