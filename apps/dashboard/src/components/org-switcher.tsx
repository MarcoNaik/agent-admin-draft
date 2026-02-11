"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOrganization, useOrganizationList, useUser } from "@clerk/nextjs"
import {
  Search,
  Settings,
  Plus,
  ChevronLeft,
  ChevronsUpDown,
  Check,
  Bot,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAgents, useCurrentOrganization } from "@/hooks/use-convex-data"
import { useCurrentRole } from "@/hooks/use-current-role"
import { Doc } from "@convex/_generated/dataModel"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { CreateOrgDialog } from "./create-org-dialog"

function OrgAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U"

  const sizeClasses = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm"

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full relative overflow-hidden shrink-0",
        sizeClasses
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 21% 59%, hsl(var(--primary) / 0.6) 0%, hsl(var(--primary)) 80%, hsl(var(--primary) / 0.8) 100%)",
      }}
    >
      <span className="pointer-events-none absolute inset-0 z-10 h-full w-full rounded-full bg-black/30 dark:bg-black/15" />
      <span
        className="relative z-20 font-medium text-white leading-none"
        style={{ textShadow: "0 0 3px rgba(0,0,0,0.5)" }}
      >
        {initials}
      </span>
    </span>
  )
}

type View = "agents" | "orgs"

export function OrgSwitcher() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>("agents")
  const [searchQuery, setSearchQuery] = useState("")
  const [createOrgOpen, setCreateOrgOpen] = useState(false)

  const { user, isLoaded: userLoaded } = useUser()
  const { organization: clerkOrg, isLoaded: orgLoaded } = useOrganization()
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const agents = useAgents()
  const convexOrg = useCurrentOrganization()
  const { role } = useCurrentRole()
  const isMember = role === "member"

  const isLoaded = userLoaded && orgLoaded
  const orgName = convexOrg?.name || clerkOrg?.name || user?.firstName || "Personal"

  const filteredAgents = useMemo(() => {
    if (!agents) return []
    if (!searchQuery.trim()) return agents
    const query = searchQuery.toLowerCase()
    return agents.filter(
      (agent: Doc<"agents">) =>
        agent.name.toLowerCase().includes(query) ||
        agent.slug?.toLowerCase().includes(query)
    )
  }, [agents, searchQuery])

  const handleOrgSelect = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId })
      setView("agents")
      setOpen(false)
      window.location.href = "/agents"
    }
  }

  const handleAgentSelect = (agentId: string) => {
    setOpen(false)
    router.push(`/agents/${agentId}`)
  }

  const handleCreateAgent = () => {
    setOpen(false)
    router.push("/agents/new")
  }

  const handleCreateOrg = () => {
    setCreateOrgOpen(true)
  }

  const handleOrgCreated = () => {
    setView("agents")
    router.push("/agents")
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center h-8 px-2 gap-1.5 select-none text-content-primary hover:bg-background-tertiary rounded-md cursor-pointer transition-colors"
          >
            <OrgAvatar name={orgName} />
            <span className="text-content-tertiary">/</span>
            <span className="font-medium">{isLoaded ? orgName : "..."}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-content-tertiary" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-72 p-0 bg-popover border-border/50"
          sideOffset={8}
        >
          {view === "agents" ? (
            <div className="flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-border/50">
                <button
                  type="button"
                  onClick={() => setView("orgs")}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background-tertiary transition-colors cursor-pointer"
                >
                  <OrgAvatar name={orgName} />
                  <span className="font-medium text-content-primary text-sm">
                    {orgName}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 text-content-tertiary" />
                </button>
                {!isMember && (
                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-md hover:bg-background-tertiary transition-colors"
                  >
                    <Settings className="h-4 w-4 text-content-secondary" />
                  </Link>
                )}
              </div>

              {!isMember && (
                <>
                  <div className="p-2 border-b border-border/50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
                      <Input
                        placeholder="Search agents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 bg-background-tertiary border-border/50 text-sm"
                      />
                    </div>
                  </div>

                  <div className="p-1">
                    <div className="px-2 py-1.5 text-xs font-medium text-content-tertiary uppercase tracking-wider">
                      Agents
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {agents === undefined ? (
                        <div className="px-2 py-4 text-center text-sm text-content-secondary">
                          Loading...
                        </div>
                      ) : filteredAgents.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-content-secondary">
                          {searchQuery ? "No agents found" : "No agents yet"}
                        </div>
                      ) : (
                        filteredAgents.map((agent: Doc<"agents">) => (
                          <button
                            key={agent._id}
                            type="button"
                            onClick={() => handleAgentSelect(agent._id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background-tertiary transition-colors cursor-pointer text-left"
                          >
                            <Bot className="h-4 w-4 text-content-tertiary shrink-0" />
                            <span className="text-sm text-content-primary truncate">
                              {agent.name}
                            </span>
                            {agent.status === "active" && (
                              <span className="ml-auto h-2 w-2 rounded-full bg-green-500 shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="p-1 border-t border-border/50">
                    <button
                      type="button"
                      onClick={handleCreateAgent}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background-tertiary transition-colors cursor-pointer text-primary"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm">Create Agent</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center gap-2 p-2 border-b border-border/50">
                <button
                  type="button"
                  onClick={() => setView("agents")}
                  className="p-1 rounded-md hover:bg-background-tertiary transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4 text-content-secondary" />
                </button>
                <span className="font-medium text-content-primary text-sm">
                  Select Organization
                </span>
              </div>

              <div className="p-1 max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setView("agents")}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors cursor-pointer bg-background-tertiary"
                >
                  <OrgAvatar name={orgName} />
                  <span className="text-sm text-content-primary truncate flex-1 text-left">
                    {orgName}
                  </span>
                  <Check className="h-4 w-4 text-primary shrink-0" />
                </button>
                {userMemberships?.data
                  ?.filter((membership) => membership.organization.id !== clerkOrg?.id)
                  .map((membership) => (
                    <button
                      key={membership.id}
                      type="button"
                      onClick={() => handleOrgSelect(membership.organization.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors cursor-pointer hover:bg-background-tertiary"
                    >
                      <OrgAvatar name={membership.organization.name} />
                      <span className="text-sm text-content-primary truncate flex-1 text-left">
                        {membership.organization.name}
                      </span>
                    </button>
                  ))}
              </div>

              <div className="p-1 border-t border-border/50">
                <button
                  type="button"
                  onClick={handleCreateOrg}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background-tertiary transition-colors cursor-pointer text-primary"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Create Organization</span>
                </button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <CreateOrgDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onSuccess={handleOrgCreated}
      />
    </>
  )
}
