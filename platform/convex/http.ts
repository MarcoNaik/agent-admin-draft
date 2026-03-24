import { httpRouter, makeFunctionReference } from "convex/server"
import { ConvexError } from "convex/values"
import { httpAction } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { log } from "./lib/logger"

const validateApiKeyRef = makeFunctionReference<"query">("agent:validateApiKey")
const checkChatRateLimitRef = makeFunctionReference<"mutation">("rateLimits:checkChatRateLimit")
const chatRef = makeFunctionReference<"action">("agent:chat")
const chatBySlugRef = makeFunctionReference<"action">("agent:chatBySlug")
const getOrCreateFromClerkUserRef = makeFunctionReference<"mutation">("users:getOrCreateFromClerkNoOrg")
const getOrCreateFromClerkOrgRef = makeFunctionReference<"mutation">("organizations:getOrCreateFromClerk")
const markAsDeletedRef = makeFunctionReference<"mutation">("organizations:markAsDeleted")
const syncMembershipRef = makeFunctionReference<"mutation">("organizations:syncMembership")
const removeMembershipRef = makeFunctionReference<"mutation">("organizations:removeMembership")
const handlePhoneConnectedRef = makeFunctionReference<"mutation">("whatsapp:handlePhoneConnected")
const handlePhoneDeletedRef = makeFunctionReference<"mutation">("whatsapp:handlePhoneDeleted")
const getConnectionByKapsoPhoneRef = makeFunctionReference<"query">("whatsapp:getConnectionByKapsoPhone")
const processInboundMessageRef = makeFunctionReference<"mutation">("whatsapp:processInboundMessage")
const scheduleMediaDownloadRef = makeFunctionReference<"mutation">("whatsapp:scheduleMediaDownload")
const scheduleAgentRoutingRef = makeFunctionReference<"mutation">("whatsapp:scheduleAgentRouting")
const updateMessageStatusRef = makeFunctionReference<"mutation">("whatsapp:updateMessageStatus")
const markAsPaidRef = makeFunctionReference<"mutation">("payments:markAsPaid")
const markAsFailedRef = makeFunctionReference<"mutation">("payments:markAsFailed")
const getPaymentByFlowTokenRef = makeFunctionReference<"query">("payments:getPaymentByFlowToken")
const verifyPaymentFromWebhookRef = makeFunctionReference<"action">("payments:verifyPaymentFromWebhook")
const listFlowConfigsRef = makeFunctionReference<"query">("integrations:listFlowConfigs")
const addCreditsFromPolarRef = makeFunctionReference<"mutation">("billing:addCreditsFromPolar")
const updateEmailStatusRef = makeFunctionReference<"mutation">("email:updateEmailStatus")
const checkAuthRefreshLimitRef = makeFunctionReference<"mutation">("rateLimits:checkAuthRefreshLimit")
const internalSyncOrganizationRef = makeFunctionReference<"mutation">("sync:internalSyncOrganization")
const internalGetSyncStateRef = makeFunctionReference<"query">("sync:internalGetSyncState")
const internalGetPullStateRef = makeFunctionReference<"query">("sync:internalGetPullState")
const listConnectionsInternalRef = makeFunctionReference<"query">("whatsapp:listConnectionsInternal")
const internalListTemplatesRef = makeFunctionReference<"action">("whatsappActions:internalListTemplates")
const internalCreateTemplateRef = makeFunctionReference<"action">("whatsappActions:internalCreateTemplate")
const internalDeleteTemplateRef = makeFunctionReference<"action">("whatsappActions:internalDeleteTemplate")
const internalGetTemplateStatusRef = makeFunctionReference<"action">("whatsappActions:internalGetTemplateStatus")
const compileSystemPromptBySlugRef = makeFunctionReference<"action">("agents:compileSystemPromptBySlug")
const runToolBySlugRef = makeFunctionReference<"action">("toolTesting:runToolBySlug" as any)
const executeToolCallbackRef = makeFunctionReference<"action">("agent:executeToolCallback")
const checkDataRateLimitRef = makeFunctionReference<"mutation">("rateLimits:checkDataRateLimit")
const recordKeyUsageRef = makeFunctionReference<"mutation">("apiKeys:recordUsage")
const listEntityTypesInternalRef = makeFunctionReference<"query">("entityTypes:listInternal")
const entityCreateRef = makeFunctionReference<"mutation">("tools/entities:entityCreate")
const entityGetRef = makeFunctionReference<"query">("tools/entities:entityGet")
const entityQueryRef = makeFunctionReference<"query">("tools/entities:entityQuery")
const entitySearchRef = makeFunctionReference<"query">("tools/entities:entitySearch")
const entityUpdateRef = makeFunctionReference<"mutation">("tools/entities:entityUpdate")
const entityDeleteRef = makeFunctionReference<"mutation">("tools/entities:entityDelete")

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function authenticateApiKey(ctx: any, request: Request): Promise<{ organizationId: Id<"organizations">; environment: "development" | "production" | "eval"; permissions: string[]; keyHash: string; keyPrefix: string } | Response> {
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const keyHash = await hashApiKey(apiKey)
  const auth = await ctx.runQuery(validateApiKeyRef, { keyHash })

  if (!auth) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  await ctx.runMutation(recordKeyUsageRef, { keyPrefix: auth.keyPrefix })

  return { organizationId: auth.organizationId, environment: auth.environment, permissions: auth.permissions, keyHash, keyPrefix: auth.keyPrefix }
}

