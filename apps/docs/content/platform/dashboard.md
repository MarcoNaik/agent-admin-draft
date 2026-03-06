---
title: "Dashboard"
description: "Navigate and use the Struere dashboard to manage your agents and data"
section: "Platform Concepts"
order: 9
---

# Dashboard

The Struere dashboard is a Next.js application that provides a real-time interface for managing your agents, data, conversations, and platform settings. It connects to your Convex backend via real-time subscriptions, so all views update instantly when data changes. Authentication is handled by Clerk.

## Navigation

The top header bar contains the primary navigation. The items shown depend on your role in the organization.

### Admin Navigation

Organization admins see the full navigation set:

| Tab | Route | Description |
|-----|-------|-------------|
| **Conversations** | `/conversations` | Thread list, message history, WhatsApp management |
| **Data** | `/entities` | Data type browser with record CRUD |
| **Roles** | `/roles` | Role definitions, policies, scope rules, field masks |
| **Tools** | `/tools` | Built-in and custom tool reference |
| **Automations** | `/triggers` | Trigger definitions and execution history |
| **Settings** | `/settings` | Organization configuration |

### Member Navigation

Non-admin members see a reduced navigation:

| Tab | Route | Description |
|-----|-------|-------------|
| **Data** | `/entities` | Data browser (filtered by permissions) |
| **Conversations** | `/conversations` | Conversations the member has access to |
| **Profile** | `/profile` | Personal profile settings |

### Header Controls

The right side of the header contains additional controls, some of which are admin-only:

- **Docs** — Links to `docs.struere.dev` in a new tab.
- **Studio** — Toggle the in-browser coding sandbox (admin only). See [Studio](./studio) for details.
- **Environment Selector** — Switch between development and production (admin only). See the section below.
- **Notifications** — Bell icon for sync and system notifications (admin only).
- **Theme Toggle** — Switch between light and dark mode.
- **User Button** — Clerk user menu for account settings and sign out.

The header also includes an **Organization Switcher** and an **Agent Switcher** in the breadcrumb area. The org switcher lets you switch between organizations or create a new one. The agent switcher lets you jump directly to any agent's detail page.

## Environment Selector

The environment selector in the header toggles between **Development** and **Production**. A green dot indicates production; a yellow dot indicates development. The selected environment is persisted to `localStorage` and affects every view in the dashboard.

All environment-scoped data — agents configs, data types, records, roles, conversations, events, triggers, integrations, API keys — is filtered by the active environment. Switching environments gives you a completely separate view of your platform.

Non-admin members are locked to the production environment. The selector is only visible to organization admins.

## Home Page

The root route (`/`) displays an overview of your project in the current environment:

**Agents** — A list of all agents in the organization. Each row shows the agent name, description, and an active status indicator. Clicking an agent navigates to its detail page.

**Overview** — Summary stat cards linking to key sections:
- Conversations count (links to `/conversations`)
- Data Types count (links to `/entities`)
- Roles count (links to `/roles`)
- Automations count (links to `/triggers`)

## Agent Management

### Agent List

The `/agents` route shows all agents in the organization. Create a new agent from `/agents/new`.

### Agent Detail

Selecting an agent opens a detail view at `/agents/[agentId]` with a sidebar containing the following sections:

| Section | Description |
|---------|-------------|
| **Overview** | Agent name, deployment status, chat URL, API endpoint, execution stats (total, success rate, avg duration, tokens), and recent execution history |
| **Config** | Current agent configuration for the selected environment — system prompt, model, version, and tool list with parameter schemas. Includes a compiled system prompt preview |
| **Tools** | All tools assigned to the agent, categorized as entity, event, or custom. Expandable to view parameter schemas and descriptions |
| **Logs** | Execution log with status, duration, token usage, and timestamps |
| **Evals** | Evaluation suites with test cases. Run evals from the dashboard, view results and scores per suite. Navigate into individual suites, cases, and run results |
| **Settings** | Agent-level settings |

A **Chat** toggle at the bottom of the sidebar opens a slide-out chat panel where you can send messages to the agent directly from the dashboard and see real-time responses with tool call visualization.

The agent overview page displays two ready-to-use URLs:
- **Chat UI** — A hosted chat interface for the agent (different URLs for development vs production)
- **API Endpoint** — The REST endpoint at `/v1/agents/:slug/chat` for programmatic access

## Conversations

The `/conversations` route provides a split-pane view for managing all conversation threads.

### Thread List

The left panel lists all threads in the current environment, showing:
- Agent name
- Participant name or phone number
- Last message preview with timestamp
- Channel badge indicating the source

### Channels

Each thread is tagged with a channel indicating how the conversation was initiated:

| Channel | Description |
|---------|-------------|
| **Widget** | Embedded chat widget on a website |
| **WhatsApp** | WhatsApp conversation via Kapso integration |
| **API** | Programmatic access via the Chat API |
| **Dashboard** | Conversation started from the dashboard chat panel |

### Message View

Selecting a thread opens the message history in the right panel. The view includes:
- Full message history with role indicators (user, assistant, system)
- Tool call and tool result visualization as collapsible bubbles
- Timestamps and delivery status for WhatsApp messages (sent, delivered, read, failed)
- A 24-hour messaging window indicator for WhatsApp threads
- Reply input with support for text messages, WhatsApp templates, media attachments, and interactive messages

## Data

