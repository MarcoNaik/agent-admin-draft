import { Sandbox } from "@e2b/code-interpreter"

const SANDBOX_AGENT_PORT = 3000
const SANDBOX_AGENT_VERSION = "0.2.x"
const SANDBOX_TIMEOUT_MS = 1_800_000

export interface SandboxConfig {
  envVars: Record<string, string>
  orgInfo: { id: string; slug: string; name: string }
  apiKey: string
  convexUrl: string
  claudeMd: string
  model: string
  contextWindow?: number
  maxOutput?: number
}

export interface SandboxResult {
  sandboxId: string
  sandboxUrl: string
}

async function runCmd(sandbox: Sandbox, label: string, cmd: string, opts: { timeoutMs: number }) {
  try {
    const result = await sandbox.commands.run(cmd, opts)
    if (result.exitCode !== 0) {
      throw new Error(`stderr: ${result.stderr}\nstdout: ${result.stdout}`)
    }
    return result
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`[${label}] failed: ${detail}`)
  }
}

function parseModelId(modelId: string): { provider: string; modelName: string } {
  const slashIdx = modelId.indexOf("/")
  if (slashIdx === -1) return { provider: "xai", modelName: modelId }
  return { provider: modelId.slice(0, slashIdx), modelName: modelId.slice(slashIdx + 1) }
}

function buildOpenCodeConfig(modelId: string, contextWindow?: number, maxOutput?: number): Record<string, unknown> {
  const { provider, modelName } = parseModelId(modelId)
  const ctx = contextWindow ?? 200000
  const out = maxOutput ?? 32768
  const base = {
    $schema: "https://opencode.ai/config.json",
    instructions: ["CLAUDE.md"],
    permission: { webfetch: "allow", websearch: "allow" },
  }

  switch (provider) {
    case "xai":
      return {
        ...base,
        provider: {
          openai: {
            options: { baseURL: "https://api.x.ai/v1" },
            models: {
              [modelName]: { name: modelName, limit: { context: ctx, output: out } },
            },
          },
        },
        model: `openai/${modelName}`,
      }
    case "anthropic":
      return {
        ...base,
        provider: {
          anthropic: {
            models: {
              [modelName]: { name: modelName, limit: { context: ctx, output: out } },
            },
          },
        },
        model: `anthropic/${modelName}`,
      }
    case "openai":
      return {
        ...base,
        provider: {
          openai: {
            models: {
              [modelName]: { name: modelName, limit: { context: ctx, output: out } },
            },
          },
        },
        model: `openai/${modelName}`,
      }
    case "google":
      return {
        ...base,
        provider: {
          google: {
            models: {
              [modelName]: { name: modelName, limit: { context: ctx, output: out } },
            },
          },
        },
        model: `google/${modelName}`,
      }
    case "openrouter":
      return {
        ...base,
        provider: {
          openai: {
            options: { baseURL: "https://openrouter.ai/api/v1", headers: { "HTTP-Referer": "https://struere.dev", "X-Title": "Struere" } },
            models: {
              [modelName]: { name: modelName, limit: { context: ctx, output: out } },
            },
          },
        },
        model: `openai/${modelName}`,
      }
    default:
      return {
        ...base,
        provider: {
          openai: {
            options: { baseURL: "https://openrouter.ai/api/v1", headers: { "HTTP-Referer": "https://struere.dev", "X-Title": "Struere" } },
            models: {
              [modelId]: { name: modelId, limit: { context: ctx, output: out } },
            },
          },
        },
        model: `openai/${modelId}`,
      }
  }
}

function generateBootstrapFiles(config: SandboxConfig): Array<{ path: string; content: string }> {
  return [
    {
      path: "/workspace/struere.json",
      content: JSON.stringify(
        { version: "2.0", organization: { id: config.orgInfo.id, slug: config.orgInfo.slug, name: config.orgInfo.name } },
        null, 2
      ),
    },
    {
      path: "/workspace/package.json",
      content: JSON.stringify(
        {
          name: config.orgInfo.slug,
          version: "0.1.0",
          type: "module",
          scripts: { sync: "struere sync", deploy: "struere deploy", status: "struere status" },
          devDependencies: { "bun-types": "^1.0.0", typescript: "^5.3.0" },
        },
        null, 2
      ),
    },
    {
      path: "/workspace/tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022", module: "ESNext", moduleResolution: "bundler",
            lib: ["ES2022"], strict: true, esModuleInterop: true,
            skipLibCheck: true, forceConsistentCasingInFileNames: true,
            outDir: "dist", rootDir: ".", types: ["bun-types"],
            paths: { struere: ["./.struere/index.js"] },
          },
          include: ["**/*.ts"],
          exclude: ["node_modules", "dist", ".struere"],
        },
        null, 2
      ),
    },
    {
      path: "/workspace/.env",
      content: `STRUERE_API_KEY=${config.apiKey}\nSTRUERE_CONVEX_URL=${config.convexUrl}\n`,
    },
    {
      path: "/workspace/CLAUDE.md",
      content: config.claudeMd,
    },
    {
      path: "/workspace/opencode.json",
      content: JSON.stringify(buildOpenCodeConfig(config.model, config.contextWindow, config.maxOutput), null, 2),
    },
  ]
}

