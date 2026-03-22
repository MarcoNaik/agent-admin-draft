import { generateWorkspaceContext } from "@/lib/generate-llms"

export const dynamic = "force-static"

export async function GET() {
  const content = generateWorkspaceContext()
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
