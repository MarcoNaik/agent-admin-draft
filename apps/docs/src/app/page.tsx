import Link from "next/link"
import { BookOpen, Terminal, Wrench, Zap, Code, Globe } from "lucide-react"

const cards = [
  {
    title: "Getting Started",
    description: "Install Struere and create your first agent in under 5 minutes.",
    href: "/getting-started",
    icon: Zap,
  },
  {
    title: "Chat API",
    description: "POST /v1/agents/:slug/chat — send messages to agents via HTTP.",
    href: "/api/chat",
    icon: Globe,
  },
  {
    title: "SDK Reference",
    description: "defineAgent, defineEntityType, defineRole, and more.",
    href: "/sdk/overview",
    icon: Code,
  },
  {
    title: "Built-in Tools",
    description: "Entity, event, calendar, WhatsApp, Airtable, and agent tools.",
    href: "/tools/built-in-tools",
    icon: Wrench,
  },
  {
    title: "Platform Concepts",
    description: "Entities, agents, triggers, events, permissions, and evals.",
    href: "/platform/entities",
    icon: BookOpen,
  },
  {
    title: "CLI Commands",
    description: "init, dev, deploy, add, status, and pull.",
    href: "/cli/overview",
    icon: Terminal,
  },
]

export default function Home() {
  return (
    <div className="px-6 py-8 lg:px-16 lg:py-12">
      <h1 className="text-4xl font-bold text-charcoal-heading mb-3 font-display tracking-tight">Struere Docs</h1>
      <p className="text-content-secondary mb-8 text-base leading-relaxed max-w-3xl">
        Struere is an AI agent platform with a built-in data layer, dynamic prompts, automation, and integrations. Define agents, entity types, and triggers as code — talk to them via API.
      </p>

      <div className="mb-8 flex gap-3">
        <Link
          href="/getting-started"
          className="px-4 py-2 text-sm bg-ocean text-white rounded hover:bg-ocean-light transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/introduction"
          className="px-4 py-2 text-sm border border-border text-charcoal rounded hover:border-ocean/30 transition-colors"
        >
          Read the overview
        </Link>
      </div>

      <div className="mb-8 p-4 rounded-lg border border-border bg-card/50">
        <h3 className="text-xs font-bold uppercase tracking-wider text-content-tertiary mb-2">For AI Agents &amp; LLMs</h3>
        <p className="text-sm text-content-secondary mb-2">Use these plain-text endpoints instead of scraping HTML:</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-mono">
          <a href="https://docs.struere.dev/llms.txt" className="text-ocean hover:underline">docs.struere.dev/llms.txt</a>
          <a href="https://docs.struere.dev/llms-full.txt" className="text-ocean hover:underline">docs.struere.dev/llms-full.txt</a>
          <a href="https://docs.struere.dev/llms-api.txt" className="text-ocean hover:underline">docs.struere.dev/llms-api.txt</a>
          <a href="https://docs.struere.dev/openapi.yaml" className="text-ocean hover:underline">docs.struere.dev/openapi.yaml</a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex gap-3.5 p-5 rounded-lg border border-border hover:border-ocean/20 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all cursor-pointer"
          >
            <card.icon size={20} className="text-content-tertiary mt-0.5 shrink-0 group-hover:text-ocean transition-colors" />
            <div>
              <h3 className="text-sm font-bold text-charcoal-heading mb-1">{card.title}</h3>
              <p className="text-sm text-content-secondary leading-relaxed">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
