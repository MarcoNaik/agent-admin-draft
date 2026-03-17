"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

type Token = { text: string; color: string }
type Line = Token[]

function highlightCode(code: string): Line[] {
  const keywords = new Set(["import", "from", "export", "default"])
  const functions = new Set(["defineAgent", "defineData", "defineTrigger"])

  return code.split("\n").map((line) => {
    const tokens: Token[] = []
    let i = 0

    while (i < line.length) {
      if (line[i] === " ") {
        let spaces = ""
        while (i < line.length && line[i] === " ") {
          spaces += " "
          i++
        }
        tokens.push({ text: spaces, color: "text-white" })
        continue
      }

      if (line.slice(i, i + 2) === "{{") {
        const end = line.indexOf("}}", i + 2)
        if (end !== -1) {
          tokens.push({ text: line.slice(i, end + 2), color: "text-amber-400" })
          i = end + 2
          continue
        }
      }

      if (line[i] === '"' || line[i] === "`") {
        const quote = line[i]
        let str = quote
        i++
        while (i < line.length && line[i] !== quote) {
          if (line.slice(i, i + 2) === "{{") {
            if (str.length > 0) {
              tokens.push({ text: str, color: "text-emerald-400" })
              str = ""
            }
            const end = line.indexOf("}}", i + 2)
            if (end !== -1) {
              tokens.push({ text: line.slice(i, end + 2), color: "text-amber-400" })
              i = end + 2
              continue
            }
          }
          str += line[i]
          i++
        }
        if (i < line.length) {
          str += line[i]
          i++
        }
        tokens.push({ text: str, color: "text-emerald-400" })
        continue
      }

      if (/[0-9]/.test(line[i]) && (i === 0 || /[\s,:\[({]/.test(line[i - 1]))) {
        let num = ""
        while (i < line.length && /[0-9.]/.test(line[i])) {
          num += line[i]
          i++
        }
        tokens.push({ text: num, color: "text-orange-400" })
        continue
      }

      if (/[a-zA-Z_$]/.test(line[i])) {
        let word = ""
        while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) {
          word += line[i]
          i++
        }
        if (keywords.has(word)) {
          tokens.push({ text: word, color: "text-purple-400" })
        } else if (functions.has(word)) {
          tokens.push({ text: word, color: "text-yellow-300" })
        } else {
          tokens.push({ text: word, color: "text-sky-400" })
        }
        continue
      }

      if (/[{}()\[\]:,.]/.test(line[i])) {
        tokens.push({ text: line[i], color: "text-white/50" })
        i++
        continue
      }

      tokens.push({ text: line[i], color: "text-white/70" })
      i++
    }

    return tokens
  })
}

function CodeBlock({ code }: { code: string }) {
  const lines = highlightCode(code)

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 h-full overflow-auto">
      <pre className="font-mono text-[13px] leading-relaxed">
        {lines.map((tokens, lineIdx) => (
          <div key={lineIdx} className="flex">
            <span className="text-white/20 select-none w-8 text-right mr-4 flex-shrink-0">
              {lineIdx + 1}
            </span>
            <span>
              {tokens.map((token, tokenIdx) => (
                <span key={tokenIdx} className={token.color}>
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </div>
  )
}

const toolGroups = [
  { category: "Entity", tools: ["query", "get", "create", "update", "delete", "link", "unlink"] },
  { category: "Events", tools: ["emit", "query"] },
  { category: "Calendar", tools: ["list", "create", "update", "delete", "freeBusy"] },
  { category: "WhatsApp", tools: ["send", "sendTemplate", "sendMedia", "getConversation"] },
  { category: "Email", tools: ["send"] },
  { category: "Payments", tools: ["create", "getStatus"] },
]

function ToolsPanel() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 h-full overflow-auto">
      <div className="grid grid-cols-2 gap-6">
        {toolGroups.map((group) => (
          <div key={group.category}>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
              {group.category}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.tools.map((tool) => (
                <span
                  key={tool}
                  className="bg-white/8 text-white/70 text-xs px-2.5 py-1 rounded-md font-mono"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const records = [
  { id: "#4521", customer: "Maria Gonzalez", status: "Shipped", total: "$89.99", carrier: "DHL" },
  { id: "#4522", customer: "Carlos Reyes", status: "Processing", total: "$234.50", carrier: "FedEx" },
  { id: "#4523", customer: "Ana Fernandez", status: "Delivered", total: "$45.00", carrier: "USPS" },
  { id: "#4524", customer: "Juan Pérez", status: "Pending", total: "$167.80", carrier: "\u2014" },
]

const statusColors: Record<string, string> = {
  Shipped: "bg-blue-500/20 text-blue-300",
  Processing: "bg-amber-500/20 text-amber-300",
  Delivered: "bg-emerald-500/20 text-emerald-300",
  Pending: "bg-white/10 text-white/50",
}

function RecordsPanel() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 h-full overflow-auto">
      <table className="w-full text-xs text-white/70">
        <thead>
          <tr className="text-white/40 uppercase tracking-wider text-[11px]">
            <th className="text-left pb-4 font-medium">Order ID</th>
            <th className="text-left pb-4 font-medium">Customer</th>
            <th className="text-left pb-4 font-medium">Status</th>
            <th className="text-right pb-4 font-medium">Total</th>
            <th className="text-right pb-4 font-medium">Carrier</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.id} className="border-b border-white/5">
              <td className="py-3.5 font-mono text-white/50">{row.id}</td>
              <td className="py-3.5">{row.customer}</td>
              <td className="py-3.5">
                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[row.status]}`}>
                  {row.status}
                </span>
              </td>
              <td className="py-3.5 text-right font-mono">{row.total}</td>
              <td className="py-3.5 text-right">{row.carrier}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const agentCode = `import { defineAgent } from "struere"

export default defineAgent({
  name: "Support Agent",
  slug: "support-agent",
  version: "0.2.0",
  model: {
    provider: "xai",
    name: "grok-4-1-fast",
  },
  systemPrompt: \`You are {{agentName}}, a customer
support agent for an online store.

Available data:
{{entity.types()}}

Use entity.query to look up orders by
orderId or customerName.\`,
  tools: [
    "entity.query",
    "entity.get",
    "entity.update",
    "event.emit",
  ],
})`

const dataCode = `import { defineData } from "struere"

export default defineData({
  name: "Order",
  slug: "order",
  schema: {
    orderId: { type: "string" },
    customerName: { type: "string" },
    status: { type: "string" },
    total: { type: "number" },
    trackingNumber: { type: "string" },
    carrier: { type: "string" },
    shippingAddress: { type: "string" },
  },
  searchFields: [
    "orderId",
    "customerName",
    "status",
  ],
})`

const triggerCode = `import { defineTrigger } from "struere"

export default defineTrigger({
  name: "Payment Reminder",
  slug: "payment-reminder",
  on: {
    entityType: "invoice",
    action: "updated",
    condition: {
      field: "status",
      operator: "eq",
      value: "overdue",
    },
  },
  actions: [
    {
      type: "agent.run",
      agent: "billing-agent",
      message: "Invoice {{entity.invoiceId}} is overdue. Send a reminder to {{entity.customerName}}.",
    },
  ],
})`

const tabs = [
  { label: "Agent", type: "code" as const, code: agentCode },
  { label: "Data", type: "code" as const, code: dataCode },
  { label: "Tools", type: "tools" as const },
  { label: "Triggers", type: "code" as const, code: triggerCode },
  { label: "Records", type: "records" as const },
]

export function PlatformShowcase() {
  const [active, setActive] = useState(0)
  const { ref, opacity, y } = useFadeSlideUp()

  const currentTab = tabs[active]

  return (
    <section className="bg-stone-deep py-20 md:py-28">
      <motion.div
        ref={ref}
        style={{ opacity, y, willChange: "transform, opacity" }}
        className="mx-auto max-w-5xl px-6 md:px-12"
      >
        <p className="text-center text-xs font-medium uppercase tracking-widest text-charcoal/40 mb-14">
          What gets built
        </p>

        <div className="flex flex-col md:flex-row gap-8 md:gap-16">
          <div className="md:w-[35%] flex flex-col gap-1">
            {tabs.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActive(i)}
                className={`text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                  active === i
                    ? "bg-charcoal/8 text-charcoal-heading"
                    : "text-charcoal/40 hover:text-charcoal/70 hover:bg-charcoal/4"
                }`}
              >
                <span className="font-display text-[15px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="md:w-[65%]">
            <div className="h-[520px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  {currentTab.type === "code" && <CodeBlock code={currentTab.code!} />}
                  {currentTab.type === "tools" && <ToolsPanel />}
                  {currentTab.type === "records" && <RecordsPanel />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
