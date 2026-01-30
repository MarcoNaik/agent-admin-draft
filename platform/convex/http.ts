import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { api, internal } from "./_generated/api"
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
            organization_memberships?: Array<{
              organization: { id: string; name: string; slug: string }
            }>
          }

          const email = userData.email_addresses[0]?.email_address
          const name = [userData.first_name, userData.last_name]
            .filter(Boolean)
            .join(" ")

          if (!email) break

          const orgMembership = userData.organization_memberships?.[0]
          let orgId

          if (orgMembership) {
            orgId = await ctx.runMutation(
              internal.organizations.getOrCreateFromClerk,
              {
                clerkOrgId: orgMembership.organization.id,
                name: orgMembership.organization.name,
                slug: orgMembership.organization.slug,
              }
            )
          } else {
            orgId = await ctx.runMutation(
              internal.organizations.getOrCreatePersonal,
              {
                clerkUserId: userData.id,
                name: name || email.split("@")[0],
              }
            )
          }

          await ctx.runMutation(internal.users.getOrCreateFromClerk, {
            clerkUserId: userData.id,
            email,
            name: name || undefined,
            organizationId: orgId,
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

export default http
