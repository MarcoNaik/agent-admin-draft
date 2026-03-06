import { NextResponse } from "next/server"
import { getAllDocs } from "@/lib/content"

export const dynamic = "force-static"

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]+/g, "")
    .replace(/\|[^\n]+\|/g, "")
    .replace(/-{3,}/g, "")
    .replace(/>\s+/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export async function GET() {
  const docs = getAllDocs()
  const index = docs.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    section: doc.section,
    content: stripMarkdown(doc.content).slice(0, 2000),
  }))
  return NextResponse.json(index)
}
