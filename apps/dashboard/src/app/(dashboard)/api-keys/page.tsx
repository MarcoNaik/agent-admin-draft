import { Plus, Copy, Trash2, Key } from "lucide-react"
import { api } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"

export default async function ApiKeysPage() {
  const token = await getAuthToken()

  let apiKeys: Awaited<ReturnType<typeof api.apiKeys.list>>["apiKeys"] = []
  let error: string | null = null

  try {
    const data = await api.apiKeys.list(token!)
    apiKeys = data.apiKeys
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load API keys"
  }

  return (
    <div className="space-y-8">
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
          {error ? (
            <p className="text-content-secondary">{error}</p>
          ) : apiKeys.length === 0 ? (
            <div className="py-8 text-center">
              <Key className="mx-auto h-12 w-12 text-content-tertiary" />
              <h3 className="mt-4 text-lg font-medium text-content-primary">No API keys</h3>
              <p className="mt-1 text-content-secondary">
                Create an API key to start using your agents
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border bg-background-tertiary p-4 hover:border-border-selected"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-content-primary">{key.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {key.keyPrefix}...
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-content-secondary">
                      <span>Created {formatDate(key.createdAt)}</span>
                      {key.lastUsedAt && (
                        <span>Last used {formatDate(key.lastUsedAt)}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {key.permissions.map((perm) => (
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
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-background-primary">
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
