"use client"

import { Plus, Copy, Trash2, Key, Loader2 } from "lucide-react"
import { useApiKeys, useDeleteApiKey } from "@/hooks/use-convex-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { Doc } from "@convex/_generated/dataModel"

export default function ApiKeysPage() {
  const apiKeys = useApiKeys()
  const deleteApiKey = useDeleteApiKey()

  if (apiKeys === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold text-content-primary">API Keys</h1>
            <p className="text-content-secondary">Manage access to your agents</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">API Keys</h1>
          <p className="text-content-secondary">Manage access to your agents</p>
        </div>
        <Button className="bg-util-accent hover:bg-util-accent/80 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Create Key
        </Button>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Your API Keys</CardTitle>
          <CardDescription className="text-content-secondary">
            Use these keys to authenticate requests to your agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="py-8 text-center">
              <Key className="mx-auto h-12 w-12 text-content-tertiary" />
              <h3 className="mt-4 text-lg font-medium text-content-primary">No API keys</h3>
              <p className="mt-1 text-content-secondary">
                Create an API key to start using your agents
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key: Doc<"apiKeys">) => (
                <div
                  key={key._id}
                  className="flex items-center justify-between rounded-lg border bg-background-tertiary p-4 hover:border-border-selected transition-colors ease-out-soft"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-content-primary">{key.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {key.keyPrefix}...
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-content-secondary">
                      <span>Created {formatDate(new Date(key.createdAt).toISOString())}</span>
                      {key.lastUsedAt && (
                        <span>Last used {formatDate(new Date(key.lastUsedAt).toISOString())}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {key.permissions.map((perm: string) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="hover:bg-background-primary">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-background-primary"
                      onClick={() => deleteApiKey({ id: key._id })}
                    >
                      <Trash2 className="h-4 w-4" />
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
