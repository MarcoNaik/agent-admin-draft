"use client"

import Link from "next/link"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { useProviderConfigs } from "@/hooks/use-convex-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const PROVIDERS = [
  {
    id: "anthropic" as const,
    name: "Anthropic",
    description: "Claude models — Haiku, Sonnet, Opus",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
  },
  {
    id: "openai" as const,
    name: "OpenAI",
    description: "GPT-4o, GPT-4o Mini, GPT-4 Turbo",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
  {
    id: "google" as const,
    name: "Google AI",
    description: "Gemini 1.5 Pro, Gemini 1.5 Flash",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
]

function ProviderStatusBadge({ mode, status }: { mode?: string; status?: string }) {
  if (!mode) {
    return <Badge variant="outline">Platform Key</Badge>
  }

  if (mode === "custom") {
    if (status === "active") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Custom Key
        </Badge>
      )
    }
    if (status === "error") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      )
    }
    return (
      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
        Custom Key (Unverified)
      </Badge>
    )
  }

  return <Badge variant="outline">Platform Key</Badge>
}

export default function ProvidersPage() {
  const configs = useProviderConfigs()

  if (configs === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Providers</h1>
          <p className="text-sm text-content-secondary">Manage LLM provider API keys for your organization</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const configMap = new Map(
    (configs ?? []).map((c: any) => [c.provider, c])
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Providers</h1>
        <p className="text-sm text-content-secondary mt-1">
          Manage LLM provider API keys for your organization
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const config = configMap.get(provider.id) as any
          return (
            <Link key={provider.id} href={`/settings/providers/${provider.id}`}>
              <Card className="bg-background-secondary cursor-pointer hover:bg-background-tertiary transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 shrink-0 rounded-lg ${provider.bgColor} flex items-center justify-center`}>
                      <span className={`text-lg font-bold ${provider.color}`}>
                        {provider.name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-content-primary">{provider.name}</h3>
                      <p className="text-sm text-content-secondary mt-0.5">{provider.description}</p>
                    </div>
                    <div className="shrink-0">
                      <ProviderStatusBadge mode={config?.mode} status={config?.status} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
