import { Sandbox } from "@e2b/code-interpreter"

const SANDBOX_AGENT_PORT = 3000
const SANDBOX_AGENT_VERSION = "0.2.x"

export interface SandboxConfig {
  envVars: Record<string, string>
  files: Array<{ path: string; content: string }>
  agentType: "opencode" | "claude"
  corsOrigin?: string
}

export interface SandboxResult {
  sandboxId: string
  sandboxUrl: string
}

async function runChecked(sandbox: Sandbox, cmd: string, opts: { timeoutMs: number }) {
  const result = await sandbox.commands.run(cmd, opts)
  if (result.exitCode !== 0) {
    throw new Error(`Command failed (exit ${result.exitCode}): ${cmd}\n${result.stderr || result.stdout}`)
  }
  return result
}

export async function createSandbox(config: SandboxConfig): Promise<SandboxResult> {
  const sandbox = await Sandbox.create({
    timeoutMs: 300_000,
    envs: config.envVars,
    allowInternetAccess: true,
  })

  for (const file of config.files) {
    await sandbox.files.write(file.path, file.content)
  }

  await runChecked(
    sandbox,
    `curl -fsSL https://releases.rivet.dev/sandbox-agent/${SANDBOX_AGENT_VERSION}/install.sh | sh`,
    { timeoutMs: 60_000 }
  )

  await runChecked(sandbox, `sandbox-agent install-agent ${config.agentType}`, {
    timeoutMs: 120_000,
  })

  await runChecked(sandbox, "npm install -g struere@latest", {
    timeoutMs: 60_000,
  })

  const corsFlag = config.corsOrigin
    ? ` --cors-allow-origin "${config.corsOrigin}"`
    : ""

  await sandbox.commands.run(
    `sandbox-agent server --no-token --host 0.0.0.0 --port ${SANDBOX_AGENT_PORT}${corsFlag}`,
    { background: true, timeoutMs: 0 }
  )

  await waitForServer(sandbox, SANDBOX_AGENT_PORT)

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
