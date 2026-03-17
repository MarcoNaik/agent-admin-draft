"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

type Msg = { from: "user" | "agent"; text: string }

type UseCase = {
  label: string
  description: string
  slug: string
  agentName: string
  prefill: Msg[]
  suggestions: string[]
  entityType: string
  entitySlug: string
  columns: { key: string; label: string }[]
  statusField: string
  tools: { name: string; desc: string; params: string[]; returns: string }[]
  automations: {
    name: string
    trigger: string
    status: "active" | "idle"
    lastRun: string
    runs: number
    steps: { tool: string; description: string }[]
  }[]
}

const useCases: UseCase[] = [
  {
    label: "Customer support",
    description: "Track orders, handle returns, and notify customers automatically",
    slug: "support-agent",
    agentName: "Support Agent",
    prefill: [
      { from: "user", text: "Hey, can you check on order #4521?" },
      { from: "agent", text: "Sure! Order #4521 is currently marked as Shipped. It left the warehouse yesterday and tracking shows it's in transit to Miami, FL." },
      { from: "user", text: "When should it arrive?" },
      { from: "agent", text: "Based on the carrier estimate, it should be delivered by Thursday. I can send you a WhatsApp notification when it's out for delivery — want me to set that up?" },
    ],
    suggestions: ["Where's my order #4521?", "I want to return an item", "Can I change my address?"],
    entityType: "Orders",
    entitySlug: "order",
    columns: [{ key: "orderId", label: "Order ID" }, { key: "customerName", label: "Customer" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }],
    statusField: "status",
    tools: [
      { name: "entity.get", desc: "Fetch order details", params: ["entityId: string"], returns: "Entity" },
      { name: "entity.query", desc: "Search orders", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update order status", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "whatsapp.send", desc: "Notify customer", params: ["to: string", "message: string"], returns: "MessageStatus" },
      { name: "email.send", desc: "Send email notification", params: ["to: string", "subject: string", "body: string"], returns: "EmailStatus" },
      { name: "event.emit", desc: "Emit system event", params: ["type: string", "payload: object"], returns: "Event" },
    ],
    automations: [
      {
        name: "Send shipping notification",
        trigger: "When order.status → Shipped",
        status: "active",
        lastRun: "2 min ago",
        runs: 24,
        steps: [
          { tool: "entity.get", description: "Fetch order details" },
          { tool: "whatsapp.send", description: "Notify customer" },
        ],
      },
      {
        name: "Escalate delayed orders",
        trigger: "When order.status → Delayed",
        status: "active",
        lastRun: "15 min ago",
        runs: 7,
        steps: [
          { tool: "entity.query", description: "Find delayed orders" },
          { tool: "event.emit", description: "Emit escalation event" },
          { tool: "email.send", description: "Alert support team" },
        ],
      },
      {
        name: "Auto-close resolved tickets",
        trigger: "When order.status → Resolved",
        status: "idle",
        lastRun: "idle",
        runs: 0,
        steps: [
          { tool: "entity.query", description: "Find resolved tickets" },
          { tool: "entity.update", description: "Mark as closed" },
        ],
      },
    ],
  },
  {
    label: "Appointment booking",
    description: "Check availability, book slots, and send reminders",
    slug: "booking-agent",
    agentName: "Booking Agent",
    prefill: [
      { from: "user", text: "I need to see Dr. Martinez sometime next week" },
      { from: "agent", text: "I checked Dr. Martinez's calendar. She has openings on Tuesday at 10am, Wednesday at 2pm, and Friday at 11am. Which works best for you?" },
      { from: "user", text: "Tuesday morning sounds good" },
      { from: "agent", text: "Done — I've booked you with Dr. Martinez on Tuesday at 10:00 AM. You'll get a WhatsApp reminder the day before. Need to book anything else?" },
    ],
    suggestions: ["I need a cleaning next week", "What times are available?", "Cancel my appointment"],
    entityType: "Appointments",
    entitySlug: "appointment",
    columns: [{ key: "patientName", label: "Patient" }, { key: "doctor", label: "Doctor" }, { key: "date", label: "Date" }, { key: "status", label: "Status" }],
    statusField: "status",
    tools: [
      { name: "entity.get", desc: "Fetch appointment", params: ["entityId: string"], returns: "Entity" },
      { name: "entity.query", desc: "Search appointments", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update appointment", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "calendar.list", desc: "List calendar events", params: ["calendarId?: string", "timeRange?: object"], returns: "CalendarEvent[]" },
      { name: "calendar.create", desc: "Book appointment", params: ["summary: string", "start: string", "end: string"], returns: "CalendarEvent" },
      { name: "calendar.freeBusy", desc: "Check availability", params: ["start: string", "end: string"], returns: "FreeBusySlot[]" },
      { name: "whatsapp.send", desc: "Send reminder", params: ["to: string", "message: string"], returns: "MessageStatus" },
    ],
    automations: [
      {
        name: "Send appointment reminder",
        trigger: "When appointment.date is tomorrow",
        status: "active",
        lastRun: "1 hr ago",
        runs: 41,
        steps: [
          { tool: "entity.get", description: "Fetch appointment details" },
          { tool: "whatsapp.send", description: "Send reminder to patient" },
        ],
      },
      {
        name: "Block double-booking",
        trigger: "When appointment is created",
        status: "active",
        lastRun: "30 min ago",
        runs: 12,
        steps: [
          { tool: "entity.query", description: "Check for conflicts" },
          { tool: "event.emit", description: "Emit conflict warning" },
        ],
      },
      {
        name: "Auto-cancel no-shows",
        trigger: "When appointment.status → No-show",
        status: "idle",
        lastRun: "idle",
        runs: 0,
        steps: [
          { tool: "entity.query", description: "Find no-show appointments" },
          { tool: "entity.update", description: "Mark as cancelled" },
        ],
      },
    ],
  },
  {
    label: "Payment reminders",
    description: "Find overdue invoices, send links, and reconcile payments",
    slug: "billing-agent",
    agentName: "Billing Agent",
    prefill: [
      { from: "user", text: "Do I have any outstanding invoices?" },
      { from: "agent", text: "You have one pending invoice — INV-2847 for $1,240, due in 3 days. Want me to send you a payment link?" },
      { from: "user", text: "Yes please" },
      { from: "agent", text: "Payment link sent to your WhatsApp. Once you pay, I'll automatically mark the invoice as settled and send you a receipt. Anything else on your account?" },
    ],
    suggestions: ["Any pending invoices?", "I just made a payment", "Send me a payment link"],
    entityType: "Invoices",
    entitySlug: "invoice",
    columns: [{ key: "invoiceId", label: "Invoice" }, { key: "customerName", label: "Customer" }, { key: "status", label: "Status" }, { key: "amount", label: "Amount" }],
    statusField: "status",
    tools: [
      { name: "entity.query", desc: "Search invoices", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update invoice status", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "whatsapp.sendTemplate", desc: "Send reminder template", params: ["to: string", "template: string", "params?: object"], returns: "MessageStatus" },
      { name: "payment.create", desc: "Create payment link", params: ["amount: number", "currency: string"], returns: "PaymentLink" },
      { name: "payment.getStatus", desc: "Check payment status", params: ["paymentId: string"], returns: "PaymentStatus" },
      { name: "event.emit", desc: "Emit billing event", params: ["type: string", "payload: object"], returns: "Event" },
    ],
    automations: [
      {
        name: "Send payment reminder",
        trigger: "When invoice.dueDate is approaching",
        status: "active",
        lastRun: "5 min ago",
        runs: 63,
        steps: [
          { tool: "entity.query", description: "Find pending invoices" },
          { tool: "whatsapp.sendTemplate", description: "Send reminder template" },
        ],
      },
      {
        name: "Mark overdue invoices",
        trigger: "When invoice.dueDate has passed",
        status: "active",
        lastRun: "1 hr ago",
        runs: 28,
        steps: [
          { tool: "entity.query", description: "Find past-due invoices" },
          { tool: "entity.update", description: "Set status to Overdue" },
          { tool: "event.emit", description: "Emit overdue event" },
        ],
      },
      {
        name: "Generate payment link",
        trigger: "When invoice is created",
        status: "idle",
        lastRun: "idle",
        runs: 0,
        steps: [
          { tool: "payment.create", description: "Create payment link" },
          { tool: "entity.update", description: "Attach link to invoice" },
        ],
      },
    ],
  },
  {
    label: "Product catalog",
    description: "Search inventory, recommend products, and sync stock",
    slug: "sales-agent",
    agentName: "Sales Agent",
    prefill: [
      { from: "user", text: "I'm looking for running shoes under $150" },
      { from: "agent", text: "I found 4 options in stock. The Nike Pegasus 41 at $130 and Adidas Ultraboost Light at $140 are the top sellers. Both come in sizes 7–13." },
      { from: "user", text: "Does the Pegasus come in black?" },
      { from: "agent", text: "Yes — the Pegasus 41 is available in Black/White and Black/Volt. Size 10 has 12 units in stock. Want me to pull up more details or check other colors?" },
    ],
    suggestions: ["What's new this week?", "Nike Air Max in size 10?", "Running shoes under $150"],
    entityType: "Products",
    entitySlug: "product",
    columns: [{ key: "name", label: "Product" }, { key: "brand", label: "Brand" }, { key: "price", label: "Price" }, { key: "inStock", label: "Status" }],
    statusField: "inStock",
    tools: [
      { name: "entity.get", desc: "Fetch product details", params: ["entityId: string"], returns: "Entity" },
      { name: "entity.query", desc: "Search products", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update product info", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "email.send", desc: "Send notifications", params: ["to: string", "subject: string", "body: string"], returns: "EmailStatus" },
      { name: "airtable.listRecords", desc: "List Airtable records", params: ["baseId: string", "tableId: string"], returns: "AirtableRecord[]" },
      { name: "airtable.updateRecords", desc: "Sync to Airtable", params: ["baseId: string", "tableId: string", "records: object[]"], returns: "AirtableRecord[]" },
    ],
    automations: [
      {
        name: "Low stock alert",
        trigger: "When product.quantity < 10",
        status: "active",
        lastRun: "10 min ago",
        runs: 15,
        steps: [
          { tool: "entity.query", description: "Find low stock products" },
          { tool: "email.send", description: "Alert inventory team" },
        ],
      },
      {
        name: "Update prices from feed",
        trigger: "When price feed is updated",
        status: "active",
        lastRun: "2 hr ago",
        runs: 8,
        steps: [
          { tool: "entity.query", description: "Match products to feed" },
          { tool: "entity.update", description: "Update product prices" },
        ],
      },
      {
        name: "Sync to Airtable",
        trigger: "When product is updated",
        status: "idle",
        lastRun: "idle",
        runs: 0,
        steps: [
          { tool: "entity.get", description: "Fetch product data" },
          { tool: "airtable.updateRecords", description: "Sync to Airtable" },
        ],
      },
    ],
  },
  {
    label: "Order notifications",
    description: "Monitor orders, alert customers, and report daily stats",
    slug: "notifications-agent",
    agentName: "Notifications Agent",
    prefill: [
      { from: "user", text: "How are today's orders looking?" },
      { from: "agent", text: "12 orders so far today — 8 completed, 3 preparing, and 1 pending pickup. Revenue is at $847. The preparing orders are all under 15 minutes." },
      { from: "user", text: "Who's waiting on pickup?" },
      { from: "agent", text: "Order #3892 for Sarah Chen — a large pepperoni and garlic bread, ready since 6 minutes ago. Want me to send her a reminder notification?" },
    ],
    suggestions: ["Any new orders?", "Show me pending pickups", "Mark order as completed"],
    entityType: "Orders",
    entitySlug: "order",
    columns: [{ key: "orderId", label: "Order ID" }, { key: "customerName", label: "Customer" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }],
    statusField: "status",
    tools: [
      { name: "entity.get", desc: "Fetch order details", params: ["entityId: string"], returns: "Entity" },
      { name: "entity.query", desc: "Search orders", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update order status", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "whatsapp.send", desc: "Notify customer", params: ["to: string", "message: string"], returns: "MessageStatus" },
      { name: "event.emit", desc: "Emit order event", params: ["type: string", "payload: object"], returns: "Event" },
      { name: "event.query", desc: "Query event history", params: ["type?: string", "since?: string"], returns: "Event[]" },
      { name: "email.send", desc: "Send summary email", params: ["to: string", "subject: string", "body: string"], returns: "EmailStatus" },
    ],
    automations: [
      {
        name: "Notify when ready",
        trigger: "When order.status → Ready",
        status: "active",
        lastRun: "2 min ago",
        runs: 34,
        steps: [
          { tool: "entity.get", description: "Fetch order details" },
          { tool: "whatsapp.send", description: "Notify customer" },
        ],
      },
      {
        name: "Track preparation time",
        trigger: "When order.status → Preparing",
        status: "active",
        lastRun: "8 min ago",
        runs: 52,
        steps: [
          { tool: "event.query", description: "Get status timeline" },
          { tool: "entity.update", description: "Update prep duration" },
        ],
      },
      {
        name: "Daily summary report",
        trigger: "Every day at 11pm",
        status: "idle",
        lastRun: "idle",
        runs: 0,
        steps: [
          { tool: "entity.query", description: "Aggregate daily orders" },
          { tool: "email.send", description: "Send summary email" },
        ],
      },
    ],
  },
]

const statusColors: Record<string, string> = {
  Shipped: "bg-blue-500/10 text-blue-700",
  Processing: "bg-blue-500/10 text-blue-700",
  Delivered: "bg-emerald-500/10 text-emerald-700",
  Pending: "bg-amber-500/10 text-amber-700",
  Confirmed: "bg-emerald-500/10 text-emerald-700",
  Cancelled: "bg-red-500/10 text-red-700",
  Paid: "bg-emerald-500/10 text-emerald-700",
  Overdue: "bg-red-500/10 text-red-700",
  "In Stock": "bg-emerald-500/10 text-emerald-700",
  "Out of Stock": "bg-red-500/10 text-red-700",
  "Low Stock": "bg-amber-500/10 text-amber-700",
  Ready: "bg-blue-500/10 text-blue-700",
  Preparing: "bg-amber-500/10 text-amber-700",
  Completed: "bg-emerald-500/10 text-emerald-700",
}

function DataPanel({ useCase }: { useCase: UseCase }) {
  const [result, setResult] = useState<{ data: any[]; hasMore: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setResult(null)
    fetch(`/api/data/${useCase.entitySlug}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && Array.isArray(data.data)) {
          setResult(data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [useCase.entitySlug])

  const formatValue = (value: any, column: { key: string; label: string }) => {
    if (column.key === useCase.statusField && typeof value === "boolean") {
      return value ? "In Stock" : "Out of Stock"
    }
    if (typeof value === "number" && (column.label === "Total" || column.label === "Amount" || column.label === "Price")) {
      return `$${value.toLocaleString()}`
    }
    return String(value ?? "—")
  }

  const getStatusValue = (entity: any) => {
    const val = entity.data[useCase.statusField]
    if (typeof val === "boolean") return val ? "In Stock" : "Out of Stock"
    return String(val ?? "")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-charcoal/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-charcoal-heading">{useCase.entityType}</span>
          <span className="text-xs text-charcoal/30">·</span>
          <span className="text-xs text-charcoal/40">{loading ? "…" : `${result?.data?.length ?? 0} records`}</span>
        </div>
        <div className="flex items-center gap-2 text-charcoal/30">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span className="text-xs text-charcoal/25">Search...</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-5 py-3">
        {loading ? (
          <div className="flex flex-col gap-3 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                {useCase.columns.map((col, j) => (
                  <div key={j} className="flex-1 h-4 rounded bg-charcoal/[0.06] animate-pulse" style={{ animationDelay: `${(i * useCase.columns.length + j) * 50}ms` }} />
                ))}
              </div>
            ))}
          </div>
        ) : result?.data?.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-charcoal/40 uppercase tracking-wider text-[10px]">
                {useCase.columns.map((col) => (
                  <th key={col.key} className="text-left pb-3 font-medium">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((entity, i) => {
                const statusDisplay = getStatusValue(entity)
                return (
                  <tr key={entity.id ?? i} className="border-b border-charcoal/5 hover:bg-charcoal/[0.03] transition-colors">
                    {useCase.columns.map((col, j) => {
                      const value = entity.data[col.key]
                      const display = formatValue(value, col)
                      const isStatusCol = col.key === useCase.statusField
                      return (
                        <td key={col.key} className={`py-3 text-charcoal/70 ${j === 0 ? "font-mono text-charcoal/50" : ""}`}>
                          {isStatusCol ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[statusDisplay] || "bg-charcoal/5 text-charcoal/50"}`}>{display}</span>
                          ) : display}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-charcoal/30">No records found</div>
        )}
      </div>
    </div>
  )
}

function AutomationsPanel({ useCase }: { useCase: UseCase }) {
  const [expanded, setExpanded] = useState(0)

  return (
    <div className="flex flex-col h-full overflow-auto px-4 py-3">
      {useCase.automations.map((auto, i) => (
        <button
          key={i}
          onClick={() => setExpanded(expanded === i ? -1 : i)}
          className="cursor-pointer text-left py-3 border-b border-charcoal/[0.06] last:border-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${auto.status === "active" ? "bg-emerald-500" : "bg-charcoal/20"}`} />
              <span className="text-sm font-medium text-charcoal-heading">{auto.name}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-charcoal/30">
              <span>{auto.runs} runs</span>
              <span>{auto.lastRun}</span>
            </div>
          </div>
          <p className="text-[11px] text-charcoal/35 mt-0.5 ml-[16px]">{auto.trigger}</p>
          {expanded === i && (
            <div className="mt-2 ml-[16px] flex flex-col gap-1">
              {auto.steps.map((step, si) => (
                <div key={si} className="flex items-center gap-2 text-[11px]">
                  <span className="text-charcoal/20 font-mono text-[10px]">{si + 1}.</span>
                  <span className="font-mono text-charcoal/45">{step.tool}</span>
                  <span className="text-charcoal/30">{step.description}</span>
                </div>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

function ToolsPanel({ useCase }: { useCase: UseCase }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full overflow-auto px-4 py-3">
      {useCase.tools.map((t) => (
        <div
          key={t.name}
          onClick={() => setExpanded(expanded === t.name ? null : t.name)}
          className="cursor-pointer py-3 border-b border-charcoal/[0.06] last:border-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] font-medium text-charcoal/70">{t.name}</span>
              <span className="text-[11px] text-charcoal/30">{t.desc}</span>
            </div>
            <svg className={`w-3 h-3 text-charcoal/15 transition-transform duration-150 ${expanded === t.name ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
          {expanded === t.name && (
            <div className="mt-2 ml-0.5 flex flex-col gap-1 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="text-charcoal/25 min-w-[45px]">params</span>
                <span className="font-mono text-charcoal/40">{t.params.join(", ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-charcoal/25 min-w-[45px]">returns</span>
                <span className="font-mono text-charcoal/40">{t.returns}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ChatWindow({ useCase }: { useCase: UseCase }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])
  useEffect(() => { setMessages([]); setThreadId(null); setInput(""); setLoading(false) }, [useCase.slug])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    setMessages((p) => [...p, { from: "user", text: text.trim() }])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), agentSlug: useCase.slug, threadId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((p) => [...p, { from: "agent", text: data.message }])
        if (data.threadId) setThreadId(data.threadId)
      } else {
        setMessages((p) => [...p, { from: "agent", text: "Something went wrong. Try again." }])
      }
    } catch {
      setMessages((p) => [...p, { from: "agent", text: "Something went wrong. Try again." }])
    } finally {
      setLoading(false)
    }
  }, [loading, threadId, useCase.slug])

  const showPrefill = messages.length === 0 && !loading
  const displayMessages = showPrefill ? useCase.prefill : messages

  return (
    <div className="flex flex-col h-full bg-white/90 rounded-b-2xl">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-charcoal/5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-charcoal-heading">{useCase.agentName}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {displayMessages.map((m, i) => (
          <div key={i} className={`flex mb-2.5 ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`text-[12px] leading-relaxed px-3.5 py-2 max-w-[85%] ${m.from === "user" ? "bg-ocean text-white rounded-2xl rounded-br-md" : "bg-stone-deep text-charcoal rounded-2xl rounded-bl-md"}`}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start mb-2.5">
            <div className="bg-stone-deep rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-charcoal/30 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-charcoal/30 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-charcoal/30 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        {showPrefill && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {useCase.suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="cursor-pointer px-3 py-1.5 text-[11px] text-charcoal/60 bg-charcoal/3 border border-charcoal/8 rounded-full hover:bg-charcoal/6 transition-colors">{s}</button>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 pb-3 pt-1">
        <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex items-end gap-2 rounded-xl border border-charcoal/8 bg-white/60 px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-charcoal placeholder:text-charcoal/25 focus:outline-none"
          />
          <button type="submit" disabled={!input.trim() || loading} className="text-charcoal/30 hover:text-ocean disabled:opacity-30 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

const rightTabs = ["Automations", "Data", "Tools"] as const

export function UseCases() {
  const [active, setActive] = useState(0)
  const [rightTab, setRightTab] = useState<(typeof rightTabs)[number]>("Automations")
  const { ref, opacity, y } = useFadeSlideUp()

  const uc = useCases[active]

  return (
    <section id="use-cases" className="bg-stone-base py-20 md:py-28">
      <motion.div ref={ref} style={{ opacity, y, willChange: "transform, opacity" }} className="mx-auto max-w-7xl px-6 md:px-12">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-charcoal/40 mb-3">
          What you can build
        </p>
        <h2 className="text-center text-2xl md:text-3xl font-display text-charcoal-heading mb-14">
          One platform, endless use cases
        </h2>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:flex-1 flex flex-col gap-1 justify-center">
            {useCases.map((u, i) => (
              <button
                key={u.slug}
                onClick={() => setActive(i)}
                className={`cursor-pointer text-right px-4 py-2.5 rounded-lg transition-all duration-200 ${active === i ? "bg-white/60 text-charcoal-heading" : "text-charcoal/40 hover:text-charcoal/70 hover:bg-white/30"}`}
              >
                <span className="font-display text-[15px] font-medium">{u.label}</span>
              </button>
            ))}
          </div>

          <div className="md:w-[440px] md:flex-shrink-0">
            <div className="rounded-2xl  bg-white/90 overflow-hidden h-[560px] flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col h-full"
              >
                <ChatWindow useCase={uc} />
              </motion.div>
            </AnimatePresence>
            </div>
          </div>

          <div className="md:flex-1 flex flex-col min-w-0">
            <div className="overflow-hidden h-[560px] flex flex-col rounded-2xl  bg-white/90">
              <div className="flex gap-1 px-1 py-2.5">
                {rightTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${rightTab === tab ? "bg-charcoal/8 text-charcoal-heading" : "text-charcoal/35 hover:text-charcoal/60"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${active}-${rightTab}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    {rightTab === "Data" && <DataPanel useCase={uc} />}
                    {rightTab === "Automations" && <AutomationsPanel useCase={uc} />}
                    {rightTab === "Tools" && <ToolsPanel useCase={uc} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-4">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-emerald-600/60">Live demo — try it</span>
        </div>
      </motion.div>
    </section>
  )
}
