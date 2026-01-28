import { Settings, Key, Variable, Trash2, Copy, Plus, Eye, EyeOff } from "lucide-react"
import { api, Agent, DeployKey, EnvironmentVariable } from "@/lib/api"
import { getAuthToken } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface AgentSettingsPageProps {
  params: Promise<{ agentId: string }>
}

export default async function AgentSettingsPage({ params }: AgentSettingsPageProps) {
  const { agentId } = await params
  const token = await getAuthToken()

  let agent: Agent | null = null
  let deployKeys: DeployKey[] = []
  let envVars: EnvironmentVariable[] = []
  let error: string | null = null

  try {
    const [agentData, deployKeysData, envVarsData] = await Promise.all([
      api.agents.get(token!, agentId),
      api.deployKeys.list(token!, agentId).catch(() => ({ deployKeys: [] })),
      api.envVars.list(token!, agentId).catch(() => ({ envVars: [] })),
    ])
    agent = agentData.agent
    deployKeys = deployKeysData.deployKeys
    envVars = envVarsData.envVars
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load settings"
  }

  if (error || !agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{error || "Agent not found"}</p>
      </div>
    )
  }

  const productionKeys = deployKeys.filter((k) => k.environment === "production")
  const developmentKeys = deployKeys.filter((k) => k.environment === "development")
  const productionEnvVars = envVars.filter((v) => v.environment === "production")
  const developmentEnvVars = envVars.filter((v) => v.environment === "development")

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
              <Input id="name" defaultValue={agent.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" defaultValue={agent.slug} className="font-mono" disabled />
              <p className="text-xs text-muted-foreground">Slug cannot be changed after creation</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" defaultValue={agent.description || ""} placeholder="Optional description" />
          </div>
          <div className="flex justify-end">
            <Button>Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card id="deploy-keys-production">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Production Deploy Keys
              </CardTitle>
              <CardDescription>Keys for deploying to production environment</CardDescription>
            </div>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {productionKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="mb-4 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No production deploy keys yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productionKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{key.keyPrefix}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Production</Badge>
                    <Button variant="ghost" size="icon">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="deploy-keys-development">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Development Deploy Keys
              </CardTitle>
              <CardDescription>Keys for deploying to development environment</CardDescription>
            </div>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {developmentKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="mb-4 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No development deploy keys yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {developmentKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{key.keyPrefix}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Development</Badge>
                    <Button variant="ghost" size="icon">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="env-vars">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Variable className="h-5 w-5" />
                Environment Variables
              </CardTitle>
              <CardDescription>Configure environment-specific variables</CardDescription>
            </div>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Variable
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-3 text-sm font-medium">Production</h4>
            {productionEnvVars.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">No production environment variables</p>
              </div>
            ) : (
              <div className="space-y-2">
                {productionEnvVars.map((envVar) => (
                  <div key={envVar.id} className="flex items-center gap-2 rounded-lg border p-3">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <Input value={envVar.key} className="font-mono" readOnly />
                      <div className="flex gap-2">
                        <Input type="password" value={envVar.value} className="font-mono" readOnly />
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Separator />
          <div>
            <h4 className="mb-3 text-sm font-medium">Development</h4>
            {developmentEnvVars.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">No development environment variables</p>
              </div>
            ) : (
              <div className="space-y-2">
                {developmentEnvVars.map((envVar) => (
                  <div key={envVar.id} className="flex items-center gap-2 rounded-lg border p-3">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <Input value={envVar.key} className="font-mono" readOnly />
                      <div className="flex gap-2">
                        <Input type="password" value={envVar.value} className="font-mono" readOnly />
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <Button variant="destructive">Delete Agent</Button>
        </CardContent>
      </Card>
    </div>
  )
}
