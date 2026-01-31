"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle, XCircle, Loader2, MessageSquare, AlertTriangle } from "lucide-react"
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

export default function WhatsAppSettingsPage() {
  const router = useRouter()
  const config = useIntegrationConfig("whatsapp")
  const updateConfig = useUpdateIntegrationConfig()
  const testConnection = useTestIntegrationConnection()
  const deleteConfig = useDeleteIntegrationConfig()

  const [form, setForm] = useState({
    phoneNumberId: "",
    accessToken: "",
    businessAccountId: "",
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (config) {
      setForm({
        phoneNumberId: config.config?.phoneNumberId || "",
        accessToken: "",
        businessAccountId: config.config?.businessAccountId || "",
      })
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      const configData: Record<string, string> = {
        phoneNumberId: form.phoneNumberId,
        businessAccountId: form.businessAccountId,
      }
      if (form.accessToken) {
        configData.accessToken = form.accessToken
      }
      await updateConfig({
        provider: "whatsapp",
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
      const result = await testConnection({ provider: "whatsapp" })
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
      await deleteConfig({ provider: "whatsapp" })
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
        <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-green-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-content-primary">WhatsApp Business</h1>
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
            Connect your WhatsApp Business account to send notifications
          </p>
        </div>
      </div>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Configuration</CardTitle>
          <CardDescription className="text-content-secondary">
            Enter your WhatsApp Business API credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumberId" className="text-content-primary">Phone Number ID</Label>
            <Input
              id="phoneNumberId"
              value={form.phoneNumberId}
              onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              placeholder="Enter your WhatsApp Business Phone Number ID"
              className="bg-background-tertiary"
            />
            <p className="text-xs text-content-tertiary">
              Found in your WhatsApp Business Platform dashboard
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessToken" className="text-content-primary">Access Token</Label>
            <Input
              id="accessToken"
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder={config ? "Enter new token to update (leave blank to keep existing)" : "Enter your access token"}
              className="bg-background-tertiary"
            />
            <p className="text-xs text-content-tertiary">
              Your permanent access token from Meta for Developers
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAccountId" className="text-content-primary">Business Account ID</Label>
            <Input
              id="businessAccountId"
              value={form.businessAccountId}
              onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })}
              placeholder="Enter your WhatsApp Business Account ID"
              className="bg-background-tertiary"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving || !form.phoneNumberId}>
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
          <CardTitle className="text-base text-content-primary">Webhook Configuration</CardTitle>
          <CardDescription className="text-content-secondary">
            Configure webhook settings in your Meta for Developers dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-content-primary">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value="https://your-domain.com/webhook/whatsapp"
                readOnly
                className="bg-background-tertiary font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText("https://your-domain.com/webhook/whatsapp")}
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-600">
              Make sure to configure the webhook URL in your Meta for Developers dashboard and subscribe to the required webhook fields.
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