The `/entities` route opens the data browser with a sidebar listing all data types in the current environment. The sidebar supports search filtering.

### Data Type View

Selecting a data type from the sidebar loads a table view at `/entities/[type]` with:
- Paginated record list with sortable columns
- Search bar for full-text search across indexed fields
- Status filter dropdown (active, inactive, pending, scheduled, confirmed, completed, cancelled, failed)
- CSV export via clipboard
- Create new record button

### Record Detail

Clicking a record navigates to `/entities/[type]/[id]` which displays:
- All record fields rendered from the data type schema
- Current status with badge
- Edit and delete actions
- **Relations** — Linked records from other data types
- **Timeline** — Event history for the record showing all system events (created, updated, deleted) and custom events

Creating a new record at `/entities/[type]/new` renders a form generated from the data type's JSON Schema.

## Roles

The `/roles` route (admin only) displays all roles defined in the current environment. Each role expands to show:

- **Policies** — Allow or deny rules for resources and actions (create, read, update, delete, list)
- **Scope Rules** — Row-level security filters showing which field, operator, and value restrict access
- **Field Masks** — Column-level security showing which fields are visible or hidden per data type
- **Assigned Users** — Team members currently assigned to the role

For more on how permissions work, see [Permissions](./permissions).

## Tools

The `/tools` route (admin only) provides a reference for all built-in tools available to agents, organized by category:

- **Entity tools** — `entity.create`, `entity.get`, `entity.query`, `entity.update`, `entity.delete`, `entity.link`, `entity.unlink`
- **Event tools** — `event.emit`, `event.query`
- **Agent tools** — `agent.chat`

Each tool entry shows its description, parameter schema with types, and required fields.

For full tool documentation, see [Built-in Tools](../tools/built-in-tools).

## Automations

The `/triggers` route (admin only) lists all triggers in the current environment with:

- Trigger name, slug, and description
- Entity type and action that fires the trigger
- Condition filter (if configured)
- Actions to execute with tool name and arguments
- Schedule configuration (delay, offset, cancel previous)
- Retry settings (max attempts, backoff)
- Enabled/disabled status
- Last run status with timestamp
- Execution history with success/failure counts, retry and cancel actions

For more on triggers, see [Triggers](./triggers).

## Settings

The `/settings` route (admin only) contains a sidebar with the following sections:

### General

Organization name, slug, and your personal profile information (name, email).

### Users

Team member management. View all users in the organization, change org-level roles (admin/member), assign platform roles to users, and invite new members. When a user is assigned a role that is bound to a data type, you can create a linked record for them.

### Integrations

Connect external services to your platform. Each integration shows its current connection status:

| Category | Integration | Description |
|----------|-------------|-------------|
| Communication | **WhatsApp** | AI-powered WhatsApp conversations via Kapso |
| Communication | **Resend** | Transactional email from agents |
| Calendar | **Google Calendar** | Calendar sync and availability checks |
| Data | **Airtable** | Read and write Airtable records |
| Payments | **Flow.cl** | Payment link generation |

See [Integrations](../integrations/whatsapp) for setup guides.

### API Keys

Create and manage API keys for programmatic access to the [Chat API](../api/chat). Keys are environment-scoped. You can create new keys, copy them, toggle visibility, and delete them.

### Providers

Configure your own LLM provider API keys. Supported providers:

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Haiku, Sonnet, Opus |
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo |
| **Google AI** | Gemini 1.5 Pro, Gemini 1.5 Flash |
| **xAI** | Grok models |

Each provider card lets you enter your API key, test the connection, and toggle between platform credits and your own key. Custom keys are used by [Studio](./studio) and agent execution.

### Billing

View your credit balance, purchase credits via checkout, and review transaction history. Transactions show the source (agent execution, Studio session, eval run) and the credit amount in micro-USD.

### Usage

Token consumption and execution statistics for the current environment:
- Total executions, success rate, average duration, and total cost
- Usage breakdown by agent
- Usage breakdown by model
- Eval run statistics
- Recent execution log with per-execution details

### Danger Zone

Permanently delete the organization and all associated data. Requires typing the organization name to confirm. This action deletes all agents, data, events, triggers, API keys, integrations, and team member access.

## Studio

The Studio panel slides in from the right side of the dashboard when toggled from the header. It provides an in-browser coding sandbox powered by E2B and OpenCode. Studio is available to organization admins only.

For full documentation on Studio, including provider selection, session lifecycle, and billing, see [Studio](./studio).

## Embed Widget

Struere provides an embeddable chat widget that you can add to any website. The widget loads as a floating chat bubble and expands into a full chat interface.

Add the widget to your site with a single script tag:

```html
<script src="https://your-dashboard-url/embed/widget.js?org=your-org-slug&agent=your-agent-slug"></script>
```

Configuration options:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `org` | (required) | Organization slug |
| `agent` | (required) | Agent slug |
| `theme` | `dark` | `dark` or `light` |
| `position` | `br` | Widget position: `br` (bottom-right), `bl` (bottom-left), `tr` (top-right), `tl` (top-left) |

Any additional query parameters are passed through as `channelParams` on the thread, allowing you to attach contextual metadata (e.g., page URL, user ID) to widget conversations.

The widget renders an iframe pointing to `/embed/[orgSlug]/[agentSlug]` and creates threads with the `widget` channel type. Widget conversations appear in the [Conversations](#conversations) view with a Widget channel badge.
