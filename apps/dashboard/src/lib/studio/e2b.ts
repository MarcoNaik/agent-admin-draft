import { Sandbox } from "@e2b/code-interpreter"

const SANDBOX_AGENT_PORT = 3000
const SANDBOX_AGENT_VERSION = "0.2.x"

export interface SandboxConfig {
  envVars: Record<string, string>
  orgInfo: { id: string; slug: string; name: string }
  apiKey: string
  convexUrl: string
  claudeMd: string
  agentType: "opencode" | "claude"
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
      content: JSON.stringify({
        $schema: "https://opencode.ai/config.json",
        provider: {
          openai: {
            options: {
              baseURL: "https://api.x.ai/v1",
            },
            models: {
              "grok-4-1-fast": { name: "Grok 4.1 Fast", limit: { context: 131072, output: 32768 } },
            },
          },
        },
        model: "openai/grok-4-1-fast",
        instructions: ["CLAUDE.md"],
        permission: {
          webfetch: "allow",
          websearch: "allow",
        },
      }, null, 2),
    },
  ]
}

export async function createSandbox(config: SandboxConfig): Promise<SandboxResult> {
  const sandbox = await Sandbox.create({
    timeoutMs: 300_000,
    envs: config.envVars,
    allowInternetAccess: true,
  })

  try {
    const bootstrapFiles = generateBootstrapFiles(config)
    for (const file of bootstrapFiles) {
      await sandbox.files.write(file.path, file.content)
    }

    await runCmd(
      sandbox,
      "install-sandbox-agent",
      `curl -fsSL https://releases.rivet.dev/sandbox-agent/${SANDBOX_AGENT_VERSION}/install.sh | sh`,
      { timeoutMs: 60_000 }
    )

    await runCmd(sandbox, "install-agent", `sandbox-agent install-agent ${config.agentType}`, {
      timeoutMs: 120_000,
    })

    await runCmd(sandbox, "install-bun", "curl -fsSL https://bun.sh/install | bash && ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun && ln -sf $HOME/.bun/bin/bunx /usr/local/bin/bunx", {
      timeoutMs: 30_000,
    })

    await runCmd(sandbox, "install-struere", 'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && sudo npm install -g struere@latest', {
      timeoutMs: 60_000,
    })

    await runCmd(sandbox, "struere-pull", 'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:/usr/local/bin:$PATH" && cd /workspace && struere pull --force', {
      timeoutMs: 60_000,
    })

    await sandbox.commands.run(
      `sandbox-agent server --no-token --host 0.0.0.0 --port ${SANDBOX_AGENT_PORT}`,
      { background: true, timeoutMs: 0 }
    )

    await waitForServer(sandbox, SANDBOX_AGENT_PORT)
  } catch (error) {
    await Sandbox.kill(sandbox.sandboxId).catch(() => {})
    throw error
  }

  const sandboxUrl = `https://${sandbox.getHost(SANDBOX_AGENT_PORT)}`

  return {
    sandboxId: sandbox.sandboxId,
    sandboxUrl,
  }
}

async function waitForServer(sandbox: Sandbox, port: number, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await sandbox.commands.run(`curl -sf http://127.0.0.1:${port}/v1/health`, {
        timeoutMs: 3000,
      })
      if (result.exitCode === 0) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("Sandbox agent server failed to start")
}

export async function destroySandbox(sandboxId: string) {
  await Sandbox.kill(sandboxId)
}
