import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"

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
  path: "/v1/agents/:slug/chat",
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

          const role = membershipData.role === "org:admin" ? "admin" as const
            : membershipData.role === "org:owner" ? "owner" as const
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
  path: "/webhook/whatsapp/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const gatewaySecret = process.env.WHATSAPP_GATEWAY_SECRET
    if (!gatewaySecret || request.headers.get("X-Gateway-Secret") !== gatewaySecret) {
      return new Response("Forbidden", { status: 403 })
    }

    const body = await request.json() as {
      orgId: string
      from: string
      messageId: string
      type: string
      text?: string
      timestamp: number
    }

    const org = await ctx.runQuery(internal.organizations.getInternal, {
      organizationId: body.orgId as Id<"organizations">,
    })

    if (!org) {
      return new Response("Organization not found", { status: 404 })
    }

    const isNew = await ctx.runMutation(internal.whatsapp.processInboundMessage, {
      organizationId: body.orgId as Id<"organizations">,
      from: body.from,
      messageId: body.messageId,
      timestamp: body.timestamp,
      type: body.type,
      text: body.text,
    })

    if (isNew && body.text && body.type === "text") {
      await ctx.runMutation(internal.whatsapp.scheduleAgentRouting, {
        organizationId: body.orgId as Id<"organizations">,
        phoneNumber: body.from,
        text: body.text,
      })
    }

    return new Response("OK", { status: 200 })
  }),
})

http.route({
  path: "/webhook/whatsapp/qr",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const gatewaySecret = process.env.WHATSAPP_GATEWAY_SECRET
    if (!gatewaySecret || request.headers.get("X-Gateway-Secret") !== gatewaySecret) {
      return new Response("Forbidden", { status: 403 })
    }

    const { orgId, qrCode } = await request.json() as { orgId: string; qrCode: string }

    await ctx.runMutation(internal.whatsapp.updateQRCode, {
      organizationId: orgId as Id<"organizations">,
      qrCode,
    })

    return new Response("OK", { status: 200 })
  }),
})

http.route({
  path: "/webhook/whatsapp/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const gatewaySecret = process.env.WHATSAPP_GATEWAY_SECRET
    if (!gatewaySecret || request.headers.get("X-Gateway-Secret") !== gatewaySecret) {
      return new Response("Forbidden", { status: 403 })
    }

    const { orgId, status, phoneNumber } = await request.json() as {
      orgId: string
      status: "disconnected" | "connecting" | "qr_ready" | "connected"
      phoneNumber?: string
    }

    await ctx.runMutation(internal.whatsapp.updateConnectionStatus, {
      organizationId: orgId as Id<"organizations">,
      status,
      phoneNumber,
    })

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

export default http
