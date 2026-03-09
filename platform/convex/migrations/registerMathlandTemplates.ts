import { internalMutation } from "../_generated/server"
import { Id } from "../_generated/dataModel"

const MATHLAND_ORG_ID = "kn7eebv678rtbtmcyjqtwwdtpd80ewxw" as Id<"organizations">

const TEMPLATES = [
  "session_completed_notification",
  "session_teacher_notification",
  "session_reminder",
  "session_student_confirmation",
  "low_classes_guardian_alert",
  "teacher_class_confirmation",
]

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const registered: string[] = []

    for (const name of TEMPLATES) {
      const existing = await ctx.db
        .query("whatsappOwnedTemplates")
        .withIndex("by_org_name", (q) =>
          q.eq("organizationId", MATHLAND_ORG_ID).eq("templateName", name)
        )
        .first()

      if (existing) continue

      await ctx.db.insert("whatsappOwnedTemplates", {
        organizationId: MATHLAND_ORG_ID,
        templateName: name,
        createdAt: Date.now(),
      })
      registered.push(name)
    }

    return { registered }
  },
})
