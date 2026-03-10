"use node"

import { internalAction } from "../_generated/server"
import { makeFunctionReference } from "convex/server"
import { Id } from "../_generated/dataModel"

const allConnectionsRef = makeFunctionReference<"query">("migrations/syncKapsoTemplatesHelper:allConnections")
const patchConnectionRef = makeFunctionReference<"mutation">("migrations/backfillPhoneNumbersHelper:patchPhone")

const KAPSO_BASE_URL = "https://api.kapso.ai/platform/v1"

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.KAPSO_API_KEY
    if (!apiKey) throw new Error("KAPSO_API_KEY not configured")

    const connections = await ctx.runQuery(allConnectionsRef, {}) as Array<{
      _id: Id<"whatsappConnections">
      kapsoPhoneNumberId: string
      phoneNumber?: string
    }>

    const results: Array<{ id: string; phone: string }> = []

    for (const conn of connections) {
      if (conn.phoneNumber) continue

      const response = await fetch(
        `${KAPSO_BASE_URL}/whatsapp/phone_numbers?phone_number_id=${encodeURIComponent(conn.kapsoPhoneNumberId)}`,
        { headers: { "X-API-Key": apiKey } }
      )

      if (!response.ok) continue

      const json = (await response.json()) as { data: Array<{ display_phone_number?: string }> }
      const displayPhone = json.data?.[0]?.display_phone_number

      if (displayPhone) {
        await ctx.runMutation(patchConnectionRef, {
          connectionId: conn._id,
          phoneNumber: displayPhone,
        })
        results.push({ id: conn._id, phone: displayPhone })
      }
    }

    return results
  },
})
