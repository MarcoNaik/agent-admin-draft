"use client"

import { useState } from "react"
import { Settings, Key, Trash2, Loader2 } from "lucide-react"
import { useAgent, useUpdateAgent, useDeleteAgent, useApiKeys } from "@/hooks/use-convex-data"
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

export default function AgentSettingsPage({ params }: AgentSettingsPageProps) {
  const { agentId } = params
  const router = useRouter()
  const agent = useAgent(agentId as Id<"agents">)
  const apiKeys = useApiKeys()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
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

  const handleSave = async () => {
    setIsUpdating(true)
    try {
      await updateAgent({
        id: agent._id,
        name: name || agent.name,
        description: description || agent.description,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      return
    }
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
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Manage your agent configuration</p>
      </div>

      <Card id="edit-agent">
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
              <Input
                id="name"
                defaultValue={agent.name}
                onChange={(e) => setName(e.target.value)}
              />
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
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="api-keys">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>Your organization API keys can be used to access this agent</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="mb-4 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No API keys yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create API keys in the API Keys section to use with this agent
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.slice(0, 5).map((key: Doc<"apiKeys">) => (
                <div key={key._id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{key.keyPrefix}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.permissions.map((perm: string) => (
                      <Badge key={perm} variant="secondary" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="delete" className="border-destructive/50">
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
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Agent
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
