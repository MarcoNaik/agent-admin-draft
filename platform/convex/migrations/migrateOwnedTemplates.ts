import { internalMutation } from "../_generated/server"

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db.query("integrationConfigs").collect()
    const whatsappConfigs = configs.filter((c) => c.provider === "whatsapp")

    const seen = new Set<string>()
    let inserted = 0

    for (const config of whatsappConfigs) {
      const ownedNames = ((config.config as Record<string, unknown>)?.ownedTemplateNames as string[]) ?? []
      for (const name of ownedNames) {
        const key = `${config.organizationId}:${name}`
        if (seen.has(key)) continue
        seen.add(key)

        const existing = await ctx.db
          .query("whatsappOwnedTemplates")
          .withIndex("by_org_name", (q) =>
            q.eq("organizationId", config.organizationId).eq("templateName", name)
          )
          .first()

        if (!existing) {
          await ctx.db.insert("whatsappOwnedTemplates", {
            organizationId: config.organizationId,
            templateName: name,
            createdAt: Date.now(),
          })
          inserted++
        }
      }

      const { ownedTemplateNames: _, ...rest } = (config.config as Record<string, unknown>)
      await ctx.db.patch(config._id, { config: rest })
    }

    return { migrated: inserted, configsCleaned: whatsappConfigs.length }
  },
})
