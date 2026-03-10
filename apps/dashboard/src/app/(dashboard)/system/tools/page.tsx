"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { useEnvironment } from "@/contexts/environment-context"
import {
  Wrench,
  Database,
  Bell,
  Code,
  ChevronDown,
  ChevronRight,
  Calendar,
  MessageCircle,
  Table,
  Mail,
  CreditCard,
} from "@/lib/icons"
import { cn } from "@/lib/utils"

const BUILTIN_TOOL_DEFINITIONS: Record<string, {
  category: "entity" | "event" | "agent" | "calendar" | "whatsapp" | "airtable" | "email" | "payment"
  description: string
  parameters: {
    type: string
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}> = {
  "entity.create": {
    category: "entity",
    description: "Create a new entity of a specified type",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Entity type slug (e.g., 'contact', 'order')" },
        data: { type: "object", description: "Entity data matching the type schema" },
        status: { type: "string", description: "Initial status (default: 'active')" },
      },
      required: ["type", "data"],
    },
  },
  "entity.get": {
    category: "entity",
    description: "Retrieve a single entity by its ID",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to retrieve" },
      },
      required: ["id"],
    },
  },
  "entity.query": {
    category: "entity",
    description: "Query entities by type with optional filters",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Entity type slug to query" },
        filters: { type: "object", description: "Optional field filters" },
        status: { type: "string", description: "Filter by status" },
        limit: { type: "number", description: "Max results (default: 50)" },
      },
      required: ["type"],
    },
  },
  "entity.update": {
    category: "entity",
    description: "Update an existing entity's data",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to update" },
        data: { type: "object", description: "Fields to update (merged with existing)" },
        status: { type: "string", description: "New status (optional)" },
      },
      required: ["id", "data"],
    },
  },
  "entity.delete": {
    category: "entity",
    description: "Soft-delete an entity (sets deletedAt timestamp)",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID to delete" },
      },
      required: ["id"],
    },
  },
  "entity.link": {
    category: "entity",
    description: "Create a relation between two entities",
    parameters: {
      type: "object",
      properties: {
        fromEntityId: { type: "string", description: "Source entity ID" },
        toEntityId: { type: "string", description: "Target entity ID" },
        relationType: { type: "string", description: "Relation type (e.g., 'parent', 'assigned_to')" },
      },
      required: ["fromEntityId", "toEntityId", "relationType"],
    },
  },
  "entity.unlink": {
    category: "entity",
    description: "Remove a relation between two entities",
    parameters: {
      type: "object",
      properties: {
        fromEntityId: { type: "string", description: "Source entity ID" },
        toEntityId: { type: "string", description: "Target entity ID" },
        relationType: { type: "string", description: "Relation type to remove" },
      },
      required: ["fromEntityId", "toEntityId", "relationType"],
    },
  },
  "event.emit": {
    category: "event",
    description: "Emit a custom event for audit logging",
    parameters: {
      type: "object",
      properties: {
        eventType: { type: "string", description: "Event type name (e.g., 'user.action')" },
        entityId: { type: "string", description: "Related entity ID (optional)" },
        payload: { type: "object", description: "Event payload data" },
      },
      required: ["eventType"],
    },
  },
  "event.query": {
    category: "event",
    description: "Query historical events with filters",
    parameters: {
      type: "object",
      properties: {
        eventType: { type: "string", description: "Filter by event type" },
        entityId: { type: "string", description: "Filter by entity" },
        since: { type: "number", description: "Timestamp to query from" },
        limit: { type: "number", description: "Max results (default: 50)" },
      },
      required: [],
    },
  },
  "calendar.list": {
    category: "calendar",
    description: "List Google Calendar events for a user within a time range",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID (Convex or Clerk) whose calendar to query" },
        timeMin: { type: "string", description: "Start of time range (ISO 8601 datetime)" },
        timeMax: { type: "string", description: "End of time range (ISO 8601 datetime)" },
        maxResults: { type: "number", description: "Maximum number of events to return" },
      },
      required: ["userId", "timeMin", "timeMax"],
    },
  },
  "calendar.create": {
    category: "calendar",
    description: "Create a Google Calendar event on a user's calendar",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID (Convex or Clerk) whose calendar to create the event on" },
        summary: { type: "string", description: "Event title" },
        startTime: { type: "string", description: "Event start time (ISO 8601 datetime)" },
        endTime: { type: "string", description: "Event end time (ISO 8601 datetime)" },
        description: { type: "string", description: "Event description" },
        attendees: { type: "array", description: "List of attendee email addresses" },
        timeZone: { type: "string", description: 'Time zone (e.g., "America/Santiago")' },
      },
      required: ["userId", "summary", "startTime", "endTime"],
    },
  },
  "calendar.update": {
    category: "calendar",
    description: "Update an existing Google Calendar event",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID (Convex or Clerk) whose calendar contains the event" },
        eventId: { type: "string", description: "Google Calendar event ID to update" },
        summary: { type: "string", description: "New event title" },
        startTime: { type: "string", description: "New start time (ISO 8601 datetime)" },
        endTime: { type: "string", description: "New end time (ISO 8601 datetime)" },
        description: { type: "string", description: "New event description" },
        attendees: { type: "array", description: "Updated list of attendee emails" },
        status: { type: "string", description: "Event status (confirmed, tentative, cancelled)" },
      },
      required: ["userId", "eventId"],
    },
  },
  "calendar.delete": {
    category: "calendar",
    description: "Delete a Google Calendar event",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID (Convex or Clerk) whose calendar contains the event" },
        eventId: { type: "string", description: "Google Calendar event ID to delete" },
      },
      required: ["userId", "eventId"],
    },
  },
  "calendar.freeBusy": {
    category: "calendar",
    description: "Check free/busy availability on a user's Google Calendar",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID (Convex or Clerk) whose availability to check" },
        timeMin: { type: "string", description: "Start of time range (ISO 8601 datetime)" },
        timeMax: { type: "string", description: "End of time range (ISO 8601 datetime)" },
      },
      required: ["userId", "timeMin", "timeMax"],
    },
  },
  "whatsapp.send": {
    category: "whatsapp",
    description: "Send a text message via WhatsApp",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        text: { type: "string", description: "The text message to send" },
      },
      required: ["to", "text"],
    },
  },
  "whatsapp.sendTemplate": {
    category: "whatsapp",
    description: "Send a pre-approved template message via WhatsApp (works outside 24h window)",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        templateName: { type: "string", description: "Name of the approved template to send" },
        language: { type: "string", description: 'Template language code (e.g., "en_US")' },
        components: { type: "array", description: "Optional template components with parameter values" },
      },
      required: ["to", "templateName", "language"],
    },
  },
  "whatsapp.sendInteractive": {
    category: "whatsapp",
    description: "Send an interactive button message via WhatsApp (max 3 buttons)",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        bodyText: { type: "string", description: "The message body text" },
        buttons: { type: "array", description: "Action buttons (1-3 buttons, max 20 chars per title)" },
        footerText: { type: "string", description: "Optional footer text below the buttons" },
      },
      required: ["to", "bodyText", "buttons"],
    },
  },
  "whatsapp.sendMedia": {
    category: "whatsapp",
    description: "Send an image or audio message via WhatsApp",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: 'Recipient phone number in E.164 format (e.g., "+15551234567")' },
        mediaUrl: { type: "string", description: "Public URL of the media file to send" },
        mediaType: { type: "string", description: "Type of media to send (image or audio)" },
        caption: { type: "string", description: "Optional caption (only supported for images)" },
      },
      required: ["to", "mediaUrl", "mediaType"],
    },
  },
  "whatsapp.listTemplates": {
    category: "whatsapp",
    description: "List available WhatsApp message templates",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  "whatsapp.getConversation": {
    category: "whatsapp",
    description: "Get WhatsApp conversation history with a phone number",
    parameters: {
      type: "object",
      properties: {
        phoneNumber: { type: "string", description: "Phone number to get conversation history for" },
        limit: { type: "number", description: "Maximum number of messages to return" },
      },
      required: ["phoneNumber"],
    },
  },
  "whatsapp.getStatus": {
    category: "whatsapp",
    description: "Get WhatsApp connection status for this organization",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  "airtable.listBases": {
    category: "airtable",
    description: "List all Airtable bases accessible with the configured token",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  "airtable.listTables": {
    category: "airtable",
    description: "List all tables in an Airtable base",
    parameters: {
      type: "object",
      properties: {
        baseId: { type: "string", description: 'Airtable base ID (e.g., "appXXXXXXXXXXXXXX")' },
      },
      required: ["baseId"],
    },
  },
  "airtable.listRecords": {
    category: "airtable",
    description: "List records from an Airtable table with optional filtering and sorting",
    parameters: {
      type: "object",
      properties: {
        baseId: { type: "string", description: "Airtable base ID" },
        tableIdOrName: { type: "string", description: "Table ID or name" },
        pageSize: { type: "number", description: "Number of records per page (max 100)" },
        offset: { type: "string", description: "Pagination offset from a previous response" },
        filterByFormula: { type: "string", description: "Airtable formula to filter records" },
        sort: { type: "array", description: "Sort configuration" },
        fields: { type: "array", description: "Only return specific field names" },
        view: { type: "string", description: "Name or ID of an Airtable view to use" },
      },
      required: ["baseId", "tableIdOrName"],
    },
  },
  "airtable.getRecord": {
    category: "airtable",
    description: "Get a single record from an Airtable table by ID",
    parameters: {
      type: "object",
      properties: {
        baseId: { type: "string", description: "Airtable base ID" },
        tableIdOrName: { type: "string", description: "Table ID or name" },
        recordId: { type: "string", description: 'Record ID (e.g., "recXXXXXXXXXXXXXX")' },
      },
      required: ["baseId", "tableIdOrName", "recordId"],
    },
  },
  "airtable.createRecords": {
    category: "airtable",
    description: "Create up to 10 records in an Airtable table",
    parameters: {
      type: "object",
      properties: {
        baseId: { type: "string", description: "Airtable base ID" },
        tableIdOrName: { type: "string", description: "Table ID or name" },
        records: { type: "array", description: "Array of records to create (max 10)" },
      },
      required: ["baseId", "tableIdOrName", "records"],
    },
  },
  "airtable.updateRecords": {
    category: "airtable",
    description: "Update up to 10 records in an Airtable table",
    parameters: {
      type: "object",
      properties: {
        baseId: { type: "string", description: "Airtable base ID" },
        tableIdOrName: { type: "string", description: "Table ID or name" },
        records: { type: "array", description: "Array of records to update (max 10)" },
      },
      required: ["baseId", "tableIdOrName", "records"],
    },
  },
  "airtable.deleteRecords": {
    category: "airtable",
    description: "Delete up to 10 records from an Airtable table",
    parameters: {
      type: "object",
      properties: {
        baseId: { type: "string", description: "Airtable base ID" },
        tableIdOrName: { type: "string", description: "Table ID or name" },
        recordIds: { type: "array", description: "Array of record IDs to delete (max 10)" },
      },
      required: ["baseId", "tableIdOrName", "recordIds"],
    },
  },
  "email.send": {
    category: "email",
    description: "Send an email via Resend",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        html: { type: "string", description: "HTML body content" },
        text: { type: "string", description: "Plain text body content" },
        replyTo: { type: "string", description: "Reply-to email address" },
      },
      required: ["to", "subject"],
    },
  },
  "payment.create": {
    category: "payment",
    description: "Create a payment link via Flow.cl and return the URL",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Payment amount in the smallest currency unit" },
        description: { type: "string", description: "Description of the payment" },
        currency: { type: "string", description: "Currency code (defaults to CLP)" },
        customerEmail: { type: "string", description: "Customer email address" },
        entityId: { type: "string", description: "Optional entity ID to link the payment to" },
      },
      required: ["amount", "description"],
    },
  },
  "payment.getStatus": {
    category: "payment",
    description: "Check the current status of a payment",
    parameters: {
      type: "object",
      properties: {
        entityId: { type: "string", description: "Payment entity ID to check status for" },
      },
      required: ["entityId"],
    },
  },
  "agent.chat": {
    category: "agent",
    description: "Send a message to another agent and get its response",
    parameters: {
      type: "object",
      properties: {
        agent: { type: "string", description: "Target agent slug" },
        message: { type: "string", description: "Message to send" },
        context: { type: "object", description: "Optional context data" },
      },
      required: ["agent", "message"],
    },
  },
}

