"use client"

import Link from "next/link"
import { Shield, Loader2, Info, Terminal } from "lucide-react"
import { useRoles } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Doc } from "@convex/_generated/dataModel"

export default function RolesPage() {
  const { environment } = useEnvironment()
  const roles = useRoles(environment)

  if (roles === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Roles</h1>
          <p className="text-sm text-content-secondary">View permission roles and their policies</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Roles</h1>
        <p className="text-sm text-content-secondary">View permission roles and their policies</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Terminal className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-content-secondary">
          Roles are managed via the CLI using <code className="px-1 py-0.5 rounded bg-background-tertiary text-content-primary text-xs">defineRole()</code> and synced with <code className="px-1 py-0.5 rounded bg-background-tertiary text-content-primary text-xs">struere dev</code>.
        </div>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">All Roles</CardTitle>
          <CardDescription className="text-content-secondary">
            {roles.length} role{roles.length !== 1 ? "s" : ""} in {environment}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="py-8 text-center">
              <Shield className="mx-auto mb-4 h-10 w-10 text-content-secondary/50" />
              <p className="text-sm text-content-secondary">No roles defined</p>
              <p className="text-xs text-content-secondary mt-1">
                Use the CLI to define roles for this environment
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((role: Doc<"roles">) => (
                <Link
                  key={role._id}
                  href={`/settings/roles/${role._id}`}
                  className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background-tertiary hover:bg-background-tertiary/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-content-secondary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-content-primary">{role.name}</span>
                        {role.isSystem && (
                          <Badge variant="outline" className="text-xs">system</Badge>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-xs text-content-secondary mt-0.5">{role.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {new Date(role.createdAt).toLocaleDateString()}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
