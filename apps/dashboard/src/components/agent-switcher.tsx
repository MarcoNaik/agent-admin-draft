"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  ChevronsUpDown,
  Bot,
  Check,
} from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { Doc } from "@convex/_generated/dataModel"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { useAgentContext } from "@/contexts/agent-context"

export function AgentSwitcher() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { agent } = useAgentContext()
  const agents = useQuery(api.agents.list, {})

  const filteredAgents = useMemo(() => {
    if (!agents) return []
    if (!searchQuery.trim()) return agents
    const query = searchQuery.toLowerCase()
    return agents.filter(
      (a: Doc<"agents">) =>
        a.name.toLowerCase().includes(query) ||
        a.slug?.toLowerCase().includes(query)
    )
  }, [agents, searchQuery])

  const handleAgentSelect = (agentId: string) => {
    setOpen(false)
    setSearchQuery("")
    router.push(`/agents/${agentId}`)
  }

  const handleCreateAgent = () => {
    setOpen(false)
    setSearchQuery("")
    router.push("/agents/new")
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearchQuery("") }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center h-8 px-2 gap-1.5 select-none text-content-primary hover:bg-background-tertiary rounded-md cursor-pointer transition-colors ease-out-soft"
        >
          <Bot className="h-4 w-4 text-content-tertiary" />
          <span className="font-medium text-sm">{agent ? agent.name : "Agents"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-content-tertiary" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-64 p-0 bg-popover border-border/50"
        sideOffset={8}
      >
        <div className="flex flex-col">
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-background-tertiary border-border/50 text-sm font-input"
              />
            </div>
          </div>

          <div className="p-1 max-h-64 overflow-y-auto">
            {agents === undefined ? (
              <div className="px-2 py-4 text-center text-sm text-content-secondary">
                Loading...
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-content-secondary">
                {searchQuery ? "No agents found" : "No agents yet"}
              </div>
            ) : (
              filteredAgents.map((a: Doc<"agents">) => {
                const isCurrent = agent !== null && a._id === agent.id
                return (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => handleAgentSelect(a._id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ease-out-soft cursor-pointer text-left ${isCurrent ? "bg-background-tertiary" : "hover:bg-background-tertiary"}`}
                  >
                    <Bot className="h-4 w-4 text-content-tertiary shrink-0" />
                    <span className="text-sm text-content-primary truncate flex-1">
                      {a.name}
                    </span>
                    {isCurrent && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                    {!isCurrent && a.status === "active" && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-success shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          <div className="p-1 border-t border-border/50">
            <button
              type="button"
              onClick={handleCreateAgent}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background-tertiary transition-colors ease-out-soft cursor-pointer text-primary"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Create Agent</span>
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
