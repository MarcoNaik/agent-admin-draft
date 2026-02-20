import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"

function base64Encode(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const http = httpRouter()

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }),
})

http.route({
  path: "/v1/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const body = await request.json()
    const { agentId, message, threadId, externalThreadId } = body as {
      agentId: string
      message: string
      threadId?: string
      externalThreadId?: string
    }

    if (!agentId || !message) {
      return new Response(
        JSON.stringify({ error: "agentId and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    try {
      const result = await ctx.runAction(internal.agent.chat, {
        apiKey,
        agentId: agentId as Id<"agents">,
        message,
        threadId: threadId as Id<"threads"> | undefined,
        externalThreadId,
      })

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }),
})

http.route({
  pathPrefix: "/v1/agents/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    const slug = pathParts[3]

    const body = await request.json()
    const { message, threadId, externalThreadId } = body as {
      message: string
      threadId?: string
      externalThreadId?: string
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      const result = await ctx.runAction(internal.agent.chatBySlug, {
        apiKey,
        slug,
        message,
        threadId: threadId as Id<"threads"> | undefined,
        externalThreadId,
      })

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }),
})

http.route({
  path: "/webhook/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { type, data } = body as { type: string; data: unknown }

    try {
      switch (type) {
        case "user.created":
        case "user.updated": {
          const userData = data as {
            id: string
            email_addresses: Array<{ email_address: string }>
            first_name?: string
            last_name?: string
          }

          const email = userData.email_addresses[0]?.email_address
          const name = [userData.first_name, userData.last_name]
            .filter(Boolean)
            .join(" ")

          if (!email) break

          await ctx.runMutation(internal.users.getOrCreateFromClerkNoOrg, {
            clerkUserId: userData.id,
            email,
            name: name || undefined,
          })
          break
        }

        case "organization.created":
        case "organization.updated": {
          const orgData = data as {
            id: string
            name: string
            slug: string
          }

          await ctx.runMutation(internal.organizations.getOrCreateFromClerk, {
            clerkOrgId: orgData.id,
            name: orgData.name,
            slug: orgData.slug,
          })
          break
        }

        case "organization.deleted": {
          const orgData = data as { id: string }
          await ctx.runMutation(internal.organizations.markAsDeleted, {
            clerkOrgId: orgData.id,
          })
          break
        }

        case "organizationMembership.created":
        case "organizationMembership.updated": {
          const membershipData = data as {
            id: string
            organization: { id: string; name: string; slug: string }
            public_user_data: {
              user_id: string
              first_name?: string
              last_name?: string
              identifier?: string
            }
            role: string
          }

          await ctx.runMutation(internal.organizations.getOrCreateFromClerk, {
            clerkOrgId: membershipData.organization.id,
            name: membershipData.organization.name,
            slug: membershipData.organization.slug,
          })

          const role = membershipData.role === "org:admin" || membershipData.role === "org:owner"
            ? "admin" as const
            : "member" as const

          const userName = [
            membershipData.public_user_data.first_name,
            membershipData.public_user_data.last_name,
          ].filter(Boolean).join(" ") || undefined

          await ctx.runMutation(internal.organizations.syncMembership, {
            clerkOrgId: membershipData.organization.id,
            clerkUserId: membershipData.public_user_data.user_id,
            clerkMembershipId: membershipData.id,
            role,
            userEmail: membershipData.public_user_data.identifier,
            userName,
          })
          break
        }

        case "organizationMembership.deleted": {
          const membershipData = data as {
            organization: { id: string }
            public_user_data: { user_id: string }
          }

          await ctx.runMutation(internal.organizations.removeMembership, {
            clerkOrgId: membershipData.organization.id,
            clerkUserId: membershipData.public_user_data.user_id,
          })
          break
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("Webhook error:", error)
      return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }),
})

http.route({
  path: "/webhook/kapso/project",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text()
    const signature = request.headers.get("X-Kapso-Signature") ?? ""

    const secret = process.env.KAPSO_WEBHOOK_SECRET
    if (!secret) {
      return new Response("Webhook secret not configured", { status: 500 })
    }

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const sig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    )
    const expected = Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("")

    if (expected !== signature) {
      return new Response("Invalid signature", { status: 403 })
    }

    const event = JSON.parse(body) as {
      type: string
      data: {
        phone_number_id?: string
        phone_number?: string
        customer?: { external_customer_id?: string; id?: string }
      }
    }

    if (event.type === "whatsapp.phone_number.created") {
      const phoneNumberId = event.data.phone_number_id
      const kapsoCustomerId = event.data.customer?.id
      const phoneNumber = event.data.phone_number

      if (phoneNumberId && kapsoCustomerId) {
        await ctx.runMutation(internal.whatsapp.handlePhoneConnected, {
          kapsoCustomerId,
          kapsoPhoneNumberId: phoneNumberId,
          phoneNumber,
        })
      }
    }

    return new Response("OK", { status: 200 })
  }),
})

