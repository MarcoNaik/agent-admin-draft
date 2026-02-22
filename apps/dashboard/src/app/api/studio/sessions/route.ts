import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { api } from "@convex/_generated/api"
import { createSandbox } from "@/lib/studio/e2b"
import { getConvexClient } from "@/lib/studio/client"

const ACP_PROTOCOL_VERSION = 1

async function acpPost(
  baseUrl: string,
  serverId: string,
  body: Record<string, unknown>,
  query?: Record<string, string>
) {
  const url = new URL(`${baseUrl}/v1/acp/${encodeURIComponent(serverId)}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: Record<string, unknown> | null = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok) {
    throw new Error(`ACP ${body.method} failed: ${res.status} ${text.slice(0, 300)}`)
  }
  if (json && typeof json === "object" && "error" in json) {
    const err = json.error as Record<string, unknown>
    throw new Error(`ACP ${body.method} RPC error: ${err.message ?? JSON.stringify(err)}`)
  }
  return json
}

let rpcIdCounter = 0

async function createAcpSession(
  sandboxUrl: string,
  agentType: string,
  cwd: string
): Promise<{ serverId: string; agentSessionId: string }> {
  const serverId = `web-${crypto.randomUUID()}`

  await acpPost(sandboxUrl, serverId, {
    jsonrpc: "2.0",
    id: ++rpcIdCounter,
    method: "initialize",
    params: {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientInfo: { name: "struere-studio", version: "1.0" },
    },
  }, { agent: agentType })

  const result = await acpPost(sandboxUrl, serverId, {
    jsonrpc: "2.0",
    id: ++rpcIdCounter,
    method: "session/new",
    params: { cwd, mcpServers: [] },
  }) as Record<string, unknown>

  const sessionResult = result?.result as Record<string, unknown> | undefined
  const agentSessionId = sessionResult?.sessionId as string | undefined
  if (!agentSessionId) {
    throw new Error(`session/new did not return sessionId: ${JSON.stringify(result)}`)
  }

  return { serverId, agentSessionId }
}

export async function POST(request: Request) {
  const { getToken } = await auth()
  const token = await getToken({ template: "convex" })
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const convex = getConvexClient(token)

  const body = await request.json()
  const { agentType = "opencode", environment = "development" } = body

  let sessionId: string | null = null
  let sandboxId: string | null = null

  try {
    sessionId = await convex.mutation(api.sandboxSessions.create, {
      environment,
      agentType,
    })

    const apiKeyResult = await convex.mutation(api.apiKeys.create, {
      name: `sandbox-${sessionId}`,
      permissions: ["*"],
      environment,
    })

    await convex.mutation(api.sandboxSessions.updateStatus, {
      id: sessionId,
      status: "provisioning",
      apiKeyId: apiKeyResult.id,
    })

    const org = await convex.query(api.organizations.getCurrent, {})
    if (!org) {
      throw new Error("Organization not found")
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!
    const claudeMd = buildClaudeMd(org.name, environment)

    const envVars: Record<string, string> = {
      STRUERE_API_KEY: apiKeyResult.key,
      STRUERE_CONVEX_URL: convexUrl,
    }
    if (process.env.XAI_API_KEY) envVars.XAI_API_KEY = process.env.XAI_API_KEY
    if (process.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    if (process.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (process.env.E2B_API_KEY) envVars.E2B_API_KEY = process.env.E2B_API_KEY

    const sandbox = await createSandbox({
      envVars,
      orgInfo: { id: org._id, slug: org.slug, name: org.name },
      apiKey: apiKeyResult.key,
      convexUrl,
      claudeMd,
      agentType,
    })
    sandboxId = sandbox.sandboxId

    const { serverId, agentSessionId } = await createAcpSession(
      sandbox.sandboxUrl,
      agentType,
      "/workspace",
    )

    await convex.mutation(api.sandboxSessions.updateStatus, {
      id: sessionId,
      status: "ready",
      sandboxId: sandbox.sandboxId,
      sandboxUrl: sandbox.sandboxUrl,
      agentSessionId,
      acpServerId: serverId,
    })

    return NextResponse.json({ sessionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[studio/sessions] POST failed:", message, error instanceof Error ? error.stack : "")

    if (sandboxId) {
      try {
        const { destroySandbox } = await import("@/lib/studio/e2b")
        await destroySandbox(sandboxId)
      } catch {
      }
    }

    if (sessionId) {
      try {
        await convex.mutation(api.sandboxSessions.updateStatus, {
          id: sessionId,
          status: "error",
          errorMessage: message,
        })
      } catch {
      }
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildClaudeMd(orgName: string, environment: string): string {
  return `# Struere Project — ${orgName}

## Environment
- Environment: ${environment}
- This is a Struere AI agent project
- Use \`struere dev --force\` to sync changes to the platform
- The project uses TypeScript with ESM modules

## File Structure
- \`agents/\` — Agent definitions (defineAgent)
- \`entity-types/\` — Entity type schemas (defineEntityType)
- \`roles/\` — RBAC role definitions (defineRole)
- \`triggers/\` — Event triggers (defineTrigger)
- \`tools/\` — Custom tool handlers (defineTools)

## SDK Imports
\`\`\`typescript
import { defineAgent, defineEntityType, defineRole, defineTrigger, defineTools } from 'struere'
\`\`\`

## Key Conventions
- Agent model default: \`{ provider: "anthropic", name: "claude-sonnet-4" }\`
- Built-in tools: entity.create/get/query/update/delete/link/unlink, event.emit/query, calendar.*, whatsapp.*, agent.chat
- Schema format: JSON Schema (type: "object", properties, required)
- Policy effect: "allow" or "deny" (deny overrides allow)
- Scope rule operators: "eq", "neq", "in", "contains"
- After making changes, run: \`struere dev --force\`
`
}
