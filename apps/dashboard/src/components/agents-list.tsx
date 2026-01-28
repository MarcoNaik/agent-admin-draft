"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, MoreHorizontal, ExternalLink, Search, LayoutGrid, List, Trash2, Settings, FileText } from "lucide-react"
import { Agent } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDate } from "@/lib/utils"

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

interface AgentsListProps {
  agents: Agent[]
}

export function AgentsList({ agents }: AgentsListProps) {
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center rounded-md border">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            {search ? (
              <>
                <h3 className="text-lg font-medium">No agents found</h3>
                <p className="mt-1 text-muted-foreground">
                  Try adjusting your search query
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium">No agents yet</h3>
                <p className="mt-1 text-muted-foreground">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="group relative transition-colors hover:bg-accent/50">
              <Link href={`/agents/${agent.id}`} className="absolute inset-0" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {agent.slug}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative z-10 h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
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
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex gap-2">
                  {agent.environments?.production ? (
                    <Badge variant="success" className="text-xs">Production</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Production</Badge>
                  )}
                  {agent.environments?.development ? (
                    <Badge variant="secondary" className="text-xs">Development</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Development</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {agent.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created {getTimeAgo(agent.createdAt)}</span>
                  <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                    {agent.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="group relative transition-colors hover:bg-accent/50">
              <Link href={`/agents/${agent.id}`} className="absolute inset-0" />
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{agent.name}</h3>
                      <span className="font-mono text-xs text-muted-foreground">
                        {agent.slug}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {agent.description || "No description"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {agent.environments?.production ? (
                      <Badge variant="success" className="text-xs">Production</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Production</Badge>
                    )}
                    {agent.environments?.development ? (
                      <Badge variant="secondary" className="text-xs">Development</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Development</Badge>
                    )}
                  </div>
                  <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                    {agent.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {getTimeAgo(agent.createdAt)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative z-10 h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