http.route({
  path: "/webhook/kapso/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text()
    const signature = request.headers.get("X-Kapso-Signature") ?? ""

    const secret = process.env.KAPSO_WEBHOOK_SECRET
    if (!secret) {
      return new Response("Webhook secret not configured", { status: 500 })
    }

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const sig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    )
    const expected = Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("")

    if (expected !== signature) {
      return new Response("Invalid signature", { status: 403 })
    }

    const event = JSON.parse(body) as {
      type: string
      data: {
        phone_number_id?: string
        from?: string
        message_id?: string
        timestamp?: number
        type?: string
        text?: { body?: string }
        contacts?: Array<{ profile?: { name?: string } }>
        status?: string
        image?: { id?: string; caption?: string }
        audio?: { id?: string }
        video?: { id?: string; caption?: string }
        document?: { id?: string; filename?: string; caption?: string }
        interactive?: Record<string, unknown>
      }
    }

    if (event.type === "whatsapp.message.received") {
      const phoneNumberId = event.data.phone_number_id
      if (!phoneNumberId) {
        return new Response("Missing phone_number_id", { status: 400 })
      }

      const connection = await ctx.runQuery(internal.whatsapp.getConnectionByKapsoPhone, {
        kapsoPhoneNumberId: phoneNumberId,
      }) as { _id: Id<"whatsappConnections">; organizationId: Id<"organizations">; environment: "development" | "production" } | null

      if (!connection) {
        return new Response("Unknown phone number", { status: 404 })
      }

      const from = event.data.from ?? ""
      const messageId = event.data.message_id ?? `kapso_${Date.now()}`
      const timestamp = event.data.timestamp ?? Date.now()
      const msgType = event.data.type ?? "text"
      const contactName = event.data.contacts?.[0]?.profile?.name

      const mediaId = event.data.image?.id ?? event.data.audio?.id ?? event.data.video?.id ?? event.data.document?.id
      const mediaCaption = event.data.image?.caption ?? event.data.video?.caption ?? event.data.document?.caption
      const interactiveData = event.data.interactive

      let text = event.data.text?.body
      if (!text) {
        if (mediaCaption) {
          text = mediaCaption
        } else if (msgType === "image") {
          text = "[Sent an image]"
        } else if (msgType === "video") {
          text = "[Sent a video]"
        } else if (msgType === "audio") {
          text = "[Sent a voice message]"
        } else if (msgType === "document") {
          text = `[Sent a document${event.data.document?.filename ? `: ${event.data.document.filename}` : ""}]`
        } else if (msgType === "interactive" && interactiveData) {
          const ir = interactiveData as Record<string, any>
          text = ir.button_reply?.title ?? ir.list_reply?.title ?? "[Interactive reply]"
        }
      }

      const msgId = await ctx.runMutation(internal.whatsapp.processInboundMessage, {
        organizationId: connection.organizationId,
        connectionId: connection._id,
        from,
        messageId,
        timestamp,
        type: msgType,
        text,
        contactName,
        mediaCaption,
        interactiveData,
      })

      if (msgId && mediaId) {
        await ctx.runMutation(internal.whatsapp.scheduleMediaDownload, {
          whatsappMessageId: msgId,
          mediaId,
          kapsoPhoneNumberId: phoneNumberId,
        })
      }

      if (msgId && text) {
        await ctx.runMutation(internal.whatsapp.scheduleAgentRouting, {
          organizationId: connection.organizationId,
          environment: connection.environment,
          connectionId: connection._id,
          phoneNumber: from,
          text,
        })
      }
    }

    if (event.type === "whatsapp.message.status_update") {
      const messageId = event.data.message_id
      const status = event.data.status
      if (messageId && status) {
        await ctx.runMutation(internal.whatsapp.updateMessageStatus, {
          messageId,
          status,
        })
      }
    }

    return new Response("OK", { status: 200 })
  }),
})

