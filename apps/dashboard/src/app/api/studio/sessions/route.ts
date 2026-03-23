import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { api, internal } from "@convex/_generated/api"
import { createSandbox } from "@/lib/studio/e2b"
import { getConvexClient, getAdminConvexClient } from "@/lib/studio/client"

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
  console.log(`[studio/sessions] acpPost url=${url.toString()} method=${body.method}`)
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`[studio/sessions] acpPost response status=${res.status} body=${text.slice(0, 500)}`)
  let json: Record<string, unknown> | null = null
  try { json = JSON.parse(text) } catch (e) {
    console.error(`[studio/sessions] acpPost JSON parse failed:`, e)
  }
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
  }, { agent: "opencode" })

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

const PROVIDER_ENV_VARS: Record<string, { envVar: string; platformVar: string }> = {
  xai: { envVar: "OPENAI_API_KEY", platformVar: "XAI_API_KEY" },
  anthropic: { envVar: "ANTHROPIC_API_KEY", platformVar: "ANTHROPIC_API_KEY" },
  openai: { envVar: "OPENAI_API_KEY", platformVar: "OPENAI_API_KEY" },
  google: { envVar: "GOOGLE_GENERATIVE_AI_API_KEY", platformVar: "GOOGLE_GENERATIVE_AI_API_KEY" },
  openrouter: { envVar: "OPENAI_API_KEY", platformVar: "OPENROUTER_API_KEY" },
}

function parseModelId(modelId: string): { provider: string; modelName: string } {
  const slashIdx = modelId.indexOf("/")
  if (slashIdx === -1) return { provider: "xai", modelName: modelId }
  return { provider: modelId.slice(0, slashIdx), modelName: modelId.slice(slashIdx + 1) }
}

