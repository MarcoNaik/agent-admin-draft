---
title: "Embeddable Chat Widget"
description: "Add a Struere AI chatbot to any website with a single script tag"
section: "Integrations"
order: 4
---

# Embeddable Chat Widget

Struere provides a lightweight embeddable widget that adds a floating AI chatbot to any website. Visitors can chat with your deployed agent directly on your page — no authentication required, no framework dependencies.

## How It Works

```
Your Website
    |
    v
<script> tag loads widget.js from app.struere.dev
    |
    v
Widget injects a floating button (bottom-right corner)
    |
    v
User clicks → iframe opens with /embed/{org}/{agent}
    |
    v
Chat runs against your production agent via Convex subscriptions
    |
    v
Messages appear in real time (progressive rendering)
```

The widget loads a small JavaScript file that creates a floating chat bubble on your page. When clicked, it opens an iframe pointing to your agent's embed URL. The iframe handles all communication with the Struere backend — your host page needs no Convex client, no React, no dependencies.

## Quick Start

Add this script tag to your HTML, replacing `ORG_SLUG` and `AGENT_SLUG` with your values:

```html
<script
  src="https://app.struere.dev/embed/widget.js?org=ORG_SLUG&agent=AGENT_SLUG"
  async
  defer
></script>
```

That's it. A chat bubble will appear in the bottom-right corner of your page.

## Finding Your Slugs

Your **org slug** and **agent slug** are visible in the public chat URL for your agent:

```
https://app.struere.dev/chat/{org-slug}/{agent-slug}
```

You can also find these in the Struere dashboard:

- **Org slug**: Settings → Organization → Slug
- **Agent slug**: Agents → Select agent → Settings → Slug

## Configuration

The widget accepts configuration through URL parameters on the script `src`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `org` | (required) | Your organization slug |
| `agent` | (required) | Your agent slug |
| `theme` | `dark` | Chat theme: `dark` or `light` |
| `accent` | `#3B82F6` | Bubble button color (hex, URL-encoded) |
| `position` | `br` | Bubble position: `br` (bottom-right), `bl` (bottom-left), `tr` (top-right), `tl` (top-left) |

### Example with All Options

```html
<script
  src="https://app.struere.dev/embed/widget.js?org=my-company&agent=support-bot&theme=light&accent=%231B4F72&position=bl"
  async
  defer
></script>
```

## Thread Context

You can pass custom context about the current user or session to your agent by adding extra URL parameters to the script tag. Any parameter that isn't a reserved config parameter (`org`, `agent`, `theme`, `position`) is forwarded as thread context.

```html
<script
  src="https://app.struere.dev/embed/widget.js?org=my-company&agent=support-bot&email=jane@example.com&name=Jane&plan=pro"
  async
  defer
></script>
```

The extra parameters (`email`, `name`, `plan`) are stored on the thread as `channelParams` and become available to the agent via system prompt templates:

```
{{threadContext.channel}}          → "widget"
{{threadContext.params.email}}     → "jane@example.com"
{{threadContext.params.name}}      → "Jane"
{{threadContext.params.plan}}      → "pro"
```

### Using Thread Context in System Prompts

Define `threadContextParams` in your agent config to declare what parameters your agent expects:

```typescript
import { defineAgent } from 'struere'

export default defineAgent({
  name: "Support",
  slug: "support-bot",
  version: "0.1.0",
  systemPrompt: `You are a support agent for {{organizationName}}.

Channel: {{threadContext.channel}}
Customer email: {{threadContext.params.email}}
Customer name: {{threadContext.params.name}}
Plan: {{threadContext.params.plan}}

## Customer Profile
{{entity.get({"type": "customer", "id": "{{threadContext.params.customerId}}"})}}

Greet them by name and tailor your responses to their plan level.`,
  model: { provider: "xai", name: "grok-4-1-fast" },
  tools: ["entity.query", "entity.get"],
  threadContextParams: [
    { name: "email", type: "string", required: true, description: "Customer email" },
    { name: "name", type: "string", description: "Customer display name" },
    { name: "plan", type: "string", description: "Subscription plan" },
    { name: "customerId", type: "string", description: "Entity ID for customer lookup" },
  ],
})
```

### Validation

When `threadContextParams` is defined, the backend validates incoming parameters:

- **Required params** — If a param has `required: true` and is missing, the request fails with an error
- **Type checking** — Values are validated against the declared type (`string`, `number`, `boolean`)
- **Unknown params** — Parameters not declared in `threadContextParams` are silently dropped