http.route({
  path: "/webhook/flow",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const formData = await request.formData()
    const token = formData.get("token") as string

    if (!token) {
      return new Response("Missing token", { status: 400 })
    }

    const configs = await ctx.runQuery(internal.integrations.listFlowConfigs)

    if (configs.length === 0) {
      console.warn("No Flow configurations found")
      return new Response("OK", { status: 200 })
    }

    for (const config of configs) {
      try {
        const result = await ctx.runAction(internal.payments.verifyPaymentFromWebhook, {
          token,
          organizationId: config.organizationId,
        }) as { flowOrder: number; status: string; statusMessage: string }

        if (result.status === "2") {
          await ctx.runMutation(internal.payments.markAsPaid, {
            providerReference: result.flowOrder.toString(),
            paidAt: Date.now(),
          })
          break
        } else if (result.status === "3" || result.status === "4") {
          await ctx.runMutation(internal.payments.markAsFailed, {
            providerReference: result.flowOrder.toString(),
            reason: result.statusMessage,
          })
          break
        }
      } catch (error) {
        continue
      }
    }

    return new Response("OK", { status: 200 })
  }),
})

http.route({
  path: "/webhook/polar",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 })
    }

    const webhookId = request.headers.get("webhook-id")
    const webhookTimestamp = request.headers.get("webhook-timestamp")
    const webhookSignature = request.headers.get("webhook-signature")

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return new Response("Missing webhook headers", { status: 400 })
    }

    const now = Math.floor(Date.now() / 1000)
    const ts = parseInt(webhookTimestamp)
    if (Math.abs(now - ts) > 300) {
      return new Response("Timestamp too old", { status: 400 })
    }

    const body = await request.text()

    const secretBytes = new TextEncoder().encode(webhookSecret)
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes.buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const toSign = new TextEncoder().encode(`${webhookId}.${webhookTimestamp}.${body}`)
    const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, toSign.buffer as ArrayBuffer))
    const expectedSig = base64Encode(signatureBytes)

    const signatures = webhookSignature.split(" ")
    const verified = signatures.some((sig) => {
      const parts = sig.split(",")
      return parts[1] === expectedSig
    })

    if (!verified) {
      return new Response("Invalid signature", { status: 400 })
    }

    const event = JSON.parse(body) as {
      type: string
      data: {
        id: string
        amount: number
        subtotal_amount: number
        customer: { external_id: string; id: string }
        metadata: Record<string, string>
      }
    }

    if (event.type === "order.paid") {
      const order = event.data
      const organizationId = order.metadata?.organizationId ?? order.customer?.external_id
      if (!organizationId) {
        return new Response("Missing organizationId", { status: 400 })
      }
      await ctx.runMutation(internal.billing.addCreditsFromPolar, {
        organizationId,
        amount: order.subtotal_amount,
        polarOrderId: order.id,
        polarCustomerId: order.customer?.id,
      })
    }

    return new Response("OK", { status: 200 })
  }),
})

export default http
