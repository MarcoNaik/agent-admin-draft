import { customAlphabet } from "nanoid"

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
const nanoid = customAlphabet(alphabet, 12)

export function generateId(prefix: string): string {
  return `${prefix}_${nanoid()}`
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export function generateApiKey(): { key: string; prefix: string } {
  const prefix = `af_live_${nanoid(8)}`
  const secret = nanoid(32)
  return {
    key: `${prefix}_${secret}`,
    prefix,
  }
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function buildSearchText(
  data: Record<string, unknown>,
  searchFields?: string[]
): string {
  if (!searchFields || searchFields.length === 0) {
    return Object.values(data)
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase()
  }

  return searchFields
    .map((field) => {
      const value = data[field]
      return typeof value === "string" ? value : ""
    })
    .join(" ")
    .toLowerCase()
}
