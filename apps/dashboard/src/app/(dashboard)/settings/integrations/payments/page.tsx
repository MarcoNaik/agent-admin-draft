"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle, XCircle, Loader2, CreditCard, AlertTriangle } from "lucide-react"
import {
  useIntegrationConfig,
  useUpdateIntegrationConfig,
  useTestIntegrationConnection,
  useDeleteIntegrationConfig,
} from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function PaymentsSettingsPage() {
  const router = useRouter()
  const config = useIntegrationConfig("flow")
  const updateConfig = useUpdateIntegrationConfig()
  const testConnection = useTestIntegrationConnection()
  const deleteConfig = useDeleteIntegrationConfig()

  const [form, setForm] = useState({
    apiUrl: "",
    apiKey: "",
    secretKey: "",
    webhookBaseUrl: "",
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (config) {
      setForm({
        apiUrl: config.config?.apiUrl || "https://www.flow.cl/api",
        apiKey: "",
        secretKey: "",
        webhookBaseUrl: config.config?.webhookBaseUrl || "",
      })
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      const configData: Record<string, string> = {
        apiUrl: form.apiUrl,
        webhookBaseUrl: form.webhookBaseUrl,
      }
      if (form.apiKey) {
        configData.apiKey = form.apiKey
      }
      if (form.secretKey) {
        configData.secretKey = form.secretKey
      }
      await updateConfig({
        provider: "flow",
        config: configData,
      })
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
      const result = await testConnection({ provider: "flow" })
      setTestResult(result)
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      })
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this integration?")) return
    setDeleting(true)
    try {
      await deleteConfig({ provider: "flow" })
      router.push("/settings/integrations")
    } catch (err) {
      console.error("Failed to delete:", err)
    } finally {
      setDeleting(false)
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
        <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-content-primary">Flow Payment</h1>
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
            Accept payments from parents and guardians via Flow
          </p>
        </div>
      </div>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">API Configuration</CardTitle>
          <CardDescription className="text-content-secondary">
            Enter your Flow payment gateway credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl" className="text-content-primary">API URL</Label>
            <Input
              id="apiUrl"
              value={form.apiUrl}
              onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
              placeholder="https://www.flow.cl/api"
              className="bg-background-tertiary"
            />
            <p className="text-xs text-content-tertiary">
              Use https://sandbox.flow.cl/api for testing
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-content-primary">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={config ? "Enter new key to update (leave blank to keep existing)" : "Enter your API key"}
              className="bg-background-tertiary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretKey" className="text-content-primary">Secret Key</Label>
            <Input
              id="secretKey"
              type="password"
              value={form.secretKey}
              onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
              placeholder={config ? "Enter new key to update (leave blank to keep existing)" : "Enter your secret key"}
              className="bg-background-tertiary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookBaseUrl" className="text-content-primary">Webhook Base URL</Label>
            <Input
              id="webhookBaseUrl"
              value={form.webhookBaseUrl}
              onChange={(e) => setForm({ ...form, webhookBaseUrl: e.target.value })}
              placeholder="https://your-domain.com"
              className="bg-background-tertiary"
            />
            <p className="text-xs text-content-tertiary">
              The base URL where Flow will send payment notifications
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving || !form.apiUrl}>
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !config}>
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                testResult.success
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Webhook Endpoints</CardTitle>
          <CardDescription className="text-content-secondary">
            Configure these URLs in your Flow dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-content-primary">Payment Confirmation URL</Label>
            <div className="flex gap-2">
              <Input
                value={form.webhookBaseUrl ? `${form.webhookBaseUrl}/webhook/flow/confirm` : "Configure webhook base URL first"}
                readOnly
                className="bg-background-tertiary font-mono text-sm"
              />
              <Button
                variant="outline"
                disabled={!form.webhookBaseUrl}
                onClick={() => navigator.clipboard.writeText(`${form.webhookBaseUrl}/webhook/flow/confirm`)}
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-content-primary">Return URL</Label>
            <div className="flex gap-2">
              <Input
                value={form.webhookBaseUrl ? `${form.webhookBaseUrl}/webhook/flow/return` : "Configure webhook base URL first"}
                readOnly
                className="bg-background-tertiary font-mono text-sm"
              />
              <Button
                variant="outline"
                disabled={!form.webhookBaseUrl}
                onClick={() => navigator.clipboard.writeText(`${form.webhookBaseUrl}/webhook/flow/return`)}
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-600">
              Make sure to whitelist these URLs in your Flow dashboard for payment notifications to work correctly.
            </p>
          </div>
        </CardContent>
      </Card>

      {config && (
        <Card className="border-destructive bg-background-secondary">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription className="text-content-secondary">
              Remove this integration from your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing..." : "Remove Integration"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
