export const dynamic = "force-static"

export async function GET() {
  const prompt = `I want to set up a Struere project (https://struere.dev) — an AI agent platform where I define agents, data types, roles, and automations as TypeScript code.

Step 1: Install the Struere CLI globally
  bun install -g struere

Step 2: Initialize and pull my project
  struere pull
  (This will open a browser to log in, let me select my organization, create the project structure, and download any existing agent configurations)

Step 3: Install the Struere developer skill for coding agents
  npx skills add MarcoNaik/struere-skill --all --yes

After completing these steps, show me the project structure and summarize what was set up. If any step fails, show me the error and suggest a fix.

Documentation: https://docs.struere.dev/llms.txt`
  return new Response(prompt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
