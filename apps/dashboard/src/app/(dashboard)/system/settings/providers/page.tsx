"use client"

import { useState } from "react"
import {
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Pencil,
  Search,
  X,
} from "@/lib/icons"
import {
  useProviderConfigs,
  useUpdateProviderConfig,
  useDeleteProviderConfig,
  useTestProviderConnection,
} from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ProviderKey = "anthropic" | "openai" | "google" | "xai" | "openrouter"

const PROVIDERS: {
  id: ProviderKey
  name: string
  keyPrefix: string
  icon: () => React.ReactNode
}[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    keyPrefix: "sk-ant-",
    icon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
      </svg>
    ),
  },
  {
    id: "openai",
    name: "OpenAI",
    keyPrefix: "sk-",
    icon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    ),
  },
  {
    id: "google",
    name: "Google AI",
    keyPrefix: "AI",
    icon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" fill="url(#gemini-gradient)" />
        <defs>
          <linearGradient id="gemini-gradient" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="50%" stopColor="#9B72CB" />
            <stop offset="100%" stopColor="#D96570" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "xai",
    name: "xAI",
    keyPrefix: "xai-",
    icon: () => (
      <svg viewBox="0 0 841.89 595.28" className="h-5 w-5" fill="currentColor">
        <path d="m557.09 211.99 8.31 326.37h66.56l8.32-445.18zM640.28 56.91H538.72L379.35 284.53l50.78 72.52zM201.61 538.36h101.56l50.79-72.52-50.79-72.53zM201.61 211.99l228.52 326.37h101.56L303.17 211.99z" />
      </svg>
    ),
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    keyPrefix: "sk-or-",
    icon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z" />
      </svg>
    ),
  },
]

function ProviderRow({
  provider,
  config,
  isEditing,
  onEdit,
  onClose,
}: {
  provider: (typeof PROVIDERS)[number]
  config: any
  isEditing: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const updateConfig = useUpdateProviderConfig()
  const deleteConfig = useDeleteProviderConfig()
  const testConnection = useTestProviderConnection()

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const hasKey = !!config?.apiKey
  const status = config?.status

  const handleSave = async () => {
    if (!apiKey.length) return
    setSaving(true)
    setTestResult(null)
    try {
      await updateConfig({
        provider: provider.id,
        apiKey,
      })
      setApiKey("")
      setShowKey(false)
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

  const handleDelete = async () => {
    setSaving(true)
    try {
      await deleteConfig({ provider: provider.id })
      setApiKey("")
      setTestResult(null)
      onClose()
    } catch (err) {
      console.error("Failed to delete:", err)
    } finally {
      setSaving(false)
    }
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary/50 transition-colors group">
        <div className="h-8 w-8 shrink-0 rounded-lg bg-background-tertiary flex items-center justify-center text-content-secondary">
          {provider.icon()}
        </div>
        <span className="flex-1 text-sm font-medium text-content-primary">
          {provider.name}
        </span>
        <span className="text-sm text-content-tertiary">
          {status === "active" ? (
            <span className="text-success flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected
            </span>
          ) : status === "error" ? (
            <span className="text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              Error
            </span>
          ) : status === "inactive" ? (
            <span className="text-amber flex items-center gap-1.5">
              Unverified
            </span>
          ) : (
            "Not configured"
          )}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-background-tertiary transition-colors cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-background-tertiary/30 border-y border-border/40">
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-background-tertiary flex items-center justify-center text-content-secondary">
            {provider.icon()}
          </div>
          <span className="flex-1 text-sm font-medium text-content-primary">
            {provider.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-content-tertiary hover:text-content-primary hover:bg-background-tertiary transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3 pl-11">
          <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={config?.apiKey || `${provider.keyPrefix}...`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-background-secondary pr-10 font-mono text-sm h-9"
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary cursor-pointer"
              >
                {showKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </form>

          {config?.apiKey && !apiKey && (
            <p className="text-xs text-content-tertiary">
              Current key: {config.apiKey}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSave}
              disabled={saving || !apiKey.length}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>

            {hasKey && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Test"
                )}
              </Button>
            )}

            {hasKey && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={saving}
              >
                Remove
              </Button>
            )}

            <div className="flex-1" />

            {config?.lastVerifiedAt && (
              <span className="text-[11px] text-content-tertiary">
                Verified {new Date(config.lastVerifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                testResult.success
                  ? "border-success/30 bg-success/5 text-success"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProvidersPage() {
  const configs = useProviderConfigs()
  const [editingId, setEditingId] = useState<ProviderKey | null>(null)
  const [search, setSearch] = useState("")

  if (configs === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">
            Providers
          </h1>
          <p className="text-sm text-content-secondary">
            Use your own provider API keys
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

  const filtered = PROVIDERS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">
            Providers
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Use your own provider API keys
          </p>
        </div>
        <form role="search" onSubmit={(e) => e.preventDefault()} autoComplete="off">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary pointer-events-none" />
            <input
              type="search"
              role="searchbox"
              placeholder="Search providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-full text-sm bg-background-secondary rounded-md border border-border px-3 py-1 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40">
        {filtered.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            config={configMap.get(provider.id)}
            isEditing={editingId === provider.id}
            onEdit={() => setEditingId(provider.id)}
            onClose={() => setEditingId(null)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-content-tertiary">
            No providers match your search
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-content-primary">
          Key Priority and Fallback
        </h2>
        <p className="text-sm text-content-secondary">
          Struere prioritizes using your provider keys when available.
        </p>
        <p className="text-sm text-content-secondary">
          If no direct key is configured, requests fall back to your OpenRouter key. If neither is available, Struere uses platform credits via OpenRouter.
        </p>
      </div>
    </div>
  )
}
