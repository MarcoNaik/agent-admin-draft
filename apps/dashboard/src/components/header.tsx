"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import {
  Sparkles,
  HelpCircle,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Database,
  Calendar,
  CreditCard,
  Clock,
  GraduationCap,
  Globe,
  Code,
  Settings,
  User,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgentContext } from "@/contexts/agent-context"
import { useEnvironment } from "@/contexts/environment-context"
import { useCurrentRole, UserRole } from "@/hooks/use-current-role"
import { ThemeToggle } from "@/components/theme-toggle"
import { OrgSwitcher } from "@/components/org-switcher"

type NavItem = {
  name: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  roles?: string[]
}

type NavSeparator = {
  type: "separator"
  label: string
  roles?: string[]
}

type NavEntry = NavItem | NavSeparator

const adminNavigation: NavItem[] = [
  { name: "Agents", href: "/agents" },
  { name: "Settings", href: "/settings" },
]

const teacherNavigation: NavItem[] = [
  { name: "My Sessions", href: "/teacher/sessions", icon: Calendar },
  { name: "My Students", href: "/teacher/students", icon: GraduationCap },
  { name: "My Profile", href: "/teacher/profile", icon: User },
]

const guardianNavigation: NavItem[] = [
  { name: "Sessions", href: "/guardian/sessions", icon: Calendar },
  { name: "My Children", href: "/guardian/students", icon: GraduationCap },
  { name: "Payments", href: "/guardian/payments", icon: CreditCard },
  { name: "My Profile", href: "/guardian/profile", icon: User },
]

const entitiesNavigation: NavEntry[] = [
  { type: "separator", label: "Entities", roles: ["admin"] },
  { name: "Entity Browser", href: "/entities", icon: Database, roles: ["admin"] },
  { name: "Jobs", href: "/jobs", icon: Clock, roles: ["admin"] },
]

function isSeparator(entry: NavEntry): entry is NavSeparator {
  return "type" in entry && entry.type === "separator"
}

function hasAccess(roles?: string[], userRole?: string): boolean {
  if (!roles || roles.length === 0) return true
  if (!userRole) return roles.includes("admin")
  return roles.includes(userRole)
}

function getNavigationForRole(role: UserRole): NavItem[] {
  switch (role) {
    case "teacher":
      return teacherNavigation
    case "guardian":
      return guardianNavigation
    case "admin":
    case "member":
    default:
      return adminNavigation
  }
}