export async function createSandbox(config: SandboxConfig): Promise<SandboxResult> {
  console.log("[studio/e2b] createSandbox: starting sandbox creation")
  const sandbox = await Sandbox.create({
    timeoutMs: SANDBOX_TIMEOUT_MS,
    envs: config.envVars,
    allowInternetAccess: true,
  })
  console.log(`[studio/e2b] createSandbox: sandbox created, id=${sandbox.sandboxId}`)

  try {
    console.log("[studio/e2b] createSandbox: writing bootstrap files")
    const bootstrapFiles = generateBootstrapFiles(config)
    for (const file of bootstrapFiles) {
      await sandbox.files.write(file.path, file.content)
    }
    console.log("[studio/e2b] createSandbox: bootstrap files written")

    console.log("[studio/e2b] createSandbox: step install-sandbox-agent start")
    await runCmd(
      sandbox,
      "install-sandbox-agent",
      `curl -fsSL https://releases.rivet.dev/sandbox-agent/${SANDBOX_AGENT_VERSION}/install.sh | sh`,
      { timeoutMs: 60_000 }
    )
    console.log("[studio/e2b] createSandbox: step install-sandbox-agent end")

    console.log("[studio/e2b] createSandbox: step install-agent start")
    await runCmd(sandbox, "install-agent", "sandbox-agent install-agent opencode", {
      timeoutMs: 120_000,
    })
    console.log("[studio/e2b] createSandbox: step install-agent end")

    console.log("[studio/e2b] createSandbox: step install-bun start")
    await runCmd(sandbox, "install-bun", "curl -fsSL https://bun.sh/install | bash && ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun && ln -sf $HOME/.bun/bin/bunx /usr/local/bin/bunx", {
      timeoutMs: 30_000,
    })
    console.log("[studio/e2b] createSandbox: step install-bun end")

    console.log("[studio/e2b] createSandbox: step install-struere start")
    await runCmd(sandbox, "install-struere", 'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && sudo npm install -g struere@0.9.7', {
      timeoutMs: 60_000,
    })
    console.log("[studio/e2b] createSandbox: step install-struere end")

    console.log("[studio/e2b] createSandbox: step struere-pull start")
    await runCmd(sandbox, "struere-pull", 'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:/usr/local/bin:$PATH" && cd /workspace && struere pull --force', {
      timeoutMs: 60_000,
    })
    console.log("[studio/e2b] createSandbox: step struere-pull end")

    console.log("[studio/e2b] createSandbox: starting sandbox-agent server")
    await sandbox.commands.run(
      `sandbox-agent server --no-token --host 0.0.0.0 --port ${SANDBOX_AGENT_PORT}`,
      { background: true, timeoutMs: 0 }
    )

    console.log("[studio/e2b] createSandbox: waiting for server to be ready")
    await waitForServer(sandbox, SANDBOX_AGENT_PORT)
    console.log("[studio/e2b] createSandbox: server is ready")
  } catch (error) {
    console.error("[studio/e2b] createSandbox: bootstrap failed, killing sandbox", sandbox.sandboxId, error)
    await Sandbox.kill(sandbox.sandboxId).catch((killError) => {
      console.error("[studio/e2b] createSandbox: failed to kill sandbox after error", sandbox.sandboxId, killError)
    })
    throw error
  }

  const sandboxUrl = `https://${sandbox.getHost(SANDBOX_AGENT_PORT)}`
  console.log(`[studio/e2b] createSandbox: complete, id=${sandbox.sandboxId}, url=${sandboxUrl}`)

  return {
    sandboxId: sandbox.sandboxId,
    sandboxUrl,
  }
}

async function waitForServer(sandbox: Sandbox, port: number, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      console.log(`[studio/e2b] waitForServer: attempt ${i + 1}/${maxAttempts}`)
      const result = await sandbox.commands.run(`curl -sf http://127.0.0.1:${port}/v1/health`, {
        timeoutMs: 3000,
      })
      if (result.exitCode === 0) return
    } catch (error) {
      console.error(`[studio/e2b] waitForServer: attempt ${i + 1} failed`, error)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("Sandbox agent server failed to start")
}

export async function extendSandboxTimeout(sandboxId: string) {
  await Sandbox.setTimeout(sandboxId, SANDBOX_TIMEOUT_MS)
}

export async function destroySandbox(sandboxId: string) {
  try {
    await Sandbox.kill(sandboxId)
    console.log(`[studio/e2b] destroySandbox: successfully killed sandbox ${sandboxId}`)
  } catch (error) {
    console.error(`[studio/e2b] destroySandbox: failed to kill sandbox ${sandboxId}`, error)
    throw error
  }
}
