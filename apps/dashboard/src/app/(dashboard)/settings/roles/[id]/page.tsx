"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Shield, Loader2, User, Lock, EyeOff, Filter } from "lucide-react"
import { useRoleWithPolicies, useRoleAssignedUsers } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Doc, Id } from "@convex/_generated/dataModel"

type ScopeRule = Doc<"scopeRules">
type FieldMask = Doc<"fieldMasks">
type PolicyWithRules = Doc<"policies"> & { scopeRules: ScopeRule[]; fieldMasks: FieldMask[] }
type RoleWithPolicies = Doc<"roles"> & { policies: PolicyWithRules[] }
type AssignedUser = { _id: Id<"userRoles">; userId: Id<"users">; userName: string | undefined; userEmail: string; createdAt: number; expiresAt: number | undefined }

export default function RoleDetailPage() {
  const params = useParams()
  const roleId = params.id as Id<"roles">
  const role = useRoleWithPolicies(roleId) as RoleWithPolicies | null | undefined
  const assignedUsers = useRoleAssignedUsers(roleId) as AssignedUser[] | undefined

  if (role === undefined || assignedUsers === undefined) {
    return (
      <div className="space-y-6">
        <Link href="/settings/roles" className="inline-flex items-center gap-1 text-sm text-content-secondary hover:text-content-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Roles
        </Link>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (role === null) {
    return (
      <div className="space-y-6">
        <Link href="/settings/roles" className="inline-flex items-center gap-1 text-sm text-content-secondary hover:text-content-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Roles
        </Link>
        <div className="py-12 text-center">
          <Shield className="mx-auto mb-4 h-10 w-10 text-content-secondary/50" />
          <p className="text-sm text-content-secondary">Role not found</p>
        </div>
      </div>
    )
  }

  const policies: PolicyWithRules[] = role.policies
  const policiesByResource: Record<string, PolicyWithRules[]> = {}
  for (const policy of policies) {
    if (!policiesByResource[policy.resource]) policiesByResource[policy.resource] = []
    policiesByResource[policy.resource].push(policy)
  }

  const allScopeRules: (ScopeRule & { resource: string })[] = []
  for (const p of policies) {
    for (const sr of p.scopeRules) {
      allScopeRules.push({ ...sr, resource: p.resource })
    }
  }

  const allFieldMasks: (FieldMask & { resource: string })[] = []
  for (const p of policies) {
    for (const fm of p.fieldMasks) {
      allFieldMasks.push({ ...fm, resource: p.resource })
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/settings/roles" className="inline-flex items-center gap-1 text-sm text-content-secondary hover:text-content-primary transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Roles
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-content-primary">{role.name}</h1>
          {role.isSystem && (
            <Badge variant="outline">system</Badge>
          )}
        </div>
        {role.description && (
          <p className="text-sm text-content-secondary mt-1">{role.description}</p>
        )}
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-content-primary">
            <Lock className="h-4 w-4" />
            Policies
          </CardTitle>
          <CardDescription className="text-content-secondary">
            {role.policies.length} polic{role.policies.length !== 1 ? "ies" : "y"} grouped by resource
          </CardDescription>
        </CardHeader>
        <CardContent>
          {role.policies.length === 0 ? (
            <p className="text-sm text-content-secondary py-4 text-center">No policies defined</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(policiesByResource).map(([resource, policies]) => (
                <div key={resource} className="border border-border/50 rounded-lg bg-background-tertiary p-3">
                  <div className="text-sm font-medium text-content-primary mb-2">{resource}</div>
                  <div className="space-y-1.5">
                    {policies.map((policy) => (
                      <div key={policy._id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={policy.effect === "allow" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {policy.effect}
                          </Badge>
                          <span className="text-content-secondary font-mono text-xs">{policy.action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {allScopeRules.length > 0 && (
        <Card className="bg-background-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-content-primary">
              <Filter className="h-4 w-4" />
              Scope Rules
            </CardTitle>
            <CardDescription className="text-content-secondary">
              Row-level security filters applied to queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allScopeRules.map((rule) => (
                <div
                  key={rule._id}
                  className="flex items-center gap-3 p-3 border border-border/50 rounded-lg bg-background-tertiary text-sm"
                >
                  <Badge variant="outline" className="text-xs shrink-0">{rule.resource}</Badge>
                  <code className="text-xs text-content-primary font-mono">
                    {rule.field} {rule.operator} {rule.value}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {allFieldMasks.length > 0 && (
        <Card className="bg-background-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-content-primary">
              <EyeOff className="h-4 w-4" />
              Field Masks
            </CardTitle>
            <CardDescription className="text-content-secondary">
              Column-level security controlling field visibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allFieldMasks.map((mask) => (
                <div
                  key={mask._id}
                  className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background-tertiary text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs shrink-0">{mask.resource}</Badge>
                    <code className="text-xs text-content-primary font-mono">{mask.fieldPath}</code>
                  </div>
                  <Badge
                    variant={mask.maskType === "hide" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {mask.maskType}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-content-primary">
            <User className="h-4 w-4" />
            Assigned Users
          </CardTitle>
          <CardDescription className="text-content-secondary">
            {assignedUsers.length} user{assignedUsers.length !== 1 ? "s" : ""} with this role
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedUsers.length === 0 ? (
            <p className="text-sm text-content-secondary py-4 text-center">No users assigned to this role</p>
          ) : (
            <div className="space-y-2">
              {assignedUsers.map((assignment) => (
                <div
                  key={assignment._id}
                  className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background-tertiary"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-content-primary">{assignment.userName || "Unnamed User"}</p>
                      <p className="text-xs text-content-secondary">{assignment.userEmail}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Assigned {new Date(assignment.createdAt).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