function base64Encode(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function sanitizeFiltersForDataApi(filters: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const ops = value as Record<string, unknown>
      const translated: Record<string, unknown> = {}
      for (const [op, opVal] of Object.entries(ops)) {
        if (op.startsWith("$")) {
          translated[`_op_${op.slice(1)}`] = opVal
        } else {
          translated[op] = opVal
        }
      }
      result[key] = translated
    } else {
      result[key] = value
    }
  }
  return result
}

async function authenticateDataApi(ctx: any, request: Request): Promise<{ organizationId: Id<"organizations">; environment: "development" | "production" | "eval"; keyHash: string } | Response> {
  const authResult = await authenticateApiKey(ctx, request)
  if (authResult instanceof Response) return authResult

  if (!authResult.permissions.includes("data") && !authResult.permissions.includes("*")) {
    return jsonResponse({ error: "API key does not have data permission" }, 403)
  }

  const rateLimitResult = await ctx.runMutation(checkDataRateLimitRef, {
    key: authResult.keyHash,
    organizationId: authResult.organizationId,
  })
  if (!rateLimitResult.ok) {
    const retryAfter = Math.ceil((rateLimitResult.retryAt! - Date.now()) / 1000)
    return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAt: rateLimitResult.retryAt }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfter)) },
    })
  }

  return { organizationId: authResult.organizationId, environment: authResult.environment, keyHash: authResult.keyHash }
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

    const keyHash = await hashApiKey(apiKey)
    const auth = await ctx.runQuery(validateApiKeyRef, { keyHash })
    if (!auth) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    await ctx.runMutation(recordKeyUsageRef, { keyPrefix: auth.keyPrefix })

    const rateLimitResult = await ctx.runMutation(checkChatRateLimitRef, {
      key: keyHash,
      organizationId: auth.organizationId,
    })
    if (!rateLimitResult.ok) {
      const retryAfter = Math.ceil((rateLimitResult.retryAt! - Date.now()) / 1000)
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAt: rateLimitResult.retryAt }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfter)) },
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
      const result = await ctx.runAction(chatRef, {
        apiKey,
        agentId: agentId as Id<"agents">,
        message,
        threadId: threadId ?? undefined,
        externalThreadId: externalThreadId ?? undefined,
        channel: "api" as const,
        channelParams: threadContext?.params,
      })

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      log.error("Chat API request failed", {
        ...log.withOrg(auth.organizationId as string),
        endpoint: "/v1/chat",
        agentId,
        error: error instanceof Error ? error : new Error(String(error)),
      })
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

    const keyHash = await hashApiKey(apiKey)
    const auth = await ctx.runQuery(validateApiKeyRef, { keyHash })
    if (!auth) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    await ctx.runMutation(recordKeyUsageRef, { keyPrefix: auth.keyPrefix })

    const rateLimitResult = await ctx.runMutation(checkChatRateLimitRef, {
      key: keyHash,
      organizationId: auth.organizationId,
    })
    if (!rateLimitResult.ok) {
      const retryAfter = Math.ceil((rateLimitResult.retryAt! - Date.now()) / 1000)
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAt: rateLimitResult.retryAt }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfter)) },
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
      const result = await ctx.runAction(chatBySlugRef, {
        apiKey,
        slug,
        message,
        threadId: threadId ?? undefined,
        externalThreadId: externalThreadId ?? undefined,
        channel: "api" as const,
        channelParams: threadContext?.params,
      })

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      log.error("Chat by slug API request failed", {
        ...log.withOrg(auth.organizationId as string),
        endpoint: `/v1/agents/${slug}/chat`,
        agentSlug: slug,
        error: error instanceof Error ? error : new Error(String(error)),
      })
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
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 })
    }

    const svixId = request.headers.get("svix-id")
    const svixTimestamp = request.headers.get("svix-timestamp")
    const svixSignature = request.headers.get("svix-signature")

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing webhook headers", { status: 401 })
    }

    const now = Math.floor(Date.now() / 1000)
    const ts = parseInt(svixTimestamp)
    if (Math.abs(now - ts) > 300) {
      return new Response("Timestamp too old", { status: 401 })
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
      return new Response("Invalid signature", { status: 401 })
    }

    const { type, data } = JSON.parse(body) as { type: string; data: unknown }

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

          await ctx.runMutation(getOrCreateFromClerkUserRef, {
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

          await ctx.runMutation(getOrCreateFromClerkOrgRef, {
            clerkOrgId: orgData.id,
            name: orgData.name,
            slug: orgData.slug,
          })
          break
        }

        case "organization.deleted": {
          const orgData = data as { id: string }
          await ctx.runMutation(markAsDeletedRef, {
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

          await ctx.runMutation(getOrCreateFromClerkOrgRef, {
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

          await ctx.runMutation(syncMembershipRef, {
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

          await ctx.runMutation(removeMembershipRef, {
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
      log.error("Clerk webhook processing failed", {
        webhookType: type,
        error: error instanceof Error ? error : new Error(String(error)),
      })
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
      display_phone_number?: string
      customer?: { id?: string }
      project?: { id?: string }
    }

    if (eventType === "whatsapp.phone_number.created") {
      const phoneNumberId = parsed.phone_number_id
      const kapsoCustomerId = parsed.customer?.id

      if (phoneNumberId && kapsoCustomerId) {
        await ctx.runMutation(handlePhoneConnectedRef, {
          kapsoCustomerId,
          kapsoPhoneNumberId: phoneNumberId,
          phoneNumber: parsed.display_phone_number,
        })
      }
    }

    if (eventType === "whatsapp.phone_number.deleted") {
      const phoneNumberId = parsed.phone_number_id
      if (phoneNumberId) {
        await ctx.runMutation(handlePhoneDeletedRef, {
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

    type WebhookItem = {
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
          statuses?: Array<{
            pricing?: {
              billable?: boolean
              pricing_model?: string
              category?: string
            }
          }>
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

    const raw = JSON.parse(rawBody)
    const items: WebhookItem[] = Array.isArray(raw.data) ? raw.data : [raw]

    for (const item of items) {
      const message = item.message
      const phoneNumberId = item.phone_number_id ?? item.conversation?.phone_number_id ?? ""

      if (eventType === "whatsapp.message.received") {
        if (!phoneNumberId) {
          continue
        }

        const connection = await ctx.runQuery(getConnectionByKapsoPhoneRef, {
          kapsoPhoneNumberId: phoneNumberId,
        }) as { _id: Id<"whatsappConnections">; organizationId: Id<"organizations">; environment: "development" | "production" | "eval"; agentId: Id<"agents"> } | null

        if (!connection) {
          continue
        }

        const from = item.conversation?.phone_number?.replace("+", "") ?? ""
        const messageId = message.id ?? `kapso_${Date.now()}`
        const timestamp = Number(message.timestamp) * 1000 || Date.now()
        const msgType = message.type ?? "text"
        const contactName = item.conversation?.kapso?.contact_name
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

        const result = await ctx.runMutation(processInboundMessageRef, {
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
          agentId: (connection as any).agentId,
          environment: connection.environment,
        })

        if (result && mediaId) {
          await ctx.runMutation(scheduleMediaDownloadRef, {
            messageId: result.messageId,
            mediaId,
            kapsoPhoneNumberId: phoneNumberId,
            mediaUrl,
          })
        }

        if (result && text) {
          await ctx.runMutation(scheduleAgentRoutingRef, {
            organizationId: connection.organizationId,
            environment: connection.environment,
            connectionId: connection._id,
            phoneNumber: from,
            text,
            mediaDirectUrl: mediaUrl,
            mediaType: msgType,
            threadId: result.threadId,
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
            const statuses = message.kapso?.statuses
            if (statuses && Array.isArray(statuses)) {
              const pricingEntry = statuses.find((s) => s.pricing)
              if (pricingEntry?.pricing) {
                updateArgs.pricingBillable = pricingEntry.pricing.billable
                updateArgs.pricingModel = pricingEntry.pricing.pricing_model
                updateArgs.pricingCategory = pricingEntry.pricing.category
              }
            }
          }

          await ctx.runMutation(updateMessageStatusRef, updateArgs)
        }
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
        await ctx.runMutation(markAsPaidRef, {
          providerReference: result.flowOrder.toString(),
          paidAt: Date.now(),
        })
        return true
      } else if (result.status === 3 || result.status === 4) {
        await ctx.runMutation(markAsFailedRef, {
          providerReference: result.flowOrder.toString(),
          reason: result.statusMessage,
        })
        return true
      }
      return false
    }

    const paymentLookup = await ctx.runQuery(getPaymentByFlowTokenRef, {
      flowToken: token,
    })

    if (paymentLookup) {
      try {
        const result = await ctx.runAction(verifyPaymentFromWebhookRef, {
          token,
          organizationId: paymentLookup.organizationId,
          environment: paymentLookup.environment,
        })
        await handleFlowResult(result)
        return new Response("OK", { status: 200 })
      } catch (error) {
        log.error("Flow webhook verification failed during token lookup", {
          ...log.withOrg(paymentLookup.organizationId),
          environment: paymentLookup.environment,
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    }

    const configs = await ctx.runQuery(listFlowConfigsRef)

    if (configs.length === 0) {
      return new Response("OK", { status: 200 })
    }

    for (const config of configs) {
      const environments = [config.environment as "production" | "development" | "eval"]
      const otherEnv = config.environment === "production" ? "development" : "production"
      environments.push(otherEnv as "production" | "development")

      for (const env of environments) {
        try {
          const result = await ctx.runAction(verifyPaymentFromWebhookRef, {
            token,
            organizationId: config.organizationId,
            environment: env,
          })

          if (await handleFlowResult(result)) {
            return new Response("OK", { status: 200 })
          }
        } catch (error) {
          log.error("Flow webhook verification failed during config iteration", {
            ...log.withOrg(config.organizationId as string),
            environment: env,
            error: error instanceof Error ? error : new Error(String(error)),
          })
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
      await ctx.runMutation(addCreditsFromPolarRef, {
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
      await ctx.runMutation(updateEmailStatusRef, {
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
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { sessionId: string }
    const { sessionId } = body

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const rateLimitResult = await ctx.runMutation(checkAuthRefreshLimitRef, {
      key: sessionId,
    })
    if (!rateLimitResult.ok) {
      const retryAfter = Math.ceil((rateLimitResult.retryAt! - Date.now()) / 1000)
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAt: rateLimitResult.retryAt }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfter)) },
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
      const result = await ctx.runMutation(internalSyncOrganizationRef, {
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
      const message = error instanceof ConvexError
        ? String(error.data)
        : error instanceof Error ? error.message : "Unknown error"
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
      const result = await ctx.runQuery(internalGetSyncStateRef, {
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
      const result = await ctx.runQuery(internalGetPullStateRef, {
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
      const result = await ctx.runQuery(listConnectionsInternalRef, {
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
      const result = await ctx.runAction(internalListTemplatesRef, {
        organizationId: authResult.organizationId,
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
      const result = await ctx.runAction(internalCreateTemplateRef, {
        organizationId: authResult.organizationId,
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
      const result = await ctx.runAction(internalDeleteTemplateRef, {
        organizationId: authResult.organizationId,
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
      const result = await ctx.runAction(internalGetTemplateStatusRef, {
        organizationId: authResult.organizationId,
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
  path: "/v1/compile-prompt",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const body = await request.json() as {
        slug: string
        message?: string
        channel?: string
        threadMetadata?: Record<string, unknown>
      }

      if (!body.slug) {
        return new Response(JSON.stringify({ error: "slug is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      const result = await ctx.runAction(compileSystemPromptBySlugRef, {
        organizationId: authResult.organizationId,
        slug: body.slug,
        environment: authResult.environment,
        sampleContext: {
          message: body.message,
          channel: body.channel,
          threadMetadata: body.threadMetadata,
        },
      })

      if (!result) {
        return new Response(JSON.stringify({ error: "Agent not found or no config for this environment" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      }

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
  path: "/v1/run-tool",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResult = await authenticateApiKey(ctx, request)
    if (authResult instanceof Response) return authResult

    try {
      const body = await request.json() as {
        agentSlug: string
        toolName: string
        args?: Record<string, unknown>
      }

      if (!body.agentSlug) {
        return new Response(JSON.stringify({ error: "agentSlug is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (!body.toolName) {
        return new Response(JSON.stringify({ error: "toolName is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      const result = await ctx.runAction(runToolBySlugRef, {
        organizationId: authResult.organizationId,
        slug: body.agentSlug,
        environment: authResult.environment,
        toolName: body.toolName,
        toolArgs: body.args || {},
      })

      if (result?.error) {
        const statusMap: Record<string, number> = {
          not_found: 404,
          tool_not_found: 400,
          permission_denied: 403,
          execution_error: 500,
        }
        return new Response(JSON.stringify(result), {
          status: statusMap[result.errorType] || 500,
          headers: { "Content-Type": "application/json" },
        })
      }

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
  path: "/internal/tool-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = request.headers.get("Authorization")
    const secret = process.env.TOOL_EXECUTOR_SECRET
    if (!secret || auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      const body = await request.json()
      const { toolName, args, identity } = body as {
        toolName: string
        args: Record<string, unknown>
        identity: {
          organizationId: string
          actorId: string
          actorType: string
          isOrgAdmin?: boolean
          environment: string
          agentId?: string
          conversationId?: string
          depth?: number
          callerAgentSlug?: string
        }
      }

      if (!toolName || !identity) {
        return new Response(JSON.stringify({ error: "toolName and identity are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      const result = await ctx.runAction(executeToolCallbackRef, {
        toolName,
        args: args ?? {},
        identity: {
          organizationId: identity.organizationId as any,
          actorId: identity.actorId,
          actorType: identity.actorType,
          isOrgAdmin: identity.isOrgAdmin,
          environment: identity.environment as any,
          agentId: identity.agentId,
          conversationId: identity.conversationId,
          depth: identity.depth,
          callerAgentSlug: identity.callerAgentSlug,
        },
      })

      return new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error"
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }),
})

http.route({
  path: "/v1/entity-types",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateDataApi(ctx, request)
    if (auth instanceof Response) return auth

    try {
      const types = await ctx.runQuery(listEntityTypesInternalRef, {
        organizationId: auth.organizationId,
        environment: auth.environment,
      })

      return jsonResponse({
        data: types.map((t: any) => ({
          slug: t.slug,
          name: t.name,
          schema: t.schema ?? null,
          searchFields: t.searchFields ?? [],
        })),
      })
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Internal error" }, 500)
    }
  }),
})

http.route({
  pathPrefix: "/v1/data/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateDataApi(ctx, request)
    if (auth instanceof Response) return auth

    const url = new URL(request.url)
    const pathAfterData = url.pathname.replace(/^\/v1\/data\//, "")
    const segments = pathAfterData.split("/").filter(Boolean)

    if (segments.length === 0) {
      return jsonResponse({ error: "Entity type is required in path" }, 400)
    }

    const type = segments[0]
    const actorArgs = {
      organizationId: auth.organizationId,
      actorId: "api-key",
      actorType: "system" as const,
      environment: auth.environment,
    }

    try {
      if (segments.length === 1) {
        const limit = parseInt(url.searchParams.get("limit") ?? "50")
        const cursor = url.searchParams.get("cursor")
        const status = url.searchParams.get("status") ?? undefined

        const fetchLimit = Math.min(limit, 100) + 1
        const results = await ctx.runQuery(entityQueryRef, {
          ...actorArgs,
          type,
          status,
          limit: fetchLimit,
        })

        let data = results
        if (cursor) {
          const cursorIndex = data.findIndex((e: any) => e.id === cursor)
          if (cursorIndex >= 0) {
            data = data.slice(cursorIndex + 1)
          }
        }

        const hasMore = data.length > Math.min(limit, 100)
        if (hasMore) data = data.slice(0, Math.min(limit, 100))

        return jsonResponse({
          data,
          cursor: hasMore && data.length > 0 ? data[data.length - 1].id : null,
          hasMore,
        })
      }

      if (segments.length === 2) {
        const entity = await ctx.runQuery(entityGetRef, {
          ...actorArgs,
          id: segments[1],
        })
        return jsonResponse(entity)
      }

      return jsonResponse({ error: "Invalid path" }, 400)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error"
      if (message.includes("not found")) return jsonResponse({ error: message }, 404)
      if (message.includes("permission") || message.includes("scope")) return jsonResponse({ error: message }, 403)
      if (message.includes("deleted")) return jsonResponse({ error: message }, 404)
      return jsonResponse({ error: message }, 500)
    }
  }),
})

http.route({
  pathPrefix: "/v1/data/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateDataApi(ctx, request)
    if (auth instanceof Response) return auth

    const url = new URL(request.url)
    const pathAfterData = url.pathname.replace(/^\/v1\/data\//, "")
    const segments = pathAfterData.split("/").filter(Boolean)

    if (segments.length === 0) {
      return jsonResponse({ error: "Entity type is required in path" }, 400)
    }

    const type = segments[0]
    const actorArgs = {
      organizationId: auth.organizationId,
      actorId: "api-key",
      actorType: "system" as const,
      environment: auth.environment,
    }

    try {
      if (segments.length === 2 && segments[1] === "query") {
        const body = await request.json()
        const { filters, status, limit, cursor } = body as {
          filters?: Record<string, unknown>
          status?: string
          limit?: number
          cursor?: string
        }

        const fetchLimit = Math.min(limit ?? 50, 100) + 1
        const translatedFilters = filters ? sanitizeFiltersForDataApi(filters) : undefined

        const results = await ctx.runQuery(entityQueryRef, {
          ...actorArgs,
          type,
          filters: translatedFilters,
          status,
          limit: fetchLimit,
        })

        let data = results
        if (cursor) {
          const cursorIndex = data.findIndex((e: any) => e.id === cursor)
          if (cursorIndex >= 0) {
            data = data.slice(cursorIndex + 1)
          }
        }

        const effectiveLimit = Math.min(limit ?? 50, 100)
        const hasMore = data.length > effectiveLimit
        if (hasMore) data = data.slice(0, effectiveLimit)

        return jsonResponse({
          data,
          cursor: hasMore && data.length > 0 ? data[data.length - 1].id : null,
          hasMore,
        })
      }

      if (segments.length === 2 && segments[1] === "search") {
        const body = await request.json()
        const { query, limit } = body as { query: string; limit?: number }

        if (!query) {
          return jsonResponse({ error: "query is required" }, 400)
        }

        const results = await ctx.runQuery(entitySearchRef, {
          ...actorArgs,
          type,
          query,
          limit: Math.min(limit ?? 20, 100),
        })

        return jsonResponse({ data: results })
      }

      if (segments.length === 1) {
        const body = await request.json()
        const { data, status } = body as { data: Record<string, unknown>; status?: string }

        if (!data || typeof data !== "object") {
          return jsonResponse({ error: "data object is required" }, 400)
        }

        const { id } = await ctx.runMutation(entityCreateRef, {
          ...actorArgs,
          type,
          data,
          status,
        })

        const entity = await ctx.runQuery(entityGetRef, {
          ...actorArgs,
          id: id as string,
        })

        return jsonResponse(entity, 201)
      }

      return jsonResponse({ error: "Invalid path" }, 400)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error"
      if (message.includes("not found")) return jsonResponse({ error: message }, 404)
      if (message.includes("permission") || message.includes("scope")) return jsonResponse({ error: message }, 403)
      return jsonResponse({ error: message }, 500)
    }
  }),
})

http.route({
  pathPrefix: "/v1/data/",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateDataApi(ctx, request)
    if (auth instanceof Response) return auth

    const url = new URL(request.url)
    const pathAfterData = url.pathname.replace(/^\/v1\/data\//, "")
    const segments = pathAfterData.split("/").filter(Boolean)

    if (segments.length !== 2) {
      return jsonResponse({ error: "Path must be /v1/data/:type/:id" }, 400)
    }

    const [type, id] = segments
    const actorArgs = {
      organizationId: auth.organizationId,
      actorId: "api-key",
      actorType: "system" as const,
      environment: auth.environment,
    }

    try {
      const body = await request.json()
      const { data, status } = body as { data: Record<string, unknown>; status?: string }

      if (!data || typeof data !== "object") {
        return jsonResponse({ error: "data object is required" }, 400)
      }

      await ctx.runMutation(entityUpdateRef, {
        ...actorArgs,
        id,
        type,
        data,
        status,
      })

      const entity = await ctx.runQuery(entityGetRef, {
        ...actorArgs,
        id,
      })

      return jsonResponse(entity)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error"
      if (message.includes("not found")) return jsonResponse({ error: message }, 404)
      if (message.includes("permission") || message.includes("scope")) return jsonResponse({ error: message }, 403)
      if (message.includes("deleted")) return jsonResponse({ error: message }, 404)
      return jsonResponse({ error: message }, 500)
    }
  }),
})

http.route({
  pathPrefix: "/v1/data/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateDataApi(ctx, request)
    if (auth instanceof Response) return auth

    const url = new URL(request.url)
    const pathAfterData = url.pathname.replace(/^\/v1\/data\//, "")
    const segments = pathAfterData.split("/").filter(Boolean)

    if (segments.length !== 2) {
      return jsonResponse({ error: "Path must be /v1/data/:type/:id" }, 400)
    }

    const [type, id] = segments
    const actorArgs = {
      organizationId: auth.organizationId,
      actorId: "api-key",
      actorType: "system" as const,
      environment: auth.environment,
    }

    try {
      await ctx.runMutation(entityDeleteRef, {
        ...actorArgs,
        id,
      })

      return jsonResponse({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error"
      if (message.includes("not found")) return jsonResponse({ error: message }, 404)
      if (message.includes("permission") || message.includes("scope")) return jsonResponse({ error: message }, 403)
      return jsonResponse({ error: message }, 500)
    }
  }),
})

export default http
