export const dynamic = "force-static"

const content = `# Struere

> Struere is an AI agent platform for business automation. Users describe what they need in natural language, and Struere builds AI agents that handle customer support, appointments, payments, and more — with a built-in data layer, integrations, and multi-agent orchestration.

## Key Features

- Natural language agent creation — describe what you need, AI builds it
- Built-in data layer with entity types, relations, and real-time queries
- Multi-agent orchestration with depth limits and cycle detection
- WhatsApp Business, Google Calendar, Airtable, email, and payment integrations
- Role-based access control with scope rules and field masks
- Dynamic system prompts with template variables and conditional blocks
- 40+ LLM models supported via OpenRouter (GPT, Claude, Gemini, Grok)
- Environment isolation (development, production, eval)
- CLI for local development with watch mode and deployment
- SDK for defining agents, data types, roles, and triggers in code

## Use Cases

- Customer support with FAQ, order tracking, and escalation
- Booking systems with calendar sync and reminders
- Payment collection with reminders and auto-retry
- E-commerce product advisors with inventory checks
- Multi-agent teams with coordinated workflows
- Notification systems for order status updates

## Links

- [Documentation](https://docs.struere.dev)
- [Getting Started](https://docs.struere.dev/getting-started/quickstart)
- [SDK Reference](https://docs.struere.dev/sdk/overview)
- [API Reference](https://docs.struere.dev/api/overview)
- [CLI Reference](https://docs.struere.dev/cli/overview)
`

export async function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
