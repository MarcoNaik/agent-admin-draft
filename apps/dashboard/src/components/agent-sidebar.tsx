"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ScrollText,
  Settings,
  Cpu,
  Wrench,
  MessageSquare,
  FlaskConical,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentSidebarProps {
  agentId: string
  chatOpen?: boolean
  onChatToggle?: () => void
}

const navItems = [
  { icon: Activity, label: "Overview", href: "" },
  { icon: Cpu, label: "Config", href: "/config" },
  { icon: Wrench, label: "Tools", href: "/functions" },
  { icon: ScrollText, label: "Logs", href: "/logs" },
  { icon: FlaskConical, label: "Evals", href: "/evals" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function AgentSidebar({ agentId, chatOpen, onChatToggle }: AgentSidebarProps) {
  const pathname = usePathname()
  const basePath = `/agents/${agentId}`

  return (
    <nav className="flex w-48 flex-col border-r bg-background-secondary">
      <div className="px-3 py-4">
        <span className="text-xs font-medium text-content-tertiary uppercase tracking-wider">
          Agent
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 flex-1">
        {navItems.map((item) => {
          const fullPath = `${basePath}${item.href}`
          const isActive =
            item.href === ""
              ? pathname === basePath
              : pathname.startsWith(fullPath)

          return (
            <Link
              key={item.label}
              href={fullPath}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ease-out-soft",
                isActive
                  ? "bg-ocean/10 text-ocean border-l-2 border-ocean font-medium"
                  : "text-content-secondary hover:bg-ocean-light hover:text-content-primary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
      {onChatToggle && (
        <div className="px-2 py-3 border-t">
          <button
            onClick={onChatToggle}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ease-out-soft cursor-pointer",
              chatOpen
                ? "bg-ocean/10 text-ocean border-l-2 border-ocean font-medium"
                : "text-content-secondary hover:bg-ocean-light hover:text-content-primary"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>
        </div>
      )}
    </nav>
  )
}
