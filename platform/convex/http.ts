import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function authenticateApiKey(ctx: any, request: Request): Promise<{ organizationId: Id<"organizations">; environment: "development" | "production" | "eval" } | Response> {
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const keyHash = await hashApiKey(apiKey)
  const auth = await ctx.runQuery(internal.agent.validateApiKey, { keyHash })

  if (!auth) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  return { organizationId: auth.organizationId, environment: auth.environment }
}

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
    const { agentId, message, threadId, externalThreadId, threadContext } = body as {
      agentId: string
      message: string
      threadId?: string
      externalThreadId?: string
      threadContext?: { params?: Record<string, unknown> }
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
        channel: "api" as const,
        channelParams: threadContext?.params,
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
    const { message, threadId, externalThreadId, threadContext } = body as {
      message: string
      threadId?: string
      externalThreadId?: string
      threadContext?: { params?: Record<string, unknown> }
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
        channel: "api" as const,
        channelParams: threadContext?.params,
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

async function verifyKapsoSignature(rawBody: string, signatureHeader: string): Promise<boolean> {
  const secret = process.env.KAPSO_WEBHOOK_SECRET
  if (!secret) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody))
  )
  const expected = Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("")
  return expected === signatureHeader
}

http.route({
  path: "/webhook/kapso/project",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text()
    const signature = request.headers.get("X-Webhook-Signature") ?? ""

    if (!(await verifyKapsoSignature(rawBody, signature))) {
      return new Response("Invalid signature", { status: 403 })
    }

    const eventType = request.headers.get("X-Webhook-Event") ?? ""
    const parsed = JSON.parse(rawBody) as {
      phone_number_id?: string
      customer?: { id?: string }
      project?: { id?: string }
    }

    if (eventType === "whatsapp.phone_number.created") {
      const phoneNumberId = parsed.phone_number_id
      const kapsoCustomerId = parsed.customer?.id

      if (phoneNumberId && kapsoCustomerId) {
        await ctx.runMutation(internal.whatsapp.handlePhoneConnected, {
          kapsoCustomerId,
          kapsoPhoneNumberId: phoneNumberId,
        })
      }
    }

    if (eventType === "whatsapp.phone_number.deleted") {
      const phoneNumberId = parsed.phone_number_id
      if (phoneNumberId) {
        await ctx.runMutation(internal.whatsapp.handlePhoneDeleted, {
          kapsoPhoneNumberId: phoneNumberId,
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
    const rawBody = await request.text()
    const signature = request.headers.get("X-Webhook-Signature") ?? ""

    if (!(await verifyKapsoSignature(rawBody, signature))) {
      return new Response("Invalid signature", { status: 403 })
    }

    const eventType = request.headers.get("X-Webhook-Event") ?? ""
    const parsed = JSON.parse(rawBody) as {
      message: {
        id: string
        type: string
        timestamp: string
        text?: { body?: string }
        image?: { id?: string; caption?: string }
        audio?: { id?: string }
        video?: { id?: string; caption?: string }
        document?: { id?: string; filename?: string; caption?: string }
        interactive?: { type?: string; button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } }
        reaction?: { message_id?: string; emoji?: string }
        location?: { latitude?: number; longitude?: number; name?: string; address?: string }
        kapso?: {
          direction?: string
          status?: string
          media_url?: string
          media_data?: { url?: string; filename?: string; content_type?: string }
          content?: string
          transcript?: { text?: string }
        }
      }
      conversation?: {
        id?: string
        phone_number?: string
        phone_number_id?: string
        kapso?: {
          contact_name?: string
        }
      }
      phone_number_id?: string
      is_new_conversation?: boolean
    }

    const message = parsed.message
    const phoneNumberId = parsed.phone_number_id ?? parsed.conversation?.phone_number_id ?? ""

    if (eventType === "whatsapp.message.received") {
      if (!phoneNumberId) {
        return new Response("Missing phone_number_id", { status: 400 })
      }

      const connection = await ctx.runQuery(internal.whatsapp.getConnectionByKapsoPhone, {
        kapsoPhoneNumberId: phoneNumberId,
      }) as { _id: Id<"whatsappConnections">; organizationId: Id<"organizations">; environment: "development" | "production" | "eval" } | null

      if (!connection) {
        return new Response("Unknown phone number", { status: 404 })
      }

      const from = parsed.conversation?.phone_number?.replace("+", "") ?? ""
      const messageId = message.id ?? `kapso_${Date.now()}`
      const timestamp = Number(message.timestamp) * 1000 || Date.now()
      const msgType = message.type ?? "text"
      const contactName = parsed.conversation?.kapso?.contact_name
      const mediaUrl = message.kapso?.media_url ?? message.kapso?.media_data?.url

      const mediaId = message.image?.id ?? message.audio?.id ?? message.video?.id ?? message.document?.id
      const mediaCaption = message.image?.caption ?? message.video?.caption ?? message.document?.caption
      const interactiveData = message.interactive

      let text = message.text?.body
      if (!text) {
        if (mediaCaption) {
          text = mediaCaption
        } else if (msgType === "audio" && message.kapso?.transcript?.text) {
          text = message.kapso.transcript.text
        } else if (msgType === "image") {
          text = "[Sent an image]"
        } else if (msgType === "video") {
          text = "[Sent a video]"
        } else if (msgType === "audio") {
          text = "[Sent a voice message]"
        } else if (msgType === "document") {
          text = `[Sent a document${message.document?.filename ? `: ${message.document.filename}` : ""}]`
        } else if (msgType === "interactive" && interactiveData) {
          text = interactiveData.button_reply?.title ?? interactiveData.list_reply?.title ?? "[Interactive reply]"
        } else if (msgType === "reaction") {
          text = message.reaction?.emoji ?? "[Reaction]"
        } else if (msgType === "location") {
          text = message.location?.name ?? message.location?.address ?? "[Shared a location]"
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
        mediaDirectUrl: mediaUrl,
      })

      if (msgId && mediaId) {
        await ctx.runMutation(internal.whatsapp.scheduleMediaDownload, {
          whatsappMessageId: msgId,
          mediaId,
          kapsoPhoneNumberId: phoneNumberId,
          mediaUrl,
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

    if (
      eventType === "whatsapp.message.sent" ||
      eventType === "whatsapp.message.delivered" ||
      eventType === "whatsapp.message.read" ||
      eventType === "whatsapp.message.failed"
    ) {
      const messageId = message.id
      const status = eventType.split(".").pop()!
      if (messageId) {
        const updateArgs: {
          messageId: string
          status: string
          pricingBillable?: boolean
          pricingModel?: string
          pricingCategory?: string
        } = { messageId, status }

        if (status === "sent") {
          const kapso = message.kapso as {
            statuses?: Array<{
              pricing?: {
                billable?: boolean
                pricing_model?: string
                category?: string
              }
            }>
          } | undefined
          const statuses = kapso?.statuses
          if (statuses && Array.isArray(statuses)) {
            const pricingEntry = statuses.find((s) => s.pricing)
            if (pricingEntry?.pricing) {
              updateArgs.pricingBillable = pricingEntry.pricing.billable
              updateArgs.pricingModel = pricingEntry.pricing.pricing_model
              updateArgs.pricingCategory = pricingEntry.pricing.category
            }
          }
        }

        await ctx.runMutation(internal.whatsapp.updateMessageStatus, updateArgs)
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

    const handleFlowResult = async (result: { flowOrder: number; status: number; statusMessage: string }) => {
      if (result.status === 2) {
        await ctx.runMutation(internal.payments.markAsPaid, {
          providerReference: result.flowOrder.toString(),
          paidAt: Date.now(),
        })
        return true
      } else if (result.status === 3 || result.status === 4) {
        await ctx.runMutation(internal.payments.markAsFailed, {
          providerReference: result.flowOrder.toString(),
          reason: result.statusMessage,
        })
        return true
      }
      return false
    }

    const paymentLookup = await ctx.runQuery(internal.payments.getPaymentByFlowToken, {
      flowToken: token,
    })

    if (paymentLookup) {
      try {
        const result = await ctx.runAction(internal.payments.verifyPaymentFromWebhook, {
          token,
          organizationId: paymentLookup.organizationId,
          environment: paymentLookup.environment,
        })
        await handleFlowResult(result)
        return new Response("OK", { status: 200 })
      } catch (error) {
        console.error("Flow webhook verification error (token lookup):", error)
      }
    }

    const configs = await ctx.runQuery(internal.integrations.listFlowConfigs)

    if (configs.length === 0) {
      return new Response("OK", { status: 200 })
    }

    for (const config of configs) {
      const environments = [config.environment as "production" | "development" | "eval"]
      const otherEnv = config.environment === "production" ? "development" : "production"
      environments.push(otherEnv as "production" | "development")

      for (const env of environments) {
        try {
          const result = await ctx.runAction(internal.payments.verifyPaymentFromWebhook, {
            token,
            organizationId: config.organizationId,
            environment: env,
          })

          if (await handleFlowResult(result)) {
            return new Response("OK", { status: 200 })
          }
        } catch (error) {
          console.error("Flow webhook verification error:", config.organizationId, env, error)
          continue
        }
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

http.route({
  path: "/webhook/resend",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 })
    }

    const svixId = request.headers.get("svix-id")
    const svixTimestamp = request.headers.get("svix-timestamp")
    const svixSignature = request.headers.get("svix-signature")

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing webhook headers", { status: 400 })
    }

    const now = Math.floor(Date.now() / 1000)
    const ts = parseInt(svixTimestamp)
    if (Math.abs(now - ts) > 300) {
      return new Response("Timestamp too old", { status: 400 })
    }

    const body = await request.text()

    const rawSecret = webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret
    const secretBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes.buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const toSign = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`)
    const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, toSign.buffer as ArrayBuffer))
    const expectedSig = base64Encode(signatureBytes)

    const signatures = svixSignature.split(" ")
    const verified = signatures.some((sig) => {
      const parts = sig.split(",")
      return parts[1] === expectedSig
    })

    if (!verified) {
      return new Response("Invalid signature", { status: 400 })
    }

    const event = JSON.parse(body) as {
      type: string
      data: { email_id: string }
    }

    const statusMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.bounced": "bounced",
      "email.complained": "complained",
    }

    const mappedStatus = statusMap[event.type]
    if (mappedStatus && event.data?.email_id) {
      await ctx.runMutation(internal.email.updateEmailStatus, {
        resendId: event.data.email_id,
        status: mappedStatus as "sent" | "delivered" | "bounced" | "complained",
      })
    }

    return new Response("OK", { status: 200 })
  }),
})

http.route({
  path: "/v1/auth/refresh",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const body = await request.json() as { sessionId: string }
    const { sessionId } = body

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    if (!clerkSecretKey) {
      return new Response(JSON.stringify({ error: "CLERK_SECRET_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const clerkResponse = await fetch(
      `https://api.clerk.com/v1/sessions/${sessionId}/tokens/convex`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!clerkResponse.ok) {
      const error = await clerkResponse.text()
      return new Response(JSON.stringify({ error: `Session expired or invalid: ${error}` }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const data = await clerkResponse.json() as { jwt: string }

    return new Response(JSON.stringify({ token: data.jwt }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }),
})

http.route({
  path: "/v1/sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const body = await request.json()
      const result = await ctx.runMutation(internal.sync.internalSyncOrganization, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
        agents: body.agents ?? [],
        entityTypes: body.entityTypes ?? [],
        roles: body.roles ?? [],
        evalSuites: body.evalSuites,
        triggers: body.triggers,
        fixtures: body.fixtures,
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
  path: "/v1/sync/state",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const result = await ctx.runQuery(internal.sync.internalGetSyncState, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
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
  path: "/v1/sync/pull",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const result = await ctx.runQuery(internal.sync.internalGetPullState, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
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
  path: "/v1/templates/connections",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const result = await ctx.runQuery(internal.whatsapp.listConnectionsInternal, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
      })

      return new Response(JSON.stringify({ data: result }), {
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
  path: "/v1/templates/list",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const body = await request.json() as { connectionId: string }
      const result = await ctx.runAction(internal.whatsappActions.internalListTemplates, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
        connectionId: body.connectionId as Id<"whatsappConnections">,
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
  path: "/v1/templates/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const body = await request.json() as {
        connectionId: string
        name: string
        language: string
        category: string
        components: Array<Record<string, unknown>>
        allowCategoryChange?: boolean
      }
      const result = await ctx.runAction(internal.whatsappActions.internalCreateTemplate, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
        connectionId: body.connectionId as Id<"whatsappConnections">,
        name: body.name,
        language: body.language,
        category: body.category,
        components: body.components,
        allowCategoryChange: body.allowCategoryChange,
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
  path: "/v1/templates/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const body = await request.json() as { connectionId: string; name: string }
      const result = await ctx.runAction(internal.whatsappActions.internalDeleteTemplate, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
        connectionId: body.connectionId as Id<"whatsappConnections">,
        name: body.name,
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
  path: "/v1/templates/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const body = await request.json() as { connectionId: string; name: string }
      const result = await ctx.runAction(internal.whatsappActions.internalGetTemplateStatus, {
        organizationId: authResult.organizationId,
        environment: authResult.environment,
        connectionId: body.connectionId as Id<"whatsappConnections">,
        name: body.name,
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

export default http
