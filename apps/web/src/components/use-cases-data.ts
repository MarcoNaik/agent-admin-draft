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
    label: "Recruitment pipeline",
    description: "Screen applications, score candidates, and schedule interviews automatically",
    slug: "screening-agent",
    agentName: "Screening Agent",
    prefill: [
      { from: "user", text: "We just got 3 new applications for the Senior Engineer role" },
      { from: "agent", text: "Processing now. I scored all 3 against the Senior Engineer requirements:\n\n• Sarah Kim (92/100) — 7 yrs experience, strong system design. Routing to interview scheduling.\n• James Park (78/100) — Good fit, missing distributed systems. Routing to interview scheduling.\n• Alex Turner (41/100) — Below threshold. Auto-rejected with feedback email sent." },
      { from: "user", text: "What did the interview agent set up?" },
      { from: "agent", text: "Done. Sarah Kim is booked with David (Engineering Lead) on Tuesday 2pm — calendar invite and WhatsApp confirmation sent. James Park is booked with Maria on Wednesday 10am. Both synced to your Airtable pipeline board." },
    ],
    suggestions: ["Process new applications", "Show pipeline status", "Review candidate scores"],
    entityType: "Candidates",
    entitySlug: "candidate",
    columns: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "score", label: "Score" },
      { key: "stage", label: "Stage" },
    ],
    statusField: "stage",
    tools: [
      { name: "entity.create", desc: "Add new candidate", params: ["type: string", "data: object"], returns: "Entity" },
      { name: "entity.query", desc: "Search candidates", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update candidate stage", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "calendar.freeBusy", desc: "Check interviewer slots", params: ["start: string", "end: string"], returns: "FreeBusySlot[]" },
      { name: "calendar.create", desc: "Book interview", params: ["summary: string", "start: string", "end: string"], returns: "CalendarEvent" },
      { name: "agent.chat", desc: "Coordinate with interview agent", params: ["agent: string", "message: string"], returns: "AgentResponse" },
      { name: "airtable.updateRecords", desc: "Sync pipeline to Airtable", params: ["baseId: string", "tableId: string", "records: object[]"], returns: "AirtableRecord[]" },
    ],
    automations: [
      {
        name: "Screen new applicants",
        trigger: "When candidate is created",
        status: "active",
        lastRun: "3 min ago",
        runs: 87,
        steps: [
          { tool: "entity.get", description: "Load job requirements" },
          { tool: "agent.chat", description: "Score via screening agent" },
          { tool: "entity.update", description: "Set stage and score" },
          { tool: "airtable.updateRecords", description: "Sync to pipeline board" },
        ],
      },
      {
        name: "Schedule interviews",
        trigger: "When candidate.stage → Interview",
        status: "active",
        lastRun: "12 min ago",
        runs: 34,
        steps: [
          { tool: "calendar.freeBusy", description: "Find interviewer availability" },
          { tool: "calendar.create", description: "Book interview slot" },
          { tool: "whatsapp.send", description: "Confirm with candidate" },
        ],
      },
      {
        name: "Send offer package",
        trigger: "When candidate.stage → Offer",
        status: "active",
        lastRun: "2 days ago",
        runs: 8,
        steps: [
          { tool: "entity.get", description: "Load candidate details" },
          { tool: "email.send", description: "Send offer letter" },
          { tool: "whatsapp.send", description: "Notify hiring manager" },
        ],
      },
    ],
  },
  {
    label: "Property management",
    description: "Triage maintenance requests, dispatch vendors, and track costs",
    slug: "triage-agent",
    agentName: "Triage Agent",
    prefill: [
      { from: "user", text: "Unit 4B just reported a burst pipe via WhatsApp" },
      { from: "agent", text: "Emergency work order WO-1847 created. Actions taken:\n\n• Urgency: Emergency (water damage risk)\n• Category: Plumbing\n• Dispatched Rivera Plumbing (on-call) — WhatsApp sent, ETA confirmed 25 min\n• Property manager Sarah notified via WhatsApp\n• Tenant in 4B received confirmation: technician en route" },
      { from: "user", text: "What's the status on open work orders for Building A?" },
      { from: "agent", text: "Building A has 4 open work orders:\n\n• WO-1847 (4B) Burst pipe — Emergency, dispatched, ETA 25 min\n• WO-1842 (2A) AC not cooling — Normal, scheduled for tomorrow\n• WO-1839 (6C) Door lock stuck — High, vendor arriving in 2 hrs\n• WO-1836 (1A) Paint touch-up — Low, queued for next week\n\nTotal estimated cost: $2,340" },
    ],
    suggestions: ["Show open work orders", "Unit 4B reported a leak", "Vendor status update"],
    entityType: "Work Orders",
    entitySlug: "work-order",
    columns: [
      { key: "unit", label: "Unit" },
      { key: "category", label: "Category" },
      { key: "urgency", label: "Urgency" },
      { key: "status", label: "Status" },
    ],
    statusField: "status",
    tools: [
      { name: "entity.create", desc: "Create work order", params: ["type: string", "data: object"], returns: "Entity" },
      { name: "entity.query", desc: "Search work orders", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update work order status", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "whatsapp.send", desc: "Notify tenant or vendor", params: ["to: string", "message: string"], returns: "MessageStatus" },
      { name: "whatsapp.sendInteractive", desc: "Send vendor selection", params: ["to: string", "interactive: object"], returns: "MessageStatus" },
      { name: "agent.chat", desc: "Coordinate with billing agent", params: ["agent: string", "message: string"], returns: "AgentResponse" },
      { name: "event.emit", desc: "Log maintenance event", params: ["type: string", "payload: object"], returns: "Event" },
    ],
    automations: [
      {
        name: "Triage and dispatch",
        trigger: "When work-order is created",
        status: "active",
        lastRun: "8 min ago",
        runs: 156,
        steps: [
          { tool: "entity.get", description: "Classify urgency and category" },
          { tool: "entity.query", description: "Find available vendor" },
          { tool: "entity.update", description: "Assign vendor, set Dispatched" },
          { tool: "whatsapp.send", description: "Notify vendor and tenant" },
        ],
      },
      {
        name: "Emergency escalation",
        trigger: "When work-order.urgency = Emergency",
        status: "active",
        lastRun: "2 hrs ago",
        runs: 12,
        steps: [
          { tool: "whatsapp.send", description: "Alert on-call vendor" },
          { tool: "whatsapp.send", description: "Notify property manager" },
          { tool: "event.emit", description: "Log emergency event" },
        ],
      },
      {
        name: "Monthly owner report",
        trigger: "1st of every month",
        status: "active",
        lastRun: "Mar 1",
        runs: 6,
        steps: [
          { tool: "entity.query", description: "Aggregate resolved work orders" },
          { tool: "agent.chat", description: "Generate cost summary" },
          { tool: "email.send", description: "Send report to owners" },
        ],
      },
    ],
  },
  {
    label: "Clinic operations",
    description: "Automate patient intake, scheduling, and post-visit follow-ups",
    slug: "intake-agent",
    agentName: "Intake Agent",
    prefill: [
      { from: "user", text: "New patient Maria Santos just registered online" },
      { from: "agent", text: "Intake workflow complete:\n\n• Created patient record, insurance verified (BlueCross PPO)\n• Matched to Dr. Chen (Internal Medicine) based on referral reason\n• Booked first visit: Thursday 3:30pm (nearest available)\n• WhatsApp sent to Maria: appointment confirmation + intake forms link\n• Front desk notified, synced to Airtable patient board" },
      { from: "user", text: "Dr. Chen just finished the visit with Maria, follow-up needed in 2 weeks" },
      { from: "agent", text: "Follow-up scheduled. The care agent:\n\n• Marked today's visit as Completed\n• Booked follow-up: April 7th, 2:00pm with Dr. Chen\n• Sent Maria post-visit instructions via WhatsApp (medication schedule, dietary notes)\n• Set automatic reminder for April 6th\n• Updated Airtable with visit notes and next appointment" },
    ],
    suggestions: ["New patient registration", "Today's intake queue", "Provider availability"],
    entityType: "Patients",
    entitySlug: "patient",
    columns: [
      { key: "name", label: "Name" },
      { key: "provider", label: "Provider" },
      { key: "nextAppointment", label: "Next Appointment" },
      { key: "status", label: "Status" },
    ],
    statusField: "status",
    tools: [
      { name: "entity.create", desc: "Register new patient", params: ["type: string", "data: object"], returns: "Entity" },
      { name: "entity.query", desc: "Search patient records", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update patient status", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "calendar.freeBusy", desc: "Check provider availability", params: ["start: string", "end: string"], returns: "FreeBusySlot[]" },
      { name: "calendar.create", desc: "Book appointment", params: ["summary: string", "start: string", "end: string"], returns: "CalendarEvent" },
      { name: "whatsapp.sendTemplate", desc: "Send reminders", params: ["to: string", "template: string", "params?: object"], returns: "MessageStatus" },
      { name: "agent.chat", desc: "Coordinate with care agent", params: ["agent: string", "message: string"], returns: "AgentResponse" },
    ],
    automations: [
      {
        name: "Patient intake workflow",
        trigger: "When patient is created",
        status: "active",
        lastRun: "45 min ago",
        runs: 64,
        steps: [
          { tool: "entity.get", description: "Verify insurance details" },
          { tool: "calendar.freeBusy", description: "Find provider availability" },
          { tool: "calendar.create", description: "Book first appointment" },
          { tool: "whatsapp.sendTemplate", description: "Send welcome + forms" },
        ],
      },
      {
        name: "Post-visit follow-up",
        trigger: "When visit.status → Completed",
        status: "active",
        lastRun: "20 min ago",
        runs: 142,
        steps: [
          { tool: "entity.get", description: "Check treatment plan" },
          { tool: "agent.chat", description: "Care agent schedules follow-up" },
          { tool: "whatsapp.send", description: "Send post-visit instructions" },
          { tool: "airtable.updateRecords", description: "Sync to patient board" },
        ],
      },
      {
        name: "Appointment reminders",
        trigger: "When visit.date is tomorrow",
        status: "active",
        lastRun: "6 hrs ago",
        runs: 289,
        steps: [
          { tool: "entity.get", description: "Load visit details" },
          { tool: "whatsapp.sendTemplate", description: "Send prep reminder" },
          { tool: "entity.update", description: "Mark reminder sent" },
        ],
      },
    ],
  },
  {
    label: "Agency onboarding",
    description: "Scaffold projects, assign teams, and manage milestones automatically",
    slug: "onboarding-agent",
    agentName: "Onboarding Agent",
    prefill: [
      { from: "user", text: "Meridian Corp just signed a branding + web project, $45K budget, 8-week timeline" },
      { from: "agent", text: "Project onboarded. Here's what was set up:\n\n• Project MRD-2024 created (Branding + Web, $45K, 8 weeks)\n• 6 milestones generated: Discovery → Brand Strategy → Visual Identity → Web Design → Development → Launch\n• Resourcing agent assigned: Ana (Brand Lead), Kai (Designer), Dev team TBD\n• Kickoff call booked: Monday 10am with client + Ana + Kai\n• Client received welcome email with project timeline\n• Airtable project board created with all milestones" },
      { from: "user", text: "The Brand Strategy milestone is 3 days overdue" },
      { from: "agent", text: "Escalation triggered automatically:\n\n• WhatsApp sent to Ana (Brand Lead): deadline missed, action needed\n• Account Director James notified via WhatsApp\n• Client Meridian Corp received email: revised timeline, new delivery date April 2nd\n• Milestone updated in Airtable with delay flag\n• Downstream milestones auto-adjusted by 3 days" },
    ],
    suggestions: ["New client signed", "Project status overview", "Upcoming kickoffs"],
    entityType: "Projects",
    entitySlug: "project",
    columns: [
      { key: "client", label: "Client" },
      { key: "type", label: "Type" },
      { key: "budget", label: "Budget" },
      { key: "status", label: "Status" },
    ],
    statusField: "status",
    tools: [
      { name: "entity.create", desc: "Create project and milestones", params: ["type: string", "data: object"], returns: "Entity" },
      { name: "entity.query", desc: "Search projects and milestones", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update project status", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "calendar.create", desc: "Book client meetings", params: ["summary: string", "start: string", "end: string"], returns: "CalendarEvent" },
      { name: "airtable.createRecords", desc: "Set up project board", params: ["baseId: string", "tableId: string", "records: object[]"], returns: "AirtableRecord[]" },
      { name: "agent.chat", desc: "Coordinate with resourcing agent", params: ["agent: string", "message: string"], returns: "AgentResponse" },
      { name: "email.send", desc: "Send client communications", params: ["to: string", "subject: string", "body: string"], returns: "EmailStatus" },
    ],
    automations: [
      {
        name: "Project onboarding",
        trigger: "When project is created",
        status: "active",
        lastRun: "2 days ago",
        runs: 23,
        steps: [
          { tool: "entity.create", description: "Generate milestones from template" },
          { tool: "agent.chat", description: "Resourcing agent assigns team" },
          { tool: "calendar.create", description: "Book kickoff call" },
          { tool: "email.send", description: "Send client welcome pack" },
          { tool: "airtable.createRecords", description: "Create Airtable project board" },
        ],
      },
      {
        name: "Milestone overdue escalation",
        trigger: "When milestone.status → Overdue",
        status: "active",
        lastRun: "1 day ago",
        runs: 9,
        steps: [
          { tool: "whatsapp.send", description: "Alert assignee and PM" },
          { tool: "email.send", description: "Notify client of delay" },
          { tool: "entity.update", description: "Adjust downstream dates" },
          { tool: "airtable.updateRecords", description: "Flag in Airtable" },
        ],
      },
      {
        name: "Deliverable review cycle",
        trigger: "When project.status → Review",
        status: "active",
        lastRun: "5 days ago",
        runs: 15,
        steps: [
          { tool: "entity.query", description: "Gather completed deliverables" },
          { tool: "email.send", description: "Send review package to client" },
          { tool: "calendar.create", description: "Schedule review call" },
        ],
      },
    ],
  },
  {
    label: "Trial conversion",
    description: "Score usage, trigger nudges, and hand off to sales automatically",
    slug: "activation-agent",
    agentName: "Activation Agent",
    prefill: [
      { from: "user", text: "What's happening with trial accounts this week?" },
      { from: "agent", text: "47 active trials. Highlights:\n\n• 8 accounts crossed activation score 80 — sales handoff triggered, demos booked\n• 12 accounts at risk (score < 30, trial ending in 3 days) — rescue sequences sent\n• 3 converted to paid this week ($14,400 ARR)\n• Top signal: Acme Corp (52 seats) hit score 94 after adding Slack integration. Demo with their VP Ops booked for tomorrow 2pm." },
      { from: "user", text: "Tell me more about the Acme Corp handoff" },
      { from: "agent", text: "Full handoff completed autonomously:\n\n• Activation agent detected: 3 integrations added, 12 team invites, daily active usage\n• Sales handoff agent enriched: Acme Corp, 200 employees, Series B, VP Ops is decision maker\n• AE Sarah Chen assigned (enterprise segment)\n• Demo booked: Tomorrow 2pm, calendar invite sent to both parties\n• Sarah received WhatsApp brief: account usage summary, key features adopted, suggested talk track\n• Synced to Airtable CRM as 'Demo Scheduled'" },
    ],
    suggestions: ["Trial accounts overview", "At-risk accounts", "This week's activations"],
    entityType: "Trial Accounts",
    entitySlug: "trial-account",
    columns: [
      { key: "company", label: "Company" },
      { key: "plan", label: "Plan" },
      { key: "activationScore", label: "Score" },
      { key: "status", label: "Status" },
    ],
    statusField: "status",
    tools: [
      { name: "entity.query", desc: "Search trial accounts", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update activation score", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "event.query", desc: "Analyze usage patterns", params: ["type?: string", "since?: string"], returns: "Event[]" },
      { name: "email.send", desc: "Send nurture emails", params: ["to: string", "subject: string", "body: string"], returns: "EmailStatus" },
      { name: "calendar.create", desc: "Book demo calls", params: ["summary: string", "start: string", "end: string"], returns: "CalendarEvent" },
      { name: "agent.chat", desc: "Hand off to sales agent", params: ["agent: string", "message: string"], returns: "AgentResponse" },
      { name: "airtable.updateRecords", desc: "Sync to CRM", params: ["baseId: string", "tableId: string", "records: object[]"], returns: "AirtableRecord[]" },
    ],
    automations: [
      {
        name: "Score activation events",
        trigger: "When usage-event is created",
        status: "active",
        lastRun: "1 min ago",
        runs: 1247,
        steps: [
          { tool: "entity.get", description: "Load account and current score" },
          { tool: "entity.update", description: "Recalculate activation score" },
          { tool: "email.send", description: "Send contextual tip" },
        ],
      },
      {
        name: "Sales-qualified handoff",
        trigger: "When trial-account.activationScore > 80",
        status: "active",
        lastRun: "4 hrs ago",
        runs: 34,
        steps: [
          { tool: "agent.chat", description: "Sales agent enriches and qualifies" },
          { tool: "calendar.freeBusy", description: "Find AE availability" },
          { tool: "calendar.create", description: "Book demo call" },
          { tool: "whatsapp.send", description: "Brief AE with account summary" },
          { tool: "airtable.updateRecords", description: "Update CRM pipeline" },
        ],
      },
      {
        name: "At-risk rescue sequence",
        trigger: "When trial ends in 3 days AND score < 30",
        status: "active",
        lastRun: "6 hrs ago",
        runs: 58,
        steps: [
          { tool: "entity.get", description: "Load account usage data" },
          { tool: "email.send", description: "Send rescue email with tips" },
          { tool: "whatsapp.send", description: "Direct outreach to account owner" },
        ],
      },
    ],
  },
  {
    label: "Event operations",
    description: "Coordinate vendors, manage attendees, and handle day-of logistics",
    slug: "logistics-agent",
    agentName: "Logistics Agent",
    prefill: [
      { from: "user", text: "Conference is tomorrow. Give me the status rundown." },
      { from: "agent", text: "TechConf 2024 — 847 registered, 812 confirmed. Vendor status:\n\n• Catering (Verde Co): Setup complete, ready\n• AV (SoundPro): Setup in progress, on schedule for 6pm\n• Decor (Bloom): Ready\n• Security (Guardian): Contracted, arriving 7am tomorrow\n\nOne flag: SoundPro reported a delayed projector shipment. Logistics agent already sourced a backup from LocalAV — confirmed available, $200 premium. Approve?" },
      { from: "user", text: "Approved. Also send the day-of details to all confirmed attendees." },
      { from: "agent", text: "Done. Two actions completed:\n\n• Backup projector confirmed with LocalAV, arriving 5pm. SoundPro notified of change. Event manager Carlos alerted via WhatsApp.\n• Day-of WhatsApp broadcast sent to 812 confirmed attendees: venue map, schedule, parking info, and check-in QR code. Email version also sent as backup." },
    ],
    suggestions: ["Vendor status rundown", "Day-of checklist", "Any issues flagged?"],
    entityType: "Vendors",
    entitySlug: "vendor",
    columns: [
      { key: "name", label: "Name" },
      { key: "service", label: "Service" },
      { key: "status", label: "Status" },
      { key: "setupDeadline", label: "Setup Deadline" },
    ],
    statusField: "status",
    tools: [
      { name: "entity.create", desc: "Register attendee or vendor", params: ["type: string", "data: object"], returns: "Entity" },
      { name: "entity.query", desc: "Search attendees and vendors", params: ["type: string", "filter?: object"], returns: "Entity[]" },
      { name: "entity.update", desc: "Update status", params: ["entityId: string", "data: object"], returns: "Entity" },
      { name: "whatsapp.sendTemplate", desc: "Broadcast to attendees", params: ["to: string", "template: string", "params?: object"], returns: "MessageStatus" },
      { name: "email.send", desc: "Send confirmations", params: ["to: string", "subject: string", "body: string"], returns: "EmailStatus" },
      { name: "agent.chat", desc: "Coordinate with comms agent", params: ["agent: string", "message: string"], returns: "AgentResponse" },
      { name: "web.search", desc: "Find backup vendors", params: ["query: string"], returns: "SearchResult[]" },
    ],
    automations: [
      {
        name: "Attendee confirmation sequence",
        trigger: "When attendee is created",
        status: "active",
        lastRun: "22 min ago",
        runs: 812,
        steps: [
          { tool: "email.send", description: "Send ticket confirmation + QR" },
          { tool: "whatsapp.send", description: "WhatsApp with event details" },
          { tool: "entity.update", description: "Set status to Confirmed" },
        ],
      },
      {
        name: "Vendor issue escalation",
        trigger: "When vendor.status → Issue",
        status: "active",
        lastRun: "4 hrs ago",
        runs: 3,
        steps: [
          { tool: "whatsapp.send", description: "Alert event manager" },
          { tool: "web.search", description: "Find backup vendor options" },
          { tool: "agent.chat", description: "Logistics agent evaluates alternatives" },
          { tool: "email.send", description: "Send contingency plan" },
        ],
      },
      {
        name: "Live capacity tracking",
        trigger: "When attendee.status → Checked In",
        status: "idle",
        lastRun: "not yet",
        runs: 0,
        steps: [
          { tool: "event.query", description: "Calculate current headcount" },
          { tool: "entity.update", description: "Update capacity metrics" },
          { tool: "whatsapp.send", description: "Alert catering if > 90%" },
        ],
      },
    ],
  },
]

export const statusColors: Record<string, string> = {
  Applied: "bg-blue-500/10 text-blue-700",
  Screening: "bg-amber-500/10 text-amber-700",
  Interview: "bg-blue-500/10 text-blue-700",
  Offer: "bg-emerald-500/10 text-emerald-700",
  Hired: "bg-emerald-500/10 text-emerald-700",
  Rejected: "bg-red-500/10 text-red-700",

  Open: "bg-blue-500/10 text-blue-700",
  Dispatched: "bg-amber-500/10 text-amber-700",
  "In Progress": "bg-blue-500/10 text-blue-700",
  Resolved: "bg-emerald-500/10 text-emerald-700",
  Billed: "bg-emerald-500/10 text-emerald-700",
  Emergency: "bg-red-500/10 text-red-700",
  High: "bg-amber-500/10 text-amber-700",
  Normal: "bg-blue-500/10 text-blue-700",
  Low: "bg-charcoal/5 text-charcoal/50",

  Active: "bg-emerald-500/10 text-emerald-700",
  "Pending Intake": "bg-amber-500/10 text-amber-700",
  "Follow-up": "bg-blue-500/10 text-blue-700",
  Discharged: "bg-charcoal/5 text-charcoal/50",
  Scheduled: "bg-blue-500/10 text-blue-700",
  Completed: "bg-emerald-500/10 text-emerald-700",
  "No-show": "bg-red-500/10 text-red-700",
  Cancelled: "bg-red-500/10 text-red-700",

  Setup: "bg-amber-500/10 text-amber-700",
  Review: "bg-blue-500/10 text-blue-700",
  Pending: "bg-amber-500/10 text-amber-700",
  Overdue: "bg-red-500/10 text-red-700",

  Trial: "bg-blue-500/10 text-blue-700",
  Activated: "bg-emerald-500/10 text-emerald-700",
  "At Risk": "bg-red-500/10 text-red-700",
  Converted: "bg-emerald-500/10 text-emerald-700",
  Churned: "bg-red-500/10 text-red-700",

  Registered: "bg-blue-500/10 text-blue-700",
  Confirmed: "bg-emerald-500/10 text-emerald-700",
  "Checked In": "bg-emerald-500/10 text-emerald-700",
  Contracted: "bg-blue-500/10 text-blue-700",
  Ready: "bg-emerald-500/10 text-emerald-700",
  Issue: "bg-red-500/10 text-red-700",
}
