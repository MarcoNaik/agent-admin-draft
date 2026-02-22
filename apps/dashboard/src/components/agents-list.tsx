"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Plus,
  MoreVertical,
  Search,
  LayoutGrid,
  List,
  Trash2,
  Settings,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

interface Agent {
  id: string
  name: string
  slug: string
  description?: string
  createdAt: string
}

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} months ago`
  return `${Math.floor(months / 12)} years ago`
}

interface AgentsListProps {
  agents: Agent[]
}

export function AgentsList({ agents }: AgentsListProps) {
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [pageSize] = useState(25)
  const [currentPage] = useState(1)

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.slug.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filteredAgents.length / pageSize)
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <div className="w-full p-6">
      <div className="mb-4 flex w-full flex-col flex-wrap gap-4 sm:flex-row sm:items-center">
        <h3 className="text-xl font-display font-semibold text-content-primary">Agents</h3>
        <div className="flex flex-wrap gap-2 sm:ml-auto sm:flex-nowrap">
          <div className="hidden gap-0.5 rounded-md border border-border/50 p-0.5 lg:flex">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center rounded text-sm p-1.5 cursor-pointer transition-colors ${
                viewMode === "grid" ? "bg-background-tertiary" : "hover:bg-background-tertiary/50"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center rounded text-sm p-1.5 cursor-pointer transition-colors ${
                viewMode === "list" ? "bg-background-tertiary" : "hover:bg-background-tertiary/50"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <div className="flex w-full flex-col gap-1 sm:w-auto">
            <div className="relative flex items-center min-w-[13rem] max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <Search className="h-4 w-4 text-content-tertiary" />
              </div>
              <Input
                type="search"
                placeholder="Search agents"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 font-input text-sm border-border/50"
              />
            </div>
          </div>

          <Link href="/agents/new">
            <Button variant="outline" className="h-9 border-border/50">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </Link>

          <a
            href="https://docs.struere.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md text-sm whitespace-nowrap border border-border/50 gap-1.5 cursor-pointer h-9 px-3 hover:bg-background-tertiary/50 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Start Tutorial
          </a>
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <div className="rounded-md border bg-card p-12 text-center">
          {search ? (
            <>
              <p className="text-sm text-content-primary">No agents found</p>
              <p className="mt-1 text-xs text-content-secondary">
                Try adjusting your search query
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-content-primary">No agents yet</p>
              <p className="mt-1 text-xs text-content-secondary">
                Create your first agent to get started
              </p>
              <Link href="/agents/new">
                <Button className="mt-4" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agent
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="mb-4 grid w-full grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {paginatedAgents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="relative rounded-lg bg-background-secondary hover:bg-background-tertiary flex items-center justify-between p-4 group transition-colors ease-out-soft"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-content-primary">{agent.name}</div>
                <div className="text-sm text-content-secondary">{agent.slug}</div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="text-xs text-content-tertiary">
                  Created {getTimeAgo(agent.createdAt)}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center rounded p-1 hover:bg-background-primary cursor-pointer transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreVertical className="h-4 w-4 text-content-tertiary" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/agents/${agent.id}/logs`}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Logs
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/agents/${agent.id}/settings`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-4 space-y-1">
          {paginatedAgents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="relative rounded-lg bg-background-secondary hover:bg-background-tertiary flex items-center justify-between p-4 group transition-colors ease-out-soft"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-content-primary">{agent.name}</span>
                  <span className="text-sm text-content-secondary">{agent.slug}</span>
                </div>
                {agent.description && (
                  <p className="mt-0.5 text-sm text-content-secondary line-clamp-1">
                    {agent.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 ml-4">
                <span className="text-xs text-content-tertiary whitespace-nowrap">
                  Created {getTimeAgo(agent.createdAt)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center rounded p-1 hover:bg-background-primary cursor-pointer transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreVertical className="h-4 w-4 text-content-tertiary" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/agents/${agent.id}/logs`}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Logs
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/agents/${agent.id}/settings`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Link>
          ))}
        </div>
      )}

      {filteredAgents.length > 0 && (
        <div className="flex items-center justify-between text-xs text-content-secondary">
          <span>
            {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              className="p-1 disabled:opacity-30 hover:bg-background-tertiary rounded transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {currentPage} of {totalPages || 1}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              className="p-1 disabled:opacity-30 hover:bg-background-tertiary rounded transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
