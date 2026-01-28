"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Database,
  Code,
  FileText,
  ScrollText,
  Clock,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AgentSidebarProps {
  agentId: string
}

const navItems = [
  { icon: Activity, label: "Health", href: "" },
  { icon: Database, label: "Data", href: "/data" },
  { icon: Code, label: "Functions", href: "/functions" },
  { icon: FileText, label: "Files", href: "/files" },
  { icon: ScrollText, label: "Logs", href: "/logs" },
  { icon: Clock, label: "History", href: "/history" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function AgentSidebar({ agentId }: AgentSidebarProps) {
  const pathname = usePathname()
  const basePath = `/agents/${agentId}`

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex w-14 flex-col items-center gap-2 border-r bg-background py-4">
        {navItems.map((item) => {
          const fullPath = `${basePath}${item.href}`
          const isActive =
            item.href === ""
              ? pathname === basePath
              : pathname.startsWith(fullPath)

          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <Link
                  href={fullPath}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}
