import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "Google-Extended",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Amazonbot",
          "FacebookBot",
          "Meta-ExternalAgent",
        ],
        allow: "/",
      },
    ],
    sitemap: "https://struere.dev/sitemap.xml",
    host: "https://struere.dev",
  }
}
