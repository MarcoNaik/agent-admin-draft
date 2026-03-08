"use node"

import { internalAction } from "../_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "../_generated/dataModel"
import { listPhoneTemplates } from "../lib/integrations/kapso"

const registerOwnedTemplateRef = makeFunctionReference<"mutation">("whatsapp:registerOwnedTemplate")
const allConnectionsRef = makeFunctionReference<"query">("migrations/syncKapsoTemplatesHelper:allConnections")

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.runQuery(allConnectionsRef, {})
    const results: Array<{ org: string; phone: string; registered: string[] }> = []

    for (const conn of connections as Array<{ _id: string; organizationId: string; kapsoPhoneNumberId: string }>) {
      if (!conn.kapsoPhoneNumberId) continue

      const allTemplates = await listPhoneTemplates(conn.kapsoPhoneNumberId) as { data?: Array<{ name: string }> }
      const names = allTemplates?.data?.map((t) => t.name) ?? []

      for (const name of names) {
        await ctx.runMutation(registerOwnedTemplateRef, {
          organizationId: conn.organizationId as Id<"organizations">,
          templateName: name,
        })
      }

      results.push({ org: conn.organizationId, phone: conn.kapsoPhoneNumberId, registered: names })
    }

    return results
  },
})
