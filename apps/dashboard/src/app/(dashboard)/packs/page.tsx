"use client"

import { useState } from "react"
import { usePacks, useInstallPack } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, Check, Loader2, AlertCircle } from "lucide-react"

interface EntityTypeDefinition {
  name: string
  slug: string
  description: string
  schema: object
  searchFields?: string[]
  displayConfig?: object
}

interface RoleDefinition {
  name: string
  description: string
  isSystem: boolean
  policies: Array<{
    resource: string
    actions: string[]
    effect: "allow" | "deny"
    priority: number
  }>
}

interface PackDefinition {
  id: string
  name: string
  version: string
  description: string
  entityTypes: EntityTypeDefinition[]
  roles: RoleDefinition[]
  isInstalled: boolean
  installedAt?: number
}

export default function PacksPage() {
  const packs = usePacks()
  const installPack = useInstallPack()
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInstall = async (packId: string) => {
    setInstalling(packId)
    setError(null)
    try {
      await installPack({ packId })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Installation failed")
    } finally {
      setInstalling(null)
    }
  }

  if (packs === undefined) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center p-6 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Solution Packs</h1>
        <p className="text-muted-foreground">Install pre-configured business solutions</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(packs as PackDefinition[]).map((pack: PackDefinition) => (
          <Card key={pack.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <CardTitle>{pack.name}</CardTitle>
                </div>
                {pack.isInstalled && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <Check className="h-3 w-3" /> Installed
                  </Badge>
                )}
              </div>
              <CardDescription>{pack.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Entity Types:</p>
                <div className="flex flex-wrap gap-1">
                  {pack.entityTypes.map((et: EntityTypeDefinition) => (
                    <Badge key={et.slug} variant="secondary">
                      {et.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Roles:</p>
                <div className="flex flex-wrap gap-1">
                  {pack.roles.map((role: RoleDefinition) => (
                    <Badge key={role.name} variant="outline">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => handleInstall(pack.id)}
                disabled={installing === pack.id || pack.isInstalled}
                className="w-full"
              >
                {installing === pack.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : pack.isInstalled ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Installed
                  </>
                ) : (
                  "Install Pack"
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
