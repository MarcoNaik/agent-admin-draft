"use client"

import Link from "next/link"
import { ChevronDown, Globe, Code, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEnvironment } from "@/contexts/environment-context"

type Environment = "development" | "production"

interface EnvironmentInfo {
  url: string
  version: string
  deployedAt: string
}

interface EnvironmentSelectorProps {
  agentId: string
  agentSlug: string
  environments: {
    development: EnvironmentInfo | null
    production: EnvironmentInfo | null
  }
}

export function EnvironmentSelector({ agentId, agentSlug, environments }: EnvironmentSelectorProps) {
  const { environment: selectedEnv, setEnvironment: setSelectedEnv } = useEnvironment()

  const productionUrl = environments.production?.url || `${agentSlug}.struere.dev`
  const developmentUrl = environments.development?.url || `${agentSlug}-dev.struere.dev`
  const currentUrl = selectedEnv === "production" ? productionUrl : developmentUrl

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-border/50 focus-visible:ring-0">
          <span
            className={`h-2 w-2 rounded-full ${
              selectedEnv === "production"
                ? environments.production ? "bg-green-500" : "bg-gray-400"
                : environments.development ? "bg-yellow-500" : "bg-gray-400"
            }`}
          />
          {selectedEnv === "production" ? "Production" : "Development"}
          <span className="text-content-tertiary">•</span>
          <span className="font-mono text-xs text-content-secondary">
            {currentUrl.replace('https://', '')}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuItem
          className="flex items-center gap-3 py-3 cursor-pointer"
          onSelect={() => setSelectedEnv("production")}
        >
          <Globe className={`h-4 w-4 ${environments.production ? "text-green-500" : "text-gray-400"}`} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-content-primary">Production</span>
              {!environments.production && (
                <span className="text-xs text-content-secondary">(not deployed)</span>
              )}
            </div>
            <span className="font-mono text-xs text-content-secondary">
              {productionUrl.replace('https://', '')}
            </span>
            {environments.production && (
              <span className="text-xs text-content-secondary">v{environments.production.version}</span>
            )}
          </div>
          {selectedEnv === "production" && (
            <span className={`ml-auto h-2 w-2 rounded-full ${environments.production ? "bg-green-500" : "bg-gray-400"}`} />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-3 py-3 cursor-pointer"
          onSelect={() => setSelectedEnv("development")}
        >
          <Code className={`h-4 w-4 ${environments.development ? "text-yellow-500" : "text-gray-400"}`} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-content-primary">Development</span>
              {!environments.development && (
                <span className="text-xs text-content-secondary">(not deployed)</span>
              )}
            </div>
            <span className="font-mono text-xs text-content-secondary">
              {developmentUrl.replace('https://', '')}
            </span>
            {environments.development && (
              <span className="text-xs text-content-secondary">v{environments.development.version}</span>
            )}
          </div>
          {selectedEnv === "development" && (
            <span className={`ml-auto h-2 w-2 rounded-full ${environments.development ? "bg-yellow-500" : "bg-gray-400"}`} />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/agents/${agentId}/settings`} className="flex items-center gap-3 py-3">
            <Settings className="h-4 w-4" />
            <span className="font-medium text-content-primary">Agent Settings</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
