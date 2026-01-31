"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ScrollText,
  Settings,
  Cpu,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AgentSidebarProps {
  agentId: string
}

const navItems = [
  { icon: Activity, label: "Overview", href: "" },
  { icon: Cpu, label: "Config", href: "/config" },
  { icon: Wrench, label: "Tools", href: "/functions" },
  { icon: ScrollText, label: "Logs", href: "/logs" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function AgentSidebar({ agentId }: AgentSidebarProps) {
  const pathname = usePathname()
  const basePath = `/agents/${agentId}`

  return (
    <nav className="flex w-48 flex-col border-r bg-background-secondary">
      <div className="px-3 py-4">
        <span className="text-xs font-medium text-content-tertiary uppercase tracking-wider">
          Agent
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2">
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
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-content-secondary hover:bg-background-tertiary hover:text-content-primary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
