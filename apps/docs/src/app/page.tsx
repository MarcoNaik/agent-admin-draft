import Link from "next/link"
import { BookOpen, Terminal, Wrench, Shield, Zap, Code } from "lucide-react"

const cards = [
  {
    title: "Getting Started",
    description: "Install Struere and create your first agent in under 5 minutes.",
    href: "/getting-started",
    icon: Zap,
  },
  {
    title: "Platform Concepts",
    description: "Entities, permissions, agents, events, and triggers.",
    href: "/platform/entities",
    icon: BookOpen,
  },
  {
    title: "SDK Reference",
    description: "defineAgent, defineEntityType, defineRole, and more.",
    href: "/sdk/overview",
    icon: Code,
  },
  {
    title: "Built-in Tools",
    description: "Entity, event, calendar, WhatsApp, and agent tools.",
    href: "/tools/built-in-tools",
    icon: Wrench,
  },
  {
    title: "CLI Commands",
    description: "init, dev, deploy, add, status, and pull.",
    href: "/cli/overview",
    icon: Terminal,
  },
  {
    title: "Permissions",
    description: "Policies, scope rules, field masks, and environment isolation.",
    href: "/platform/permissions",
    icon: Shield,
  },
]

export default function Home() {
  return (
    <div className="px-6 py-8 lg:px-16 lg:py-12">
      <h1 className="text-4xl font-bold text-forest mb-3 font-mono tracking-tight">Struere Docs</h1>
      <p className="text-forest-muted mb-8 text-base leading-relaxed max-w-3xl">
        Struere is a permission-aware AI agent platform. Define agents, entity types, roles, and triggers as code — then sync and deploy with the CLI.
      </p>

      <div className="mb-10 flex gap-3">
        <Link
          href="/getting-started"
          className="px-4 py-2 text-sm bg-forest text-cream rounded hover:bg-forest/90 transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/introduction"
          className="px-4 py-2 text-sm border border-forest/20 text-forest rounded hover:border-forest/40 transition-colors"
        >
          Read the overview
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex gap-3.5 p-5 rounded-lg border border-forest/10 hover:border-forest/25 hover:bg-forest/[0.02] transition-all cursor-pointer"
          >
            <card.icon size={20} className="text-forest-muted mt-0.5 shrink-0 group-hover:text-forest transition-colors" />
            <div>
              <h3 className="text-sm font-bold text-forest mb-1">{card.title}</h3>
              <p className="text-sm text-forest-muted leading-relaxed">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-forest/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-forest-muted mb-3">For LLMs</h3>
        <div className="flex gap-4 text-sm">
          <Link href="/llms.txt" className="text-forest-muted hover:text-forest underline underline-offset-2 transition-colors">
            llms.txt
          </Link>
          <Link href="/llms-full.txt" className="text-forest-muted hover:text-forest underline underline-offset-2 transition-colors">
            llms-full.txt
          </Link>
        </div>
      </div>
    </div>
  )
}
