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
  Zap,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Agent } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    <div className="w-full">
      <div className="mb-4 flex w-full flex-col flex-wrap gap-4 sm:flex-row sm:items-center">
        <h3 className="text-xl font-semibold">Agents</h3>
        <div className="flex flex-wrap gap-2 sm:ml-auto sm:flex-nowrap">
          <div className="hidden gap-1 rounded-md border bg-background-secondary p-1 lg:flex">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center rounded-md text-sm font-medium p-1 hover:bg-background-primary cursor-pointer ${
                viewMode === "grid" ? "bg-background-tertiary" : ""
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center rounded-md text-sm font-medium p-1 hover:bg-background-primary cursor-pointer ${
                viewMode === "list" ? "bg-background-tertiary" : ""
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <div className="flex w-full flex-col gap-1 sm:w-auto">
            <div className="relative flex items-center min-w-[13rem] max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center gap-1">
                <Search className="h-4 w-4 text-content-secondary" />
              </div>
              <Input
                type="search"
                placeholder="Search agents"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 bg-background-secondary text-sm"
              />
            </div>
          </div>

          <Link href="/agents/new">
            <Button variant="outline" className="bg-background-secondary hover:bg-background-primary">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          </Link>

          <a
            href="https://docs.struere.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md text-sm font-medium whitespace-nowrap bg-util-accent text-white gap-1.5 border border-white/30 cursor-pointer p-1.5 px-3 hover:bg-util-accent/80"
          >
            <ExternalLink className="h-4 w-4" />
            Start Tutorial
          </a>
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <Card className="bg-background-secondary">
          <CardContent className="py-12 text-center">
            {search ? (
              <>
                <h3 className="text-lg font-medium text-content-primary">No agents found</h3>
                <p className="mt-1 text-content-secondary">
                  Try adjusting your search query
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-content-primary">No agents yet</h3>
                <p className="mt-1 text-content-secondary">
                  Create your first agent to get started
                </p>
                <Link href="/agents/new">
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="mb-4 grid w-full grow grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {paginatedAgents.map((agent) => (
            <div
              key={agent.id}
              className="relative border rounded-xl bg-background-secondary flex items-center gap-4 px-4 hover:border-border-selected group"
            >
              <Link
                href={`/agents/${agent.id}`}
                className="grow cursor-pointer min-w-0 py-4"
              >
                <div>
                  <div className="truncate">
                    <span className="flex items-center gap-2 text-content-primary">
                      <span className="shrink truncate font-medium">{agent.name}</span>
                    </span>
                  </div>
                  <div className="mb-1 h-4 truncate text-xs text-content-secondary">
                    {agent.slug}
                  </div>
                </div>
              </Link>
              <div className="flex gap-1">
                <div className="flex flex-col items-end">
                  <div className="flex gap-1">
                    <div className="flex h-6 items-center justify-end gap-1 truncate text-xs">
                      <Link
                        href={`/agents/${agent.id}?env=production`}
                        className="peer hover:underline text-content-primary"
                      >
                        Production
                      </Link>
                      <div className="text-content-tertiary">•</div>
                      <Link
                        href={`/agents/${agent.id}?env=development`}
                        className="group-hover:underline peer-hover:no-underline hover:underline text-content-primary"
                      >
                        Development
                      </Link>
                    </div>
                  </div>
                  <div className="text-xs text-content-secondary truncate">
                    Created {getTimeAgo(agent.createdAt)}
                  </div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md text-sm font-medium p-1.5 hover:bg-background-primary cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4 text-content-secondary" />
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
          ))}
        </div>
      ) : (
        <div className="mb-4 space-y-2">
          {paginatedAgents.map((agent) => (
            <div
              key={agent.id}
              className="relative border rounded-xl bg-background-secondary flex items-center gap-4 px-4 hover:border-border-selected group"
            >
              <Link
                href={`/agents/${agent.id}`}
                className="grow cursor-pointer min-w-0 py-4"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-content-primary">{agent.name}</span>
                      <span className="text-xs text-content-secondary">{agent.slug}</span>
                    </div>
                    {agent.description && (
                      <p className="mt-1 text-sm text-content-secondary line-clamp-1">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-4">
                <div className="flex h-6 items-center gap-1 text-xs">
                  <Link
                    href={`/agents/${agent.id}?env=production`}
                    className="hover:underline text-content-primary"
                  >
                    Production
                  </Link>
                  <span className="text-content-tertiary">•</span>
                  <Link
                    href={`/agents/${agent.id}?env=development`}
                    className="hover:underline text-content-primary"
                  >
                    Development
                  </Link>
                </div>
                <span className="text-xs text-content-secondary">
                  Created {getTimeAgo(agent.createdAt)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md text-sm font-medium p-1.5 hover:bg-background-primary cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4 text-content-secondary" />
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
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex w-full justify-end">
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-sm text-content-secondary tabular-nums">Showing </span>
            <span className="text-sm text-content-primary">{pageSize}</span>
            <span className="text-sm text-content-secondary tabular-nums">agents per page</span>
          </div>
          <button
            type="button"
            disabled={currentPage === 1}
            className="inline-flex items-center rounded-md text-sm font-medium p-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-content-secondary tabular-nums">Page {currentPage}</span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            className="inline-flex items-center rounded-md text-sm font-medium p-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="my-12">
        <h4 className="text-lg font-semibold">Learn about Struere</h4>
        <ul className="flex flex-wrap justify-between gap-6 py-6">
          <li className="grow">
            <div className="relative -m-2 flex items-center space-x-4 rounded-xl p-2 hover:bg-background-tertiary">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus:outline-none"
                    href="https://docs.struere.dev"
                  >
                    <span className="absolute inset-0" aria-hidden="true" />
                    <span>Docs</span>
                    <span aria-hidden="true"> →</span>
                  </a>
                </p>
                <p className="mt-1 text-sm text-content-secondary">
                  Learn more about Struere
                </p>
              </div>
            </div>
          </li>
          <li className="grow">
            <div className="relative -m-2 flex items-center space-x-4 rounded-xl p-2 hover:bg-background-tertiary">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-util-accent">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus:outline-none"
                    href="https://blog.struere.dev"
                  >
                    <span className="absolute inset-0" aria-hidden="true" />
                    <span>Blog</span>
                    <span aria-hidden="true"> →</span>
                  </a>
                </p>
                <p className="mt-1 text-sm text-content-secondary">
                  Get tips and tricks on using Struere
                </p>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}
