"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, Loader2, CheckCircle, XCircle } from "lucide-react"
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

export default function ResendSettingsPage() {
  const router = useRouter()
  const { environment } = useEnvironment()
  const config = useIntegrationConfig("resend", environment)
  const updateConfig = useUpdateIntegrationConfig()
  const testConnection = useTestIntegrationConnection()
  const deleteConfig = useDeleteIntegrationConfig()

  const [fromEmail, setFromEmail] = useState("")
  const [fromName, setFromName] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const configData: Record<string, string> = {}
      if (fromEmail) configData.fromEmail = fromEmail
      if (fromName) configData.fromName = fromName
      if (replyTo) configData.replyTo = replyTo
      await updateConfig({ provider: "resend", environment, config: configData })
      setFromEmail("")
      setFromName("")
      setReplyTo("")
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
      const result = await testConnection({ provider: "resend", environment })
      setMessage({ type: result.success ? "success" : "error", text: result.message })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test failed" })
    } finally {
      setTesting(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm("Remove Resend integration? This will delete your saved configuration.")) return
    setRemoving(true)
    setMessage(null)
    try {
      await deleteConfig({ provider: "resend", environment })
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
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-semibold text-content-primary">Resend</h1>
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
            Send transactional emails from your agents via Resend
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
            Customize the sender identity for outbound emails. The API key is managed by the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">From Email</Label>
            <Input
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder={
                config?.config?.fromEmail
                  ? String(config.config.fromEmail)
                  : "noreply@mail.struere.dev"
              }
              className="font-input text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">From Name</Label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder={
                config?.config?.fromName
                  ? String(config.config.fromName)
                  : "Your Organization"
              }
              className="font-input text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reply-To</Label>
            <Input
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder={
                config?.config?.replyTo
                  ? String(config.config.replyTo)
                  : "support@yourdomain.com"
              }
              className="font-input text-sm"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>
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
