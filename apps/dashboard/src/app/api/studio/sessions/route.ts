import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { api } from "@convex/_generated/api"
import { createSandbox } from "@/lib/studio/e2b"
import { generateProjectFiles } from "@/lib/studio/project"
import { getConvexClient } from "@/lib/studio/client"

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

    const pullState = await convex.query(api.sync.getPullState, { environment })

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

    const claudeMd = buildClaudeMd(org.name, environment)

    const projectFiles = generateProjectFiles(
      pullState,
      { id: org._id, slug: org.slug, name: org.name },
      apiKeyResult.key,
      process.env.NEXT_PUBLIC_CONVEX_URL!,
      claudeMd,
    )

    const envVars: Record<string, string> = {
      STRUERE_API_KEY: apiKeyResult.key,
      STRUERE_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL!,
    }
    if (process.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    if (process.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (process.env.E2B_API_KEY) envVars.E2B_API_KEY = process.env.E2B_API_KEY

    const sandbox = await createSandbox({
      envVars,
      files: projectFiles,
      agentType,
    })
    sandboxId = sandbox.sandboxId

    const { SandboxAgent } = await import("sandbox-agent")
    const sdk = await SandboxAgent.connect({ baseUrl: sandbox.sandboxUrl })

    const session = await sdk.createSession({
      agent: agentType,
      sessionInit: {
        cwd: "/workspace",
        mcpServers: [],
      },
    })

    await convex.mutation(api.sandboxSessions.updateStatus, {
      id: sessionId,
      status: "ready",
      sandboxId: sandbox.sandboxId,
      sandboxUrl: sandbox.sandboxUrl,
      agentSessionId: session.id,
    })

    await sdk.dispose().catch(() => {})

    return NextResponse.json({ sessionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    if (sandboxId) {
      try {
        const { destroySandbox } = await import("@/lib/studio/e2b")
        await destroySandbox(sandboxId)
      } catch {
        // best effort
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
        // best effort
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