const CATEGORY_ORDER = ["entity", "event", "calendar", "whatsapp", "airtable", "email", "payment", "agent"] as const

const CATEGORY_INFO: Record<string, {
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  entity: {
    label: "Data Tools",
    description: "CRUD operations on business data",
    icon: Database,
  },
  event: {
    label: "Event Tools",
    description: "Audit logging and queries",
    icon: Bell,
  },
  calendar: {
    label: "Calendar Tools",
    description: "Google Calendar integration",
    icon: Calendar,
  },
  whatsapp: {
    label: "WhatsApp Tools",
    description: "WhatsApp messaging via Kapso",
    icon: MessageCircle,
  },
  airtable: {
    label: "Airtable Tools",
    description: "Airtable data operations",
    icon: Table,
  },
  email: {
    label: "Email Tools",
    description: "Email via Resend",
    icon: Mail,
  },
  payment: {
    label: "Payment Tools",
    description: "Payment processing via Flow",
    icon: CreditCard,
  },
  agent: {
    label: "Agent Tools",
    description: "Multi-agent communication",
    icon: Code,
  },
}

function ToolName({ name }: { name: string }) {
  const dotIndex = name.indexOf(".")
  if (dotIndex === -1) {
    return <code className="text-sm font-mono text-content-primary">{name}</code>
  }
  const prefix = name.slice(0, dotIndex + 1)
  const suffix = name.slice(dotIndex + 1)
  return (
    <code className="text-sm font-mono">
      <span className="text-content-primary/30 group-hover/row:text-content-primary transition-colors">{prefix}</span>
      <span className="text-content-primary">{suffix}</span>
    </code>
  )
}