### Dynamic Widget Parameters

You can set parameters dynamically using JavaScript:

```html
<script>
  const user = getCurrentUser()
  const script = document.createElement("script")
  script.src = `https://app.struere.dev/embed/widget.js?org=my-company&agent=support-bot&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}&customerId=${user.id}`
  script.async = true
  script.defer = true
  document.body.appendChild(script)
</script>
```

### Direct Iframe with Context

Thread context works identically with direct iframe embeds. Add parameters to the iframe `src`:

```html
<iframe
  src="https://app.struere.dev/embed/my-company/support-bot?theme=dark&email=jane@example.com&name=Jane"
  style="width: 100%; height: 600px; border: none; border-radius: 12px;"
  allow="clipboard-read; clipboard-write"
></iframe>
```

## Direct Iframe Embed

If you prefer to embed the chat directly in your page layout (not as a floating widget), use an iframe:

```html
<iframe
  src="https://app.struere.dev/embed/ORG_SLUG/AGENT_SLUG?theme=dark"
  style="width: 100%; height: 600px; border: none; border-radius: 12px;"
  allow="clipboard-read; clipboard-write"
  loading="lazy"
  title="Chat with our AI assistant"
></iframe>
```

The embed page renders a minimal chat UI with no header, no sidebar, and no navigation — just the message input and conversation.

### Iframe Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `theme` | `dark` | Visual theme: `dark` or `light` |

## Events

The widget communicates with your host page via `postMessage`. You can listen for chat events:

```javascript
window.addEventListener("struere:message", function (event) {
  console.log("Thread ID:", event.detail.threadId)
  console.log("Agent response:", event.detail.message)
})
```

### Event Types

| Event | Detail Fields | Description |
|-------|--------------|-------------|
| `struere:message` | `threadId`, `message` | Fired when the agent responds to a message |

## Requirements

For the widget to work, your agent must be:

1. **Deployed to production** — The embed uses the production environment. Run `struere deploy` or deploy from the dashboard.
2. **Status: active** — Agents with status `deleted` or `draft` will show "Agent Not Found".
3. **Has a production config** — The agent needs an `agentConfig` for the `production` environment.

No API key is needed. The embed uses the public chat action which resolves the agent by org slug + agent slug and runs it in the production environment with a system actor context.

## Security

The embed route serves these headers to allow iframe embedding on any domain:

```
X-Frame-Options: ALLOWALL
Content-Security-Policy: frame-ancestors *
```

The chat operates in **public mode** — tool call details, tool results, and system messages are hidden from the user. Only user messages and assistant text responses are displayed.

## Architecture

```
Host Page (your-site.com)
    |
    |-- widget.js (served from app.struere.dev, cached 1 hour)
    |       |
    |       |-- Creates floating button (position: fixed)
    |       |-- Creates iframe container (position: fixed)
    |       |-- Handles open/close toggle with animation
    |
    v
Iframe (app.struere.dev/embed/{org}/{agent})
    |
    |-- ChatInterface component (mode="public", embedded=true)
    |       |
    |       |-- usePublicThreadMessages (Convex subscription)
    |       |-- sendPublicChat (Convex action)
    |
    v
Convex Backend
    |
    |-- publicChat.sendPublicChat → agent.chatAuthenticated
    |-- Progressive message writing (onStepFinish)
    |-- publicChat.getPublicThreadMessages (real-time subscription)
```

Messages appear progressively as the agent processes each step. The user sees their message immediately, then the agent's response streams in as it becomes available — no spinner waiting for the full response.

## Troubleshooting

**Widget doesn't appear**

- Check your browser console for errors
- Verify the org and agent slugs are correct
- Ensure the script tag has `async` and `defer` attributes
- Confirm the agent is deployed to production and has status `active`

**"Agent Not Found" in the chat**

- The agent doesn't have a production config. Deploy it with `struere deploy`.
- The org slug or agent slug is wrong. Check the public chat URL in the dashboard.
- The agent status is not `active`.

**Chat loads but messages fail**

- The agent's LLM provider key may not be configured. Check provider configs in the dashboard.
- The organization may have insufficient credits if using platform keys.

**iframe blocked by CSP**

If your host page has a strict Content-Security-Policy, add the Struere domain to your `frame-src` directive:

```
Content-Security-Policy: frame-src https://app.struere.dev;
```
