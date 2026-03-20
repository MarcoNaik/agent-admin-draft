"use node"

import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { makeFunctionReference } from "convex/server"

const allConnectionsRef = makeFunctionReference<"query">("migrations/syncKapsoTemplatesHelper:allConnections")
const patchThreadRef = makeFunctionReference<"mutation">("migrations/backfillContactNamesHelper:patchThread")

export const run = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const apiKey = process.env.KAPSO_API_KEY
    if (!apiKey) return { error: "KAPSO_API_KEY not set" }

    const connections = await ctx.runQuery(allConnectionsRef, {}) as any[]
    let updated = 0
    let skipped = 0
    let notFound = 0

    for (const conn of connections) {
      const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${conn.kapsoPhoneNumberId}/contacts?limit=100`
      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey },
      })
      const data = await response.json() as any

      if (!data.data) continue

      for (const contact of data.data) {
        if (!contact.profile_name || !contact.wa_id) {
          skipped++
          continue
        }

        const externalId = `whatsapp:${conn._id}:${contact.wa_id}`
        const patched = await ctx.runMutation(patchThreadRef, {
          externalId,
          contactName: contact.profile_name,
        })

        if (patched) {
          updated++
        } else {
          notFound++
        }
      }
    }

    return { updated, skipped, notFound, connections: connections.length }
  },
})
