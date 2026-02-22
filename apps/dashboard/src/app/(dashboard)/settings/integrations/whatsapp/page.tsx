"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, MessageSquare, Wifi, WifiOff, Smartphone, Power, PowerOff, AlertCircle, ExternalLink, Clock, Plus, Pencil, Check, X, RefreshCw, Trash2, FileText } from "lucide-react"
import {
  useWhatsAppConnections,
  useAddPhoneNumber,
  useDisconnectPhoneNumber,
  useRemoveConnection,
  useSetPhoneAgent,
  useUpdatePhoneLabel,
  useAgents,
  useIntegrationConfig,
  useEnableWhatsApp,
  useDisableWhatsApp,
  useListWhatsAppTemplates,
  useCreateWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Id } from "@convex/_generated/dataModel"

type Environment = "development" | "production"

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          Connected
        </Badge>
      )
    case "pending_setup":
      return (
        <Badge className="flex items-center gap-1 bg-amber/20 text-amber border-amber/30">
          <Clock className="h-3 w-3" />
          Awaiting Setup
        </Badge>
      )
    default:
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <WifiOff className="h-3 w-3" />
          Disconnected
        </Badge>
      )
  }
}

function IntegrationToggle({
  isEnabled,
  toggling,
  onEnable,
  onDisable,
}: {
  isEnabled: boolean
  toggling: boolean
  onEnable: () => void
  onDisable: () => void
}) {
  return (
    <Card className="mb-6 bg-background-secondary">
      <CardHeader>
        <CardTitle className="text-base text-content-primary">Integration Status</CardTitle>
        <CardDescription className="text-content-secondary">
          {isEnabled
            ? "WhatsApp integration is enabled for your organization"
            : "Enable the WhatsApp integration to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEnabled ? (
              <>
                <Power className="h-4 w-4 text-success" />
                <Badge variant="secondary">Enabled</Badge>
              </>
            ) : (
              <>
                <PowerOff className="h-4 w-4 text-content-tertiary" />
                <span className="text-sm text-content-secondary">Not enabled</span>
              </>
            )}
          </div>
          {isEnabled ? (
            <Button variant="outline" size="sm" onClick={onDisable} disabled={toggling}>
              {toggling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                "Disable"
              )}
            </Button>
          ) : (
            <Button size="sm" onClick={onEnable} disabled={toggling}>
              {toggling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                "Enable WhatsApp"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TemplateStatusBadge({ status }: { status: string }) {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return <Badge className="bg-success/20 text-success border-success/30">Approved</Badge>
    case "PENDING":
      return <Badge className="bg-amber/20 text-amber border-amber/30">Pending</Badge>
    case "REJECTED":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>
    case "PAUSED":
      return <Badge className="bg-warning/20 text-warning border-warning/30">Paused</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function CreateTemplateDialog({
  connectionId,
  environment,
  onCreated,
}: {
  connectionId: Id<"whatsappConnections">
  environment: Environment
  onCreated: () => void
}) {
  const createTemplate = useCreateWhatsAppTemplate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [language, setLanguage] = useState("en_US")
  const [category, setCategory] = useState("UTILITY")
  const [componentsJson, setComponentsJson] = useState('[\n  {\n    "type": "BODY",\n    "text": "Hello {{1}}",\n    "example": {\n      "body_text": [["World"]]\n    }\n  }\n]')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)
    let components: Array<Record<string, unknown>>
    try {
      components = JSON.parse(componentsJson)
    } catch {
      setError("Invalid JSON in components field")
      return
    }
    if (!Array.isArray(components)) {
      setError("Components must be a JSON array")
      return
    }
    if (!name.trim()) {
      setError("Template name is required")
      return
    }
    setCreating(true)
    try {
      await createTemplate({ environment, connectionId, name: name.trim(), language, category, components })
      setOpen(false)
      setName("")
      setComponentsJson('[\n  {\n    "type": "BODY",\n    "text": "Hello {{1}}",\n    "example": {\n      "body_text": [["World"]]\n    }\n  }\n]')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-3 w-3" />
          Create Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. order_update"
              className="font-input text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en_US"
                className="font-input text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Components (JSON)</Label>
            <Textarea
              value={componentsJson}
              onChange={(e) => setComponentsJson(e.target.value)}
              rows={8}
              className="text-sm font-mono"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TemplatesSection({
  connectionId,
  environment,
}: {
  connectionId: Id<"whatsappConnections">
  environment: Environment
}) {
  const listTemplates = useListWhatsAppTemplates()
  const deleteTemplate = useDeleteWhatsAppTemplate()
  const [templates, setTemplates] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listTemplates({ connectionId, environment }) as { data?: any[] }
      setTemplates(result?.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [listTemplates, connectionId, environment])

  useEffect(() => {
    loadTemplates()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return
    setDeleting(name)
    try {
      await deleteTemplate({ environment, connectionId, name })
      await loadTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-content-tertiary" />
          <span className="text-xs font-medium text-content-secondary">Message Templates</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadTemplates} disabled={loading} className="h-7 px-2">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <CreateTemplateDialog connectionId={connectionId} environment={environment} onCreated={loadTemplates} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {loading && !templates && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
        </div>
      )}

      {templates && templates.length === 0 && (
        <p className="text-xs text-content-tertiary py-2">No templates yet</p>
      )}

      {templates && templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t: any) => (
            <div key={t.id || t.name} className="flex items-center justify-between p-2 rounded-lg bg-background-tertiary">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-content-primary truncate">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-content-tertiary">{t.language}</span>
                    <span className="text-xs text-content-tertiary">{t.category}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TemplateStatusBadge status={t.status} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-content-tertiary hover:text-destructive"
                  onClick={() => handleDelete(t.name)}
                  disabled={deleting === t.name}
                >
                  {deleting === t.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhoneNumberCard({
  connection,
  agents,
  environment,
  onDisconnect,
  onRemove,
  onAgentChange,
  onLabelUpdate,
  onReconnect,
}: {
  connection: any
  agents: any[]
  environment: Environment
  onDisconnect: (connectionId: Id<"whatsappConnections">) => void
  onRemove: (connectionId: Id<"whatsappConnections">) => void
  onAgentChange: (connectionId: Id<"whatsappConnections">, agentId?: string) => void
  onLabelUpdate: (connectionId: Id<"whatsappConnections">, label: string) => void
  onReconnect: (label?: string) => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelValue, setLabelValue] = useState(connection.label ?? "")

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this number?")) return
    setDisconnecting(true)
    try {
      await onDisconnect(connection._id)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleLabelSave = () => {
    onLabelUpdate(connection._id, labelValue.trim())
    setEditingLabel(false)
  }

  return (
    <Card className="bg-background-secondary">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              connection.status === "connected" ? "bg-success/10" : connection.status === "pending_setup" ? "bg-amber/10" : "bg-muted"
            }`}>
              <Smartphone className={`h-5 w-5 ${
                connection.status === "connected" ? "text-success" : connection.status === "pending_setup" ? "text-amber" : "text-content-tertiary"
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {editingLabel ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={labelValue}
                      onChange={(e) => setLabelValue(e.target.value)}
                      className="font-input h-7 w-40 text-sm"
                      placeholder="Label"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLabelSave()
                        if (e.key === "Escape") setEditingLabel(false)
                      }}
                      autoFocus
                    />
                    <button type="button" onClick={handleLabelSave} className="text-success hover:text-success/80">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditingLabel(false)} className="text-content-tertiary hover:text-content-secondary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-content-primary">
                      {connection.label || (connection.phoneNumber ? `+${connection.phoneNumber}` : "New Number")}
                    </p>
                    {connection.status !== "disconnected" && (
                      <button type="button" onClick={() => { setLabelValue(connection.label ?? ""); setEditingLabel(true) }} className="text-content-tertiary hover:text-content-secondary">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
              {connection.label && connection.phoneNumber && (
                <p className="text-xs text-content-tertiary">+{connection.phoneNumber}</p>
              )}
              {connection.lastConnectedAt && connection.status === "connected" && (
                <p className="text-xs text-content-tertiary">
                  Connected since {new Date(connection.lastConnectedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={connection.status} />
        </div>

        {connection.status === "pending_setup" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber/10">
              <Clock className="h-4 w-4 text-amber shrink-0" />
              <p className="text-xs text-content-secondary">
                Complete the Facebook login and phone number verification on Kapso
              </p>
            </div>
            <div className="flex items-center gap-2">
              {connection.setupLinkUrl && (
                <Button size="sm" asChild>
                  <a href={connection.setupLinkUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Complete Setup
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? "Cancelling..." : "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {connection.status === "connected" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-content-secondary">Assigned Agent</label>
              <Select
                value={connection.agentId ?? "none"}
                onValueChange={(value) => onAgentChange(connection._id, value === "none" ? undefined : value)}
              >
                <SelectTrigger className="bg-background-tertiary h-9 text-sm">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No agent (messages stored only)</SelectItem>
                  {agents
                    .filter((a: any) => a.status === "active")
                    .map((agent: any) => (
                      <SelectItem key={agent._id} value={agent._id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <TemplatesSection connectionId={connection._id} environment={environment} />
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        )}

        {connection.status === "disconnected" && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => onReconnect(connection.label)}>
              Reconnect
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              if (!confirm("Remove this connection?")) return
              setDisconnecting(true)
              try { await onRemove(connection._id) } finally { setDisconnecting(false) }
            }} disabled={disconnecting}>
              {disconnecting ? "Removing..." : "Remove"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function WhatsAppSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { environment } = useEnvironment()
  const connections = useWhatsAppConnections(environment)
  const agents = useAgents()
  const addPhoneNumber = useAddPhoneNumber()
  const disconnectPhoneNumber = useDisconnectPhoneNumber()
  const removeConnection = useRemoveConnection()
  const setPhoneAgent = useSetPhoneAgent()
  const updatePhoneLabel = useUpdatePhoneLabel()
  const integrationConfig = useIntegrationConfig("whatsapp", environment)
  const enableWhatsApp = useEnableWhatsApp()
  const disableWhatsApp = useDisableWhatsApp()

  const [toggling, setToggling] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState("")
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [setupSuccess, setSetupSuccess] = useState(false)

  useEffect(() => {
    const status = searchParams.get("status")
    if (status === "completed") {
      setSetupSuccess(true)
      const url = new URL(window.location.href)
      url.searchParams.delete("status")
      url.searchParams.delete("setup_link_id")
      url.searchParams.delete("phone_number_id")
      url.searchParams.delete("business_account_id")
      url.searchParams.delete("provisioned_phone_number_id")
      url.searchParams.delete("display_phone_number")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

  const isEnabled = integrationConfig?.status === "active"
  const hasPendingSetup = connections?.some((c: any) => c.status === "pending_setup")

  const handleEnable = async () => {
    setToggling(true)
    setError(null)
    try {
      await enableWhatsApp({ environment })
    } catch {
      setError("Failed to enable WhatsApp integration")
    } finally {
      setToggling(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm("Are you sure you want to disable the WhatsApp integration?")) return
    setToggling(true)
    setError(null)
    try {
      await disableWhatsApp({ environment })
    } catch {
      setError("Failed to disable WhatsApp integration")
    } finally {
      setToggling(false)
    }
  }

  const handleAddPhone = async () => {
    setAdding(true)
    setError(null)
    try {
      await addPhoneNumber({ environment, label: labelInput.trim() || undefined })
      setLabelInput("")
      setShowLabelInput(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add phone number")
    } finally {
      setAdding(false)
    }
  }

  const handleDisconnect = async (connectionId: Id<"whatsappConnections">) => {
    setError(null)
    try {
      await disconnectPhoneNumber({ connectionId })
    } catch {
      setError("Failed to disconnect phone number")
    }
  }

  const handleRemove = async (connectionId: Id<"whatsappConnections">) => {
    setError(null)
    try {
      await removeConnection({ connectionId })
    } catch {
      setError("Failed to remove connection")
    }
  }

  const handleAgentChange = async (connectionId: Id<"whatsappConnections">, agentId?: string) => {
    setError(null)
    try {
      await setPhoneAgent({
        connectionId,
        agentId: agentId as Id<"agents"> | undefined,
      })
    } catch {
      setError("Failed to update agent assignment")
    }
  }

  const handleReconnect = async (label?: string) => {
    setError(null)
    try {
      await addPhoneNumber({ environment, label: label || undefined })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconnect phone number")
    }
  }

  const handleLabelUpdate = async (connectionId: Id<"whatsappConnections">, label: string) => {
    setError(null)
    try {
      await updatePhoneLabel({ connectionId, label })
    } catch {
      setError("Failed to update label")
    }
  }

  if (integrationConfig === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  const activeConnections = (connections ?? []).filter((c: any) => c.status !== "disconnected")
  const disconnectedConnections = (connections ?? []).filter((c: any) => c.status === "disconnected")

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
        <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-success" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-semibold text-content-primary">WhatsApp</h1>
            {isEnabled && activeConnections.length > 0 && (
              <Badge variant="secondary">{activeConnections.filter((c: any) => c.status === "connected").length} connected</Badge>
            )}
          </div>
          <p className="text-content-secondary mt-1">
            Connect WhatsApp Business numbers via Kapso to enable AI-powered conversations
          </p>
        </div>
      </div>

      {setupSuccess && (
        <div className="flex items-center justify-between gap-2 p-3 mb-6 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-success shrink-0" />
            <p className="text-sm text-success">WhatsApp setup completed. Your number is being connected.</p>
          </div>
          <button type="button" onClick={() => setSetupSuccess(false)} className="text-success hover:text-success/80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <IntegrationToggle
        isEnabled={isEnabled}
        toggling={toggling}
        onEnable={handleEnable}
        onDisable={handleDisable}
      />

      {isEnabled ? (
        <>
          <Card className="mb-6 bg-background-secondary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-content-primary">Phone Numbers</CardTitle>
                  <CardDescription className="text-content-secondary">
                    Manage your WhatsApp Business numbers
                  </CardDescription>
                </div>
                {!showLabelInput && (
                  <Button
                    size="sm"
                    onClick={() => setShowLabelInput(true)}
                    disabled={adding || !!hasPendingSetup}
                    title={hasPendingSetup ? "Complete the pending setup first" : undefined}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Add Number
                  </Button>
                )}
              </div>
            </CardHeader>
            {showLabelInput && (
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-background-tertiary">
                  <Input
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="Label (e.g. Sales, Support)"
                    className="font-input flex-1 text-sm h-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPhone()
                      if (e.key === "Escape") { setShowLabelInput(false); setLabelInput("") }
                    }}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddPhone} disabled={adding}>
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Up"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowLabelInput(false); setLabelInput("") }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {activeConnections.length === 0 && !showLabelInput && (
            <Card className="mb-6 bg-background-secondary">
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 text-content-tertiary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-content-primary">No phone numbers connected</p>
                    <p className="text-xs text-content-tertiary mt-1">
                      Add a WhatsApp Business number to start receiving messages
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {activeConnections.map((connection: any) => (
              <PhoneNumberCard
                key={connection._id}
                connection={connection}
                agents={agents ?? []}
                environment={environment}
                onDisconnect={handleDisconnect}
                onRemove={handleRemove}
                onAgentChange={handleAgentChange}
                onLabelUpdate={handleLabelUpdate}
                onReconnect={handleReconnect}
              />
            ))}
          </div>

          {disconnectedConnections.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-content-tertiary mb-3">Disconnected</p>
              <div className="space-y-3">
                {disconnectedConnections.map((connection: any) => (
                  <PhoneNumberCard
                    key={connection._id}
                    connection={connection}
                    agents={agents ?? []}
                    environment={environment}
                    onDisconnect={handleDisconnect}
                    onRemove={handleRemove}
                    onAgentChange={handleAgentChange}
                    onLabelUpdate={handleLabelUpdate}
                    onReconnect={handleReconnect}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card className="mb-6 bg-background-secondary">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <PowerOff className="h-8 w-8 text-content-tertiary" />
              <p className="text-sm text-content-secondary">
                Enable the WhatsApp integration to configure your connection
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
