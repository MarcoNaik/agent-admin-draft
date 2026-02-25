"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Database, Loader2, CheckCircle, XCircle } from "lucide-react"
import {
  useIntegrationConfig,
  useUpdateIntegrationConfig,
  useTestIntegrationConnection,
  useDeleteIntegrationConfig,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AirtableSettingsPage() {
  const router = useRouter()
  const { environment } = useEnvironment()
  const config = useIntegrationConfig("airtable", environment)
  const updateConfig = useUpdateIntegrationConfig()
  const testConnection = useTestIntegrationConnection()
  const deleteConfig = useDeleteIntegrationConfig()

  const [pat, setPat] = useState("")
  const [defaultBaseId, setDefaultBaseId] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSave = async () => {
    if (!pat && !config) return
    setSaving(true)
    setMessage(null)
    try {
      const configData: Record<string, string> = {}
      if (pat) configData.personalAccessToken = pat
      if (defaultBaseId) configData.defaultBaseId = defaultBaseId
      await updateConfig({ provider: "airtable", environment, config: configData })
      setPat("")
      setMessage({ type: "success", text: "Configuration saved" })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setMessage(null)
    try {
      const result = await testConnection({ provider: "airtable", environment })
      setMessage({ type: result.success ? "success" : "error", text: result.message })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test failed" })
    } finally {
      setTesting(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm("Remove Airtable integration? This will delete your saved configuration.")) return
    setRemoving(true)
    setMessage(null)
    try {
      await deleteConfig({ provider: "airtable", environment })
      setMessage({ type: "success", text: "Integration removed" })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to remove" })
    } finally {
      setRemoving(false)
    }
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

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/settings/integrations")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Button>

      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-semibold text-content-primary">Airtable</h1>
            {config?.status === "active" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Connected
              </Badge>
            )}
            {config?.status === "error" && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Error
              </Badge>
            )}
          </div>
          <p className="text-content-secondary mt-1">
            Connect your Airtable bases to read and write records via agent tools
          </p>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 mb-6 rounded-lg border ${
          message.type === "success"
            ? "bg-success/10 border-success/20"
            : "bg-destructive/10 border-destructive/20"
        }`}>
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 text-success shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <p className={`text-sm ${message.type === "success" ? "text-success" : "text-destructive"}`}>
            {message.text}
          </p>
        </div>
      )}

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Configuration</CardTitle>
          <CardDescription className="text-content-secondary">
            Enter your Airtable Personal Access Token to connect
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Personal Access Token</Label>
            <Input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder={config ? "••••••••••••••••" : "pat..."}
              className="font-input text-sm"
            />
            <p className="text-xs text-content-tertiary">
              Create a token at airtable.com/create/tokens with the scopes you need
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Default Base ID (optional)</Label>
            <Input
              value={defaultBaseId}
              onChange={(e) => setDefaultBaseId(e.target.value)}
              placeholder={
                config?.config?.defaultBaseId
                  ? String(config.config.defaultBaseId)
                  : "appXXXXXXXXXXXXXX"
              }
              className="font-input text-sm"
            />
            <p className="text-xs text-content-tertiary">
              If set, agents can use this as the default base for Airtable operations
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving || (!pat && !config)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            {config && (
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
            )}
            {config && (
              <Button variant="destructive" onClick={handleRemove} disabled={removing}>
                {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
