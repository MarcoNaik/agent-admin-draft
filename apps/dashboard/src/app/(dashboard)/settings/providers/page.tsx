"use client"

import { useState } from "react"
import {
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react"
import {
  useProviderConfigs,
  useUpdateProviderConfig,
  useDeleteProviderConfig,
  useTestProviderConnection,
} from "@/hooks/use-convex-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type ProviderKey = "anthropic" | "openai" | "google" | "xai"

const PROVIDERS: {
  id: ProviderKey
  name: string
  description: string
  color: string
  bgColor: string
  keyPrefix: string
}[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models — Haiku, Sonnet, Opus",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    keyPrefix: "sk-ant-",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4o Mini, GPT-4 Turbo",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    keyPrefix: "sk-",
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini 1.5 Pro, Gemini 1.5 Flash",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    keyPrefix: "AI",
  },
  {
    id: "xai",
    name: "xAI",
    description: "Grok 4, Grok 3, Grok Code",
    color: "text-white",
    bgColor: "bg-white/10",
    keyPrefix: "xai-",
  },
]

function ProviderStatusBadge({
  mode,
  status,
}: {
  mode?: string
  status?: string
}) {
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
        Unverified
      </Badge>
    )
  }

  return <Badge variant="outline">Platform Key</Badge>
}

function ProviderCard({
  provider,
  config,
  isExpanded,
  onToggle,
}: {
  provider: (typeof PROVIDERS)[number]
  config: any
  isExpanded: boolean
  onToggle: () => void
}) {
  const updateConfig = useUpdateProviderConfig()
  const deleteConfig = useDeleteProviderConfig()
  const testConnection = useTestProviderConnection()

  const [mode, setMode] = useState<"platform" | "custom" | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const activeMode = mode ?? config?.mode ?? "platform"
  const hasUnsavedChanges =
    mode !== null || (activeMode === "custom" && apiKey.length > 0)

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      await updateConfig({
        provider: provider.id,
        mode: activeMode,
        apiKey:
          activeMode === "custom" && apiKey.length > 0 ? apiKey : undefined,
      })
      setMode(null)
      setApiKey("")
    } catch (err) {
      console.error("Failed to save:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection({ provider: provider.id })
      setTestResult(result)
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      })
    } finally {
      setTesting(false)
    }
  }

  const handleReset = async () => {
    if (!confirm("Reset to platform key? This will remove your custom API key."))
      return
    setSaving(true)
    try {
      await deleteConfig({ provider: provider.id })
      setMode(null)
      setApiKey("")
      setTestResult(null)
    } catch (err) {
      console.error("Failed to reset:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-background-secondary overflow-hidden">
      <button
        type="button"
        className="w-full cursor-pointer"
        onClick={onToggle}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div
              className={`h-10 w-10 shrink-0 rounded-lg ${provider.bgColor} flex items-center justify-center`}
            >
              <span className={`text-lg font-bold ${provider.color}`}>
                {provider.name[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h3 className="font-medium text-content-primary">
                {provider.name}
              </h3>
              <p className="text-sm text-content-secondary mt-0.5">
                {provider.description}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3">
              <ProviderStatusBadge
                mode={config?.mode}
                status={config?.status}
              />
              <ChevronDown
                className={`h-4 w-4 text-content-tertiary transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>
        </CardContent>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/40 px-5 pb-5 pt-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-content-primary mb-3">
                  Key Source
                </p>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      activeMode === "platform"
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border"
                    }`}
                    onClick={() => {
                      setMode("platform")
                      setApiKey("")
                    }}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        activeMode === "platform"
                          ? "border-primary"
                          : "border-content-tertiary"
                      }`}
                    >
                      {activeMode === "platform" && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-content-primary">
                        Platform Key
                      </p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Use Struere&apos;s shared API key. Usage is included in
                        your plan.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      activeMode === "custom"
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border"
                    }`}
                    onClick={() => setMode("custom")}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        activeMode === "custom"
                          ? "border-primary"
                          : "border-content-tertiary"
                      }`}
                    >
                      {activeMode === "custom" && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-content-primary">
                        Custom Key
                      </p>
                      <p className="text-xs text-content-secondary mt-0.5">
                        Use your own {provider.name} API key. Billed directly to
                        your account.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {activeMode === "custom" && (
                <div className="space-y-2">
                  <Label className="text-content-primary">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder={
                        config?.apiKey || `${provider.keyPrefix}...`
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-background-tertiary pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary cursor-pointer"
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {config?.apiKey && !apiKey && (
                    <p className="text-xs text-content-tertiary">
                      Current key: {config.apiKey}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !hasUnsavedChanges}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>

                {(activeMode === "custom" || config?.mode === "custom") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={testing}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                )}

                {config?.mode === "custom" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={saving}
                    className="text-destructive hover:text-destructive"
                  >
                    Reset to Platform
                  </Button>
                )}
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg border p-3 ${
                    testResult.success
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span
                    className={`text-sm ${testResult.success ? "text-green-500" : "text-destructive"}`}
                  >
                    {testResult.message}
                  </span>
                </div>
              )}

              {config?.lastVerifiedAt && (
                <p className="text-xs text-content-tertiary">
                  Last verified:{" "}
                  {new Date(config.lastVerifiedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function ProvidersPage() {
  const configs = useProviderConfigs()
  const [expandedId, setExpandedId] = useState<ProviderKey | null>(null)

  if (configs === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">
            Providers
          </h1>
          <p className="text-sm text-content-secondary">
            Manage LLM provider API keys for your organization
          </p>
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
        <h1 className="text-xl font-semibold text-content-primary">
          Providers
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          Manage LLM provider API keys for your organization
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            config={configMap.get(provider.id)}
            isExpanded={expandedId === provider.id}
            onToggle={() =>
              setExpandedId(expandedId === provider.id ? null : provider.id)
            }
          />
        ))}
      </div>
    </div>
  )
}
