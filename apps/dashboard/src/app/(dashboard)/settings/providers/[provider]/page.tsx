"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react"
import {
  useProviderConfig,
  useUpdateProviderConfig,
  useDeleteProviderConfig,
  useTestProviderConnection,
} from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type ProviderKey = "anthropic" | "openai" | "google"

const PROVIDER_META: Record<ProviderKey, {
  name: string
  color: string
  bgColor: string
  keyPrefix: string
}> = {
  anthropic: {
    name: "Anthropic",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    keyPrefix: "sk-ant-",
  },
  openai: {
    name: "OpenAI",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    keyPrefix: "sk-",
  },
  google: {
    name: "Google AI",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    keyPrefix: "AI",
  },
}

export default function ProviderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const providerId = params.provider as ProviderKey

  const meta = PROVIDER_META[providerId]
  const config = useProviderConfig(providerId)
  const updateConfig = useUpdateProviderConfig()
  const deleteConfig = useDeleteProviderConfig()
  const testConnection = useTestProviderConnection()

  const [mode, setMode] = useState<"platform" | "custom" | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const activeMode = mode ?? config?.mode ?? "platform"
  const hasUnsavedChanges = mode !== null || (activeMode === "custom" && apiKey.length > 0)

  if (!meta) {
    router.push("/settings/providers")
    return null
  }

  if (config === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      await updateConfig({
        provider: providerId,
        mode: activeMode,
        apiKey: activeMode === "custom" && apiKey.length > 0 ? apiKey : undefined,
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
      const result = await testConnection({ provider: providerId })
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Test failed" })
    } finally {
      setTesting(false)
    }
  }

  const handleReset = async () => {
    if (!confirm("Reset to platform key? This will remove your custom API key.")) return
    setSaving(true)
    try {
      await deleteConfig({ provider: providerId })
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
    <div className="mx-auto max-w-3xl p-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/settings/providers")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Providers
      </Button>

      <div className="flex items-start gap-4 mb-6">
        <div className={`h-12 w-12 rounded-lg ${meta.bgColor} flex items-center justify-center`}>
          <span className={`text-xl font-bold ${meta.color}`}>{meta.name[0]}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-content-primary">{meta.name}</h1>
            {config && (
              <Badge variant={config.status === "active" ? "secondary" : config.status === "error" ? "destructive" : "outline"}>
                {config.mode === "custom" ? "Custom Key" : "Platform Key"}
              </Badge>
            )}
          </div>
          <p className="text-content-secondary mt-1">
            Configure API key settings for {meta.name}
          </p>
        </div>
      </div>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Key Source</CardTitle>
          <CardDescription className="text-content-secondary">
            Choose whether to use the shared platform key or your own API key
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                activeMode === "platform"
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              }`}
              onClick={() => { setMode("platform"); setApiKey("") }}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                activeMode === "platform" ? "border-primary" : "border-content-tertiary"
              }`}>
                {activeMode === "platform" && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">Platform Key</p>
                <p className="text-xs text-content-secondary mt-0.5">
                  Use Struere&apos;s shared API key. Usage is included in your plan.
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
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                activeMode === "custom" ? "border-primary" : "border-content-tertiary"
              }`}>
                {activeMode === "custom" && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">Custom Key</p>
                <p className="text-xs text-content-secondary mt-0.5">
                  Use your own {meta.name} API key. Billed directly to your account.
                </p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {activeMode === "custom" && (
        <Card className="mb-6 bg-background-secondary">
          <CardHeader>
            <CardTitle className="text-base text-content-primary">API Key</CardTitle>
            <CardDescription className="text-content-secondary">
              Enter your {meta.name} API key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-content-primary">API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={config?.apiKey || `${meta.keyPrefix}...`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-background-tertiary pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {config?.apiKey && !apiKey && (
                <p className="text-xs text-content-tertiary">
                  Current key: {config.apiKey}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Button onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>

        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>

        {config && config.mode === "custom" && (
          <Button variant="outline" onClick={handleReset} disabled={saving} className="text-destructive hover:text-destructive">
            Reset to Platform
          </Button>
        )}
      </div>

      {testResult && (
        <Card className={`mb-6 ${testResult.success ? "border-green-500/30" : "border-destructive/30"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={`text-sm ${testResult.success ? "text-green-500" : "text-destructive"}`}>
                {testResult.message}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {config?.lastVerifiedAt && (
        <p className="text-xs text-content-tertiary mt-4">
          Last verified: {new Date(config.lastVerifiedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
