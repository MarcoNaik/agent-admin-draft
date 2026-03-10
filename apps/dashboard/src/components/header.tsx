"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import {
  ChevronsUpDown,
  Globe,
  Code,
  User,
  Terminal,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEnvironment } from "@/contexts/environment-context"
import { useStudio } from "@/contexts/studio-context"
import { useCurrentRole } from "@/hooks/use-current-role"
import { useAgents } from "@/hooks/use-agents"
import { ThemeToggle } from "@/components/theme-toggle"
import { OrgSwitcher } from "@/components/org-switcher"
import { NotificationBell } from "@/components/notification-bell"

type NavItem = {
  name: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
}

const adminNavigation: NavItem[] = [
  { name: "Conversations", href: "/conversations" },
  { name: "Data", href: "/entities" },
  { name: "System", href: "/system" },
]

const memberNavigation: NavItem[] = [
  { name: "Data", href: "/entities" },
  { name: "Conversations", href: "/conversations" },
  { name: "Profile", href: "/profile", icon: User },
]

function getNavigationForRole(role: string): NavItem[] {
  if (role === "admin") return adminNavigation
  return memberNavigation
}

function EnvironmentSelector() {
  const { environment, setEnvironment } = useEnvironment()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-8 px-3 text-sm border border-border/50 rounded-md hover:bg-background-tertiary transition-colors ease-out-soft"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              environment === "production" ? "bg-success" : "bg-warning"
            }`}
          />
          <span className="text-content-primary">
            {environment === "production" ? "Production" : "Development"}
          </span>
          <ChevronsUpDown className="h-3 w-3 text-content-tertiary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          className="flex items-center gap-3 py-2.5 cursor-pointer"
          onSelect={() => setEnvironment("production")}
        >
          <Globe className="h-4 w-4 text-success" />
          <span className="flex-1 text-content-primary">Production</span>
          {environment === "production" && (
            <span className="h-2 w-2 rounded-full bg-success" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-3 py-2.5 cursor-pointer"
          onSelect={() => setEnvironment("development")}
        >
          <Code className="h-4 w-4 text-warning" />
          <span className="flex-1 text-content-primary">Development</span>
          {environment === "development" && (
            <span className="h-2 w-2 rounded-full bg-warning" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StudioToggle() {
  const { isOpen, toggleStudio, hasActiveSession } = useStudio()
  const agents = useAgents()
  const shouldPulse = !isOpen && (agents?.length ?? 0) === 0

  return (
    <button
      type="button"
      onClick={toggleStudio}
      className={cn(
        "studio-btn relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-transparent",
        isOpen ? "studio-active font-medium" : "text-content-secondary",
        shouldPulse && "animate-pulse"
      )}
    >
      <span className="relative z-10 flex items-center gap-1.5">
        <Terminal className="h-4 w-4" />
        Studio
      </span>
      {hasActiveSession && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-success z-10" />
      )}
    </button>
  )
}

export function Header() {
  const pathname = usePathname()
  const { role: userRole, isOrgAdmin } = useCurrentRole()
  const roleNavigation = getNavigationForRole(userRole)

  return (
    <div className="sticky top-0 z-40">
      <header className="flex items-center min-h-[48px] overflow-x-auto scrollbar-none">
        <div className="flex items-center px-3">
          <Link href="/" className="flex items-center mr-3 font-display text-lg font-semibold tracking-tight text-foreground">
            Struere
          </Link>
          <OrgSwitcher />
        </div>

        <nav className="flex items-center gap-0.5 mx-auto">
          {roleNavigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center px-3 py-1.5 text-sm rounded-md transition-colors ease-out-soft",
                  isActive
                    ? "text-content-primary"
                    : "text-content-secondary hover:text-content-primary hover:bg-background-tertiary"
                )}
              >
                <span className="font-medium invisible flex items-center gap-1.5" aria-hidden="true">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.name}
                </span>
                <span className={cn("absolute inset-0 flex items-center justify-center gap-1.5", isActive && "font-medium")}>
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 px-3">
          <a
            href="https://docs.struere.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary rounded-md transition-colors ease-out-soft"
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </a>
          {isOrgAdmin && <StudioToggle />}
          {isOrgAdmin && <EnvironmentSelector />}
          {isOrgAdmin && <NotificationBell />}
          <div className="flex items-center">
            <ThemeToggle />
          </div>
          <div className="rounded-md p-1 transition-colors ease-out-soft hover:bg-background-tertiary">
            <UserButton />
          </div>
        </div>
      </header>
    </div>
  )
}