function EnvironmentSelector() {
  const { agent } = useAgentContext()
  const { environment, setEnvironment } = useEnvironment()

  if (!agent) return null

  const productionUrl = agent.environments.production?.url || `${agent.slug}.struere.dev`
  const developmentUrl = agent.environments.development?.url || `${agent.slug}-dev.struere.dev`
  const currentUrl = environment === "production" ? productionUrl : developmentUrl

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-8 px-3 text-sm border border-border/50 rounded-md hover:bg-background-tertiary transition-colors"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              environment === "production"
                ? agent.environments.production ? "bg-green-500" : "bg-gray-400"
                : agent.environments.development ? "bg-yellow-500" : "bg-gray-400"
            }`}
          />
          <span className="text-content-primary">
            {environment === "production" ? "Production" : "Development"}
          </span>
          <span className="text-content-tertiary">•</span>
          <span className="font-mono text-xs text-content-secondary">
            {currentUrl.replace('https://', '')}
          </span>
          <ChevronsUpDown className="h-3 w-3 text-content-tertiary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem
          className="flex items-center gap-3 py-2.5 cursor-pointer"
          onSelect={() => setEnvironment("production")}
        >
          <Globe className={`h-4 w-4 ${agent.environments.production ? "text-green-500" : "text-content-tertiary"}`} />
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2">
              <span className="text-content-primary">Production</span>
              {!agent.environments.production && (
                <span className="text-xs text-content-tertiary">(not deployed)</span>
              )}
            </div>
            <span className="font-mono text-xs text-content-secondary">
              {productionUrl.replace('https://', '')}
            </span>
          </div>
          {environment === "production" && (
            <span className={`h-2 w-2 rounded-full ${agent.environments.production ? "bg-green-500" : "bg-gray-400"}`} />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-3 py-2.5 cursor-pointer"
          onSelect={() => setEnvironment("development")}
        >
          <Code className={`h-4 w-4 ${agent.environments.development ? "text-yellow-500" : "text-content-tertiary"}`} />
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2">
              <span className="text-content-primary">Development</span>
              {!agent.environments.development && (
                <span className="text-xs text-content-tertiary">(not deployed)</span>
              )}
            </div>
            <span className="font-mono text-xs text-content-secondary">
              {developmentUrl.replace('https://', '')}
            </span>
          </div>
          {environment === "development" && (
            <span className={`h-2 w-2 rounded-full ${agent.environments.development ? "bg-yellow-500" : "bg-gray-400"}`} />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/agents/${agent.id}/settings`} className="flex items-center gap-3 py-2.5">
            <Settings className="h-4 w-4" />
            <span className="text-content-primary">Agent Settings</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header() {
  const pathname = usePathname()
  const { role: userRole } = useCurrentRole()
  const { agent } = useAgentContext()
  const roleNavigation = getNavigationForRole(userRole)

  const filteredEntitiesNav = entitiesNavigation.filter((entry) => {
    if (isSeparator(entry)) {
      return hasAccess(entry.roles, userRole)
    }
    return hasAccess(entry.roles, userRole)
  })

  const hasEntitiesItems = filteredEntitiesNav.some((entry) => !isSeparator(entry))

  return (
    <div className="sticky top-0 z-40">
      <header className="flex justify-between min-h-[48px] overflow-x-auto scrollbar-none bg-background-secondary border-b">
        <div className="flex items-center px-3">
          <Link href="/" className="flex items-center mr-3">
            <Zap className="h-5 w-5 text-primary" />
          </Link>

          <div className="flex items-center">
            <OrgSwitcher />

            {agent && (
              <div className="flex items-center ml-1">
                <ChevronRight className="h-4 w-4 text-content-tertiary" />
                <Link
                  href={`/agents/${agent.id}`}
                  className="px-2 py-1 text-sm font-medium text-content-primary hover:bg-background-tertiary rounded-md transition-colors"
                >
                  {agent.name}
                </Link>
              </div>
            )}

            {!agent && (
              <div className="flex items-center gap-0.5 ml-4">
                {roleNavigation.map((item) => {
                  const isActive = item.href === "/agents"
                    ? pathname === "/agents" || pathname.startsWith("/agents/")
                    : pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary rounded-md transition-colors",
                        isActive && "text-content-primary font-medium"
                      )}
                    >
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.name}
                    </Link>
                  )
                })}

                {hasEntitiesItems && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1 px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary rounded-md cursor-pointer transition-colors",
                          (pathname.startsWith("/entities") || pathname.startsWith("/jobs")) && "text-content-primary font-medium"
                        )}
                      >
                        Entities
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {filteredEntitiesNav.map((entry, index) => {
                        if (isSeparator(entry)) {
                          return index > 0 ? <DropdownMenuSeparator key={`sep-${index}`} /> : null
                        }
                        const Icon = entry.icon
                        return (
                          <DropdownMenuItem key={entry.name} asChild>
                            <Link href={entry.href} className="flex items-center gap-2">
                              {Icon && <Icon className="h-4 w-4" />}
                              {entry.name}
                            </Link>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-3">
          <EnvironmentSelector />
          <div className="flex items-center">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary cursor-pointer transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:block">Ask AI</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-background-tertiary cursor-pointer transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden md:block">Support</span>
            </button>
            <ThemeToggle />
          </div>
          <div className="rounded-md p-1 transition-colors hover:bg-background-tertiary">
            <UserButton />
          </div>
        </div>
      </header>
    </div>
  )
}
