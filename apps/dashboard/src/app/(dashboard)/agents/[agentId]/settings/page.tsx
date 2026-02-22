"use client"

import { useState } from "react"
import { Settings, Key, Trash2, Loader2, Plus, Copy, Check } from "lucide-react"
import { useAgent, useUpdateAgent, useDeleteAgent, useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { useSettingsTab } from "@/contexts/settings-tab-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Id, Doc } from "@convex/_generated/dataModel"
import { useRouter } from "next/navigation"

interface AgentSettingsPageProps {
  params: { agentId: string }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={copy} className="p-1 rounded hover:bg-background-tertiary transition-colors ease-out-soft">
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-content-tertiary" />}
    </button>
  )
}

function EditAgentTab({ agent, onSave, isSaving }: { agent: Doc<"agents">; onSave: (name: string, description: string) => void; isSaving: boolean }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Edit Agent
        </CardTitle>
        <CardDescription>Update your agent&apos;s basic information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue={agent.name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" defaultValue={agent.slug} className="font-mono" disabled />
            <p className="text-xs text-muted-foreground">Slug cannot be changed after creation</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            defaultValue={agent.description || ""}
            placeholder="Optional description"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => onSave(name || agent.name, description || agent.description || "")} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ApiKeysTab({ environment, apiKeys }: { environment: "production" | "development"; apiKeys: any[] }) {
  const createApiKey = useCreateApiKey()
  const deleteApiKey = useDeleteApiKey()
  const [isCreating, setIsCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const envKeys = apiKeys.filter((k: any) => k.environment === environment)

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setIsCreating(true)
    try {
      const result = await createApiKey({
        name: newKeyName.trim(),
        permissions: ["chat"],
        environment,
      })
      setCreatedKey((result as any).key)
      setNewKeyName("")
      setShowCreateForm(false)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>API keys for the {environment} environment</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreateForm && (
          <div className="flex items-end gap-3 rounded-lg border p-4 bg-background-secondary">
            <div className="flex-1 space-y-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="my-api-key"
              />
            </div>
            <Button onClick={handleCreate} disabled={isCreating || !newKeyName.trim()}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </div>
        )}

        {createdKey && (
          <div className="rounded-lg border border-success/50 bg-success/10 p-4">
            <p className="text-sm font-medium text-success mb-2">Key created. Copy it now — it won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background-tertiary px-3 py-2 text-sm font-mono text-content-primary break-all">
                {createdKey}
              </code>
              <CopyButton text={createdKey} />
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCreatedKey(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {envKeys.length === 0 && !showCreateForm ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Key className="mb-4 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No API keys yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a key to authenticate API requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {envKeys.map((key: any) => (
              <div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{key.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{key.keyPrefix}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(key.permissions || []).map((perm: string) => (
                    <Badge key={perm} variant="secondary" className="text-xs">
                      {perm}
                    </Badge>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    onClick={async () => {
                      if (confirm("Delete this API key?")) {
                        await deleteApiKey({ id: key.id })
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeleteAgentTab({ agent, onDelete, isDeleting }: { agent: Doc<"agents">; onDelete: () => void; isDeleting: boolean }) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Delete Agent
        </CardTitle>
        <CardDescription>
          Permanently delete this agent and all associated data. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
          {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Delete Agent
        </Button>
      </CardContent>
    </Card>
  )
}

export default function AgentSettingsPage({ params }: AgentSettingsPageProps) {
  const { agentId } = params
  const router = useRouter()
  const agent = useAgent(agentId as Id<"agents">)
  const apiKeys = useApiKeys()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()
  const { activeTab } = useSettingsTab()
  const { environment } = useEnvironment()

  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (agent === undefined || apiKeys === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    )
  }

  const handleSave = async (name: string, description: string) => {
    setIsUpdating(true)
    try {
      await updateAgent({ id: agent._id, name, description })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent? This action cannot be undone.")) return
    setIsDeleting(true)
    try {
      await deleteAgent({ id: agent._id })
      router.push("/agents")
    } catch {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-display">Settings</h2>
        <p className="text-muted-foreground">Manage your agent configuration</p>
      </div>

      {activeTab === "edit" && (
        <EditAgentTab agent={agent} onSave={handleSave} isSaving={isUpdating} />
      )}

      {activeTab === "api-keys" && (
        <ApiKeysTab environment={environment} apiKeys={apiKeys as any[]} />
      )}

      {activeTab === "delete" && (
        <DeleteAgentTab agent={agent} onDelete={handleDelete} isDeleting={isDeleting} />
      )}
    </div>
  )
}
