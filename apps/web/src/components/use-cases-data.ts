export type Msg = { from: "user" | "agent"; text: string }

export type UseCase = {
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

export const useCases: UseCase[] = [
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

export const statusColors: Record<string, string> = {
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
