"use client"

import { useState } from "react"
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Loader2 } from "lucide-react"
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Doc } from "@convex/_generated/dataModel"

export default function ApiKeysPage() {
  const apiKeys = useApiKeys()
  const createApiKey = useCreateApiKey()
  const deleteApiKey = useDeleteApiKey()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const result = await createApiKey({ name: newKeyName })
      setNewKey(result.key)
      setNewKeyName("")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key? This cannot be undone.")) return
    await deleteApiKey({ id: id as any })
  }

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (apiKeys === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">API Keys</h1>
          <p className="text-sm text-content-secondary">Manage API keys for external access</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">API Keys</h1>
          <p className="text-sm text-content-secondary">Manage API keys for external access</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{newKey ? "API Key Created" : "Create API Key"}</DialogTitle>
              <DialogDescription>
                {newKey
                  ? "Copy your API key now. You won't be able to see it again."
                  : "Give your API key a name to identify it."}
              </DialogDescription>
            </DialogHeader>
            {newKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
                  <span className="flex-1 truncate">{newKey}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(newKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={() => { setShowCreateDialog(false); setNewKey(null) }}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g., Production API"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="font-input"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!newKeyName.trim() || creating}>
                    {creating ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Your API Keys</CardTitle>
          <CardDescription className="text-content-secondary">
            API keys allow external applications to access your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="py-8 text-center">
              <Key className="mx-auto mb-4 h-10 w-10 text-content-secondary/50" />
              <p className="text-sm text-content-secondary">No API keys yet</p>
              <p className="text-xs text-content-secondary mt-1">
                Create an API key to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key: Doc<"apiKeys">) => (
                <div
                  key={key._id}
                  className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background-tertiary"
                >
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-content-secondary" />
                    <div>
                      <p className="text-sm font-medium text-content-primary">{key.name}</p>
                      <p className="text-xs text-content-secondary font-mono">
                        {key.keyPrefix}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(key._id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