function ToolRow({
  name,
  description,
  parameters,
}: {
  name: string
  description: string
  parameters?: {
    type: string
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}) {
  const [expanded, setExpanded] = useState(false)
  const hasParams = parameters?.properties && Object.keys(parameters.properties).length > 0

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => hasParams && setExpanded(!expanded)}
        className={cn(
          "group/row w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
          hasParams && "hover:bg-background-secondary cursor-pointer"
        )}
      >
        <div className="w-36 shrink-0">
          <ToolName name={name} />
        </div>
        <p className="flex-1 text-sm text-content-tertiary truncate">{description}</p>
        {hasParams && (
          <div className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-content-tertiary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-content-tertiary" />
            )}
          </div>
        )}
      </button>
      {expanded && hasParams && (
        <div className="px-4 pb-3">
          <div className="text-xs text-content-tertiary mb-2">Parameters</div>
          <div className="space-y-1.5">
            {Object.entries(parameters?.properties || {}).map(([paramName, prop]) => (
              <div key={paramName} className="flex items-baseline gap-2 text-sm">
                <code className="font-mono text-content-primary text-xs bg-background-tertiary px-1.5 py-0.5 rounded">
                  {paramName}
                </code>
                <span className="text-xs text-content-tertiary">{prop.type}</span>
                {parameters?.required?.includes(paramName) && (
                  <span className="text-xs text-warning">required</span>
                )}
                {prop.description && (
                  <span className="text-xs text-content-secondary">{"\u2014"} {prop.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategorySection({
  categoryKey,
  tools,
  defaultExpanded = true,
}: {
  categoryKey: string
  tools: Array<{ name: string; description: string; parameters?: any }>
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const info = CATEGORY_INFO[categoryKey]
  const Icon = info.icon

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-background-secondary/50 hover:bg-background-secondary transition-colors cursor-pointer"
      >
        <Icon className="h-4 w-4 text-content-secondary" />
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-content-primary">{info.label}</span>
          <span className="text-xs text-content-tertiary ml-2">{info.description}</span>
        </div>
        <span className="text-xs text-content-tertiary">{tools.length} tools</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-content-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-content-tertiary" />
        )}
      </button>
      {expanded && (
        <div className="border-t">
          {tools.map((item) => (
            <ToolRow
              key={item.name}
              name={item.name}
              description={item.description}
              parameters={item.parameters}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolsPageContent() {
  const { environment } = useEnvironment()
  const integrationConfigs = useQuery(api.integrations.listConfigs, { environment })
  const customTools = useQuery(api.agents.listCustomTools, { environment })

  const activeProviders = new Set(
    (integrationConfigs ?? [])
      .filter((c: any) => c.status === "active")
      .map((c: any) => c.provider as string)
  )

  const PROVIDER_TO_CATEGORY: Record<string, string> = {
    google: "calendar",
    whatsapp: "whatsapp",
    airtable: "airtable",
    resend: "email",
    flow: "payment",
  }

  const CORE_CATEGORIES = new Set(["entity", "event", "agent"])

  const activeCategories = new Set(CORE_CATEGORIES)
  for (const [provider, category] of Object.entries(PROVIDER_TO_CATEGORY)) {
    if (activeProviders.has(provider)) {
      activeCategories.add(category)
    }
  }

  const categories = new Map<string, Array<{ name: string; description: string; parameters?: any }>>()

  for (const [name, def] of Object.entries(BUILTIN_TOOL_DEFINITIONS)) {
    if (!activeCategories.has(def.category)) continue
    const cat = def.category
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push({ name, description: def.description, parameters: def.parameters })
  }

  const builtinCount = Array.from(categories.values()).reduce((sum, tools) => sum + tools.length, 0)
  const customCount = customTools?.length ?? 0
  const totalTools = builtinCount + customCount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold text-content-primary">Tools</h1>
        <p className="text-sm text-content-secondary mt-1">
          {totalTools} tools available for agents
        </p>
      </div>

      <div className="space-y-4">
        {CATEGORY_ORDER.filter((cat) => categories.has(cat)).map((categoryKey) => (
          <CategorySection
            key={categoryKey}
            categoryKey={categoryKey}
            tools={categories.get(categoryKey)!}
          />
        ))}

        {customTools && customTools.length > 0 && (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-background-secondary/50">
              <Wrench className="h-4 w-4 text-content-secondary" />
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-content-primary">Custom Tools</span>
                <span className="text-xs text-content-tertiary ml-2">Organization-defined tools</span>
              </div>
              <span className="text-xs text-content-tertiary">{customTools.length} tools</span>
            </div>
            <div className="border-t">
              {customTools.map((tool: any) => (
                <div key={tool.name} className="border-b border-border last:border-b-0 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-36 shrink-0">
                      <code className="text-sm font-mono text-content-primary">{tool.name}</code>
                    </div>
                    <p className="flex-1 text-sm text-content-tertiary truncate">{tool.description}</p>
                    <span className="text-[10px] text-content-tertiary bg-background-tertiary px-1.5 py-0.5 rounded shrink-0">
                      {tool.agentName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SystemToolsPage() {
  return <ToolsPageContent />
}
