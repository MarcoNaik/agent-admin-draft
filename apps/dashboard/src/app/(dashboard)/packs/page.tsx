"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Check, Loader2, AlertCircle } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.struere.dev"

const AVAILABLE_PACKS = [
  {
    id: "tutoring",
    name: "Tutoring Operations",
    description: "Complete tutoring business management with students, teachers, sessions, payments, and entitlements",
    entityTypes: ["student", "guardian", "teacher", "session", "payment", "entitlement"],
    roles: ["admin", "teacher", "guardian"]
  }
]

export default function PacksPage() {
  const { getToken } = useAuth()
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const installPack = async (packId: string) => {
    setInstalling(packId)
    setError(null)
    setResult(null)

    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/v1/packs/install`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ packId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to install pack")
      }

      setInstalled([...installed, packId])
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setInstalling(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solution Packs</h1>
        <p className="text-muted-foreground">Install pre-configured business solutions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {AVAILABLE_PACKS.map((pack) => (
          <Card key={pack.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <CardTitle>{pack.name}</CardTitle>
                </div>
                {installed.includes(pack.id) && (
                  <span className="flex items-center gap-1 text-sm text-green-500">
                    <Check className="h-4 w-4" /> Installed
                  </span>
                )}
              </div>
              <CardDescription>{pack.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Entity Types:</p>
                <div className="flex flex-wrap gap-1">
                  {pack.entityTypes.map((type) => (
                    <span key={type} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Roles:</p>
                <div className="flex flex-wrap gap-1">
                  {pack.roles.map((role) => (
                    <span key={role} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => installPack(pack.id)}
                disabled={installing === pack.id || installed.includes(pack.id)}
                className="w-full"
              >
                {installing === pack.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : installed.includes(pack.id) ? (
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

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Installation Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-secondary rounded text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
