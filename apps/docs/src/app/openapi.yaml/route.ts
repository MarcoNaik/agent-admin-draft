import fs from "fs"
import path from "path"

export const dynamic = "force-static"

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "openapi.yaml")
  const content = fs.readFileSync(filePath, "utf-8")
  return new Response(content, {
    headers: { "Content-Type": "text/yaml; charset=utf-8" },
  })
}
