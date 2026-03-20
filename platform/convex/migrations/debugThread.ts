"use node"

import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { makeFunctionReference } from "convex/server"

const allConnectionsRef = makeFunctionReference<"query">("migrations/syncKapsoTemplatesHelper:allConnections")

export const inspectContacts = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const apiKey = process.env.KAPSO_API_KEY
    if (!apiKey) return { error: "KAPSO_API_KEY not set" }

    const connections = await ctx.runQuery(allConnectionsRef, {}) as any[]

    const results = []
    for (const conn of connections) {
      const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${conn.kapsoPhoneNumberId}/contacts?limit=50`
      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey },
      })
      const data = await response.json() as any

      results.push({
        connectionId: conn._id,
        phoneNumber: conn.phoneNumber,
        kapsoPhoneNumberId: conn.kapsoPhoneNumberId,
        environment: conn.environment,
        contacts: (data.data || []).map((c: any) => ({
          wa_id: c.wa_id,
          profile_name: c.profile_name,
        })),
        error: data.error,
      })
    }

    return results
  },
})
