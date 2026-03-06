export const dynamic = "force-static"

const content = `# Struere

> Permission-aware AI agent platform. Describe what your business needs and Struere builds AI agents that handle it — no code, no hassle.

## Links

- Website: https://struere.dev
- Dashboard: https://app.struere.dev
- Documentation: https://docs.struere.dev
- Full documentation for LLMs: https://docs.struere.dev/llms-full.txt

## How It Works

1. **Describe your idea** — Write in plain language what you need. No coding required — just explain what you want your agent to do.
2. **Struere builds it** — AI models assemble a working agent with access to your database, WhatsApp, and calendar. Set up permissions, connect integrations, and deploy.
3. **Launch and scale** — Your agent deploys instantly on WhatsApp or via the API. See every conversation in your inbox, step in when needed, and track usage and costs per agent.

## Use Cases

- **Customer support** — WhatsApp bot that answers questions and resolves issues with human handoff.
- **Automatic scheduling** — Agents that book appointments, send reminders, and handle cancellations.
- **Collections & follow-up** — Agents that send payment reminders and follow up on overdue invoices.
- **E-commerce** — Assistants that answer product questions and take orders via WhatsApp.
- **Task automation** — Triggers that fire actions when records change status: WhatsApp messages, data updates, scheduled follow-ups with retries.
- **Restaurants** — Agents that take orders, confirm reservations, and answer menu questions.

## Integrations

### AI Models
- GPT (OpenAI)
- Claude (Anthropic)
- Gemini (Google)
- Grok (xAI)
- 40+ models supported

### Channels & Services
- WhatsApp Business
- Google Calendar

## Pricing

### Bring Your Own Keys — $0

Use your own API keys from OpenAI, Anthropic, or xAI. Struere charges nothing.

Includes: Unlimited agents, WhatsApp, Calendar, API, local CLI development, agent-to-agent delegation, analytics & monitoring, no platform fees.

### Studio (Browser) — Pay As You Go

Buy credits and use Studio, the built-in AI sandbox. Provider rates + 10% on LLM tokens only. No subscriptions.

| Model | Input | Output |
|-------|-------|--------|
| grok-4-1-fast (default) | $0.22 | $0.55 |
| gemini-2.5-flash | $0.33 | $2.75 |
| claude-haiku-4.5 | $1.10 | $5.50 |
| gpt-4o | $2.75 | $11.00 |
| claude-sonnet-4 | $3.30 | $16.50 |

## Platform Capabilities

- **Permission engine** — Role-based access control (RBAC) with row-level security (scope rules) and column-level security (field masks).
- **Environment isolation** — Separate development and production environments across all data and permissions.
- **Built-in tools** — Entity CRUD, event system, calendar, WhatsApp messaging, agent-to-agent delegation.
- **Custom tools** — Write handler code executed in sandboxed environments on Fly.io.
- **Triggers** — Immediate or scheduled actions with retry, fired on entity state changes.
- **Real-time** — Native Convex subscriptions for live data.
- **CLI** — \`struere dev\` for local development, \`struere deploy\` for production.

## Tech Stack

- Next.js 14 + TypeScript (frontend)
- Convex (real-time backend)
- Hono on Fly.io (tool execution sandbox)
- Clerk (authentication)

## Contact

- Email: hello@struere.dev
- Legal: legal@struere.dev
- Privacy: privacy@struere.dev

## Pages

- [Privacy Policy](https://struere.dev/privacy-policy)
- [Terms of Service](https://struere.dev/terms-of-service)
- [Documentation](https://docs.struere.dev)
`

export async function GET() {
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