export async function POST(request: Request) {
  const { getToken } = await auth()
  const token = await getToken({ template: "convex" })
  if (!token) {
    console.error("[studio/sessions] POST auth failed: no token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  console.log("[studio/sessions] POST auth success")
  const convex = getConvexClient(token)

  const body = await request.json()
  console.log("[studio/sessions] POST request body:", JSON.stringify(body))
  const {
    environment = "development",
    model = "xai/grok-4-1-fast",
  } = body

  const { provider } = parseModelId(model)

  let sessionId: string | null = null
  let sandboxId: string | null = null

  try {
    let llmApiKey: string | undefined

    const org = await convex.query(api.organizations.getCurrent, {})
    if (!org) {
      throw new Error("Organization not found")
    }

    const adminConvex = getAdminConvexClient()
    const resolved = await adminConvex.query(internal.providers.resolveStudioKeyInternal, {
      organizationId: org._id,
      modelId: model,
    })
    if (resolved?.apiKey) {
      llmApiKey = resolved.apiKey
    } else {
      const { balance } = await convex.query(api.billing.getBalance, {})
      console.log(`[studio/sessions] Credits balance=${balance}`)
      if (balance <= 0) {
        console.error("[studio/sessions] Insufficient credits")
        return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
      }
      const orgKey = await adminConvex.action(internal.orgKeys.provisionOrgKey, {
        organizationId: org._id,
      })
      llmApiKey = orgKey.encryptedKey
    }

    const keySource = resolved.tier < 3 ? "custom" as const : "platform" as const
    sessionId = await convex.mutation(api.sandboxSessions.create, {
      environment,
      agentType: "opencode",
      model,
      provider,
      keySource,
    })
    console.log(`[studio/sessions] Session created sessionId=${sessionId}`)

    const studioKey = await adminConvex.mutation(internal.apiKeys.ensureStudioKey, {
      organizationId: org._id,
      environment,
    })
    console.log(`[studio/sessions] Studio key resolved id=${studioKey.id}`)

    await convex.mutation(api.sandboxSessions.updateStatus, {
      id: sessionId,
      status: "provisioning",
      apiKeyId: studioKey.id,
    })
    console.log(`[studio/sessions] Status updated to provisioning`)

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!
    const claudeMd = buildClaudeMd(org.name, environment)

    const envVars: Record<string, string> = {
      STRUERE_API_KEY: studioKey.key,
      STRUERE_CONVEX_URL: convexUrl,
      OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: "32768",
    }

    let sandboxModel = model
    if (resolved.tier >= 2) {
      if (llmApiKey) envVars.OPENAI_API_KEY = llmApiKey
      const { modelName } = parseModelId(model)
      const openrouterModelName = provider === "openrouter" ? modelName : model
      sandboxModel = `openrouter/${openrouterModelName}`
    } else {
      const providerEnv = PROVIDER_ENV_VARS[provider]
      if (llmApiKey && providerEnv) envVars[providerEnv.envVar] = llmApiKey
    }
    if (process.env.E2B_API_KEY) envVars.E2B_API_KEY = process.env.E2B_API_KEY

    const registryEntry = await adminConvex.query(internal.modelPricing.getRegistryEntry, { struereId: model })

    const sandbox = await createSandbox({
      envVars,
      orgInfo: { id: org._id, slug: org.slug, name: org.name },
      apiKey: studioKey.key,
      convexUrl,
      claudeMd,
      model: sandboxModel,
      contextWindow: registryEntry?.contextWindow,
      maxOutput: registryEntry?.maxOutput,
    })
    sandboxId = sandbox.sandboxId
    console.log(`[studio/sessions] Sandbox created sandboxId=${sandbox.sandboxId} url=${sandbox.sandboxUrl}`)

    const { serverId, agentSessionId } = await createAcpSession(
      sandbox.sandboxUrl,
      "/workspace",
    )
    console.log(`[studio/sessions] ACP session created serverId=${serverId} agentSessionId=${agentSessionId}`)

    await convex.mutation(api.sandboxSessions.updateStatus, {
      id: sessionId,
      status: "ready",
      sandboxId: sandbox.sandboxId,
      sandboxUrl: sandbox.sandboxUrl,
      agentSessionId,
      acpServerId: serverId,
    })
    console.log(`[studio/sessions] Status updated to ready`)

    return NextResponse.json({ sessionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[studio/sessions] POST failed:", message, error instanceof Error ? error.stack : "")

    if (sandboxId) {
      try {
        const { destroySandbox } = await import("@/lib/studio/e2b")
        await destroySandbox(sandboxId)
      } catch (e) {
        console.error("[studio/sessions] Cleanup: failed to destroy sandbox:", e)
      }
    }

    if (sessionId) {
      try {
        await convex.mutation(api.sandboxSessions.updateStatus, {
          id: sessionId,
          status: "error",
          errorMessage: message,
        })
      } catch (e) {
        console.error("[studio/sessions] Cleanup: failed to update session status:", e)
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
- Use \`struere sync\` to sync changes to the platform (one-shot, exits after sync)
- The project uses TypeScript with ESM modules

## File Structure
- \`agents/\` — Agent definitions (defineAgent)
- \`entity-types/\` — Data type schemas (defineData)
- \`roles/\` — RBAC role definitions (defineRole)
- \`triggers/\` — Event triggers (defineTrigger)
- \`tools/\` — Custom tool handlers (defineTools)

## SDK Imports
\`\`\`typescript
import { defineAgent, defineData, defineRole, defineTrigger, defineTools } from 'struere'
\`\`\`

## Key Conventions
- Agent model default: \`{ model: "xai/grok-4-1-fast" }\`
- Built-in tools: entity.create/get/query/update/delete/link/unlink, event.emit/query, calendar.*, whatsapp.*, agent.chat
- Schema format: JSON Schema (type: "object", properties, required)
- Policy effect: "allow" or "deny" (deny overrides allow)
- Scope rule operators: "eq", "neq", "in", "contains"
- After making changes, run: \`struere sync\`
`
}
