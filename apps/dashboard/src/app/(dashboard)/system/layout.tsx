"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  Shield,
  Wrench,
  Zap,
  FlaskConical,
  Building2,
  Users,
  Plug,
  Key,
  Cpu,
  CreditCard,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import { AdminOnly } from "@/components/role-redirect"
import { useAgents } from "@/hooks/use-agents"

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const systemNav: NavItem[] = [
  { name: "Roles", href: "/system/roles", icon: Shield },
  { name: "Tools", href: "/system/tools", icon: Wrench },
  { name: "Automations", href: "/system/automations", icon: Zap },
  { name: "Evals", href: "/system/evals", icon: FlaskConical },
]

const settingsNav: NavItem[] = [
  { name: "General", href: "/system/settings", icon: Building2 },
  { name: "Users", href: "/system/settings/users", icon: Users },
  { name: "Integrations", href: "/system/settings/integrations", icon: Plug },
  { name: "API Keys", href: "/system/settings/api-keys", icon: Key },
  { name: "Providers", href: "/system/settings/providers", icon: Cpu },
  { name: "Billing", href: "/system/settings/billing", icon: CreditCard },
  { name: "Usage", href: "/system/settings/usage", icon: BarChart3 },
]

function AgentsNavItem({ pathname }: { pathname: string }) {
  const agents = useAgents()
  const isAgentsSection = pathname.startsWith("/system/agents")
  const isAgentsListPage = pathname === "/system/agents" || pathname === "/system/agents/new"
  const [expanded, setExpanded] = useState(isAgentsSection)

  return (
    <li>
      <div
        className={cn(
          "flex items-center rounded-lg transition-colors ease-out-soft group/agents",
          isAgentsListPage
            ? "bg-content-primary/[0.06] text-content-primary font-medium"
            : isAgentsSection
              ? "text-content-primary font-medium"
              : "text-content-secondary hover:text-content-primary hover:bg-content-primary/[0.04]"
        )}
      >
        <Link
          href="/system/agents"
          className="flex-1 flex items-center gap-3 px-3 py-2 text-[13px]"
        >
          <Bot className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1">Agents</span>
        </Link>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 mr-1 rounded-md text-content-tertiary hover:text-content-primary transition-colors ease-out-soft cursor-pointer"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {expanded && agents && agents.length > 0 && (
        <ul className="mt-0.5 ml-3 pl-3 border-l border-border/30 space-y-0.5">
          {agents.map((agent: { _id: string; name: string }) => {
            const agentHref = `/system/agents/${agent._id}`
            const isActive = pathname.startsWith(agentHref)
            return (
              <li key={agent._id}>
                <Link
                  href={agentHref}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors ease-out-soft truncate",
                    isActive
                      ? "text-content-primary font-medium bg-content-primary/[0.06]"
                      : "text-content-secondary hover:text-content-primary hover:bg-content-primary/[0.04]"
                  )}
                >
                  <Bot className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{agent.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active =
          item.href === "/system/settings"
            ? pathname === "/system/settings"
            : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <li key={item.name}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ease-out-soft",
                active
                  ? "bg-content-primary/[0.06] text-content-primary font-medium"
                  : "text-content-secondary hover:text-content-primary hover:bg-content-primary/[0.04]"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.name}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <AdminOnly>
      <div className="flex h-full">
        <aside className="w-56 border-r border-border/40 flex flex-col shrink-0">
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              <AgentsNavItem pathname={pathname} />
            </ul>
            <div className="mt-0.5">
              <NavList items={systemNav} pathname={pathname} />
            </div>

            <div className="mt-6">
              <p className="px-3 mb-2 text-[11px] font-medium text-content-tertiary tracking-wide">Settings</p>
              <NavList items={settingsNav} pathname={pathname} />
            </div>

            <div className="mt-6">
              <Link
                href="/system/settings/danger"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ease-out-soft",
                  pathname === "/system/settings/danger"
                    ? "bg-destructive/10 text-destructive font-medium"
                    : "text-destructive/60 hover:text-destructive hover:bg-destructive/[0.06]"
                )}
              >
                <AlertTriangle className="h-[18px] w-[18px] shrink-0" />
                <span>Danger Zone</span>
              </Link>
            </div>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </AdminOnly>
  )
}
