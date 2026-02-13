"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Shield,
  Loader2,
  Terminal,
  ChevronRight,
  Lock,
  Filter,
  EyeOff,
  Users,
  Search,
  ShieldCheck,
  ShieldX,
} from "lucide-react"
import { useRoles, useRoleWithPolicies, useRoleAssignedUsers } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Doc, Id } from "@convex/_generated/dataModel"

type ScopeRule = Doc<"scopeRules">
type FieldMask = Doc<"fieldMasks">
type PolicyWithRules = Doc<"policies"> & {
  scopeRules: ScopeRule[]
  fieldMasks: FieldMask[]
}
type RoleWithPolicies = Doc<"roles"> & { policies: PolicyWithRules[] }

function RoleSummaryStats({ roleId }: { roleId: Id<"roles"> }) {
  const role = useRoleWithPolicies(roleId) as RoleWithPolicies | null | undefined
  const assignedUsers = useRoleAssignedUsers(roleId)

  if (role === undefined) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-background-tertiary" />
        <div className="h-4 w-14 animate-pulse rounded bg-background-tertiary" />
        <div className="h-4 w-14 animate-pulse rounded bg-background-tertiary" />
      </div>
    )
  }

  if (!role) return null

  const policies: PolicyWithRules[] = role.policies
  const resources = new Set(policies.map((p: PolicyWithRules) => p.resource))
  const denyCount = policies.filter(
    (p: PolicyWithRules) => p.effect === "deny"
  ).length
  const allowCount = policies.filter(
    (p: PolicyWithRules) => p.effect === "allow"
  ).length
  const scopeCount = policies.reduce(
    (acc: number, p: PolicyWithRules) => acc + p.scopeRules.length,
    0
  )
  const maskCount = policies.reduce(
    (acc: number, p: PolicyWithRules) => acc + p.fieldMasks.length,
    0
  )
  const userCount = assignedUsers?.length ?? 0

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-4 text-xs text-content-tertiary">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-default">
              <Lock className="h-3 w-3" />
              <span>
                {resources.size} resource{resources.size !== 1 ? "s" : ""}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-mono text-xs">
              {Array.from(resources).join(", ") || "none"}
            </p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-3" />

        <div className="flex items-center gap-3">
          {allowCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-success cursor-default">
                  <ShieldCheck className="h-3 w-3" />
                  <span>{allowCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>
                  {allowCount} allow polic{allowCount !== 1 ? "ies" : "y"}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          {denyCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-destructive cursor-default">
                  <ShieldX className="h-3 w-3" />
                  <span>{denyCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>
                  {denyCount} deny polic{denyCount !== 1 ? "ies" : "y"}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {(scopeCount > 0 || maskCount > 0) && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <div className="flex items-center gap-3">
              {scopeCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-warning cursor-default">
                      <Filter className="h-3 w-3" />
                      <span>{scopeCount}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {scopeCount} scope rule{scopeCount !== 1 ? "s" : ""} (row-level
                      security)
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
              {maskCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-primary cursor-default">
                      <EyeOff className="h-3 w-3" />
                      <span>{maskCount}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {maskCount} field mask{maskCount !== 1 ? "s" : ""} (column-level
                      security)
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-3" />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-default">
              <Users className="h-3 w-3" />
              <span>{userCount}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>
              {userCount} assigned user{userCount !== 1 ? "s" : ""}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

function ResourcePreview({ roleId }: { roleId: Id<"roles"> }) {
  const role = useRoleWithPolicies(roleId) as RoleWithPolicies | null | undefined

  if (!role) return null

  const resourceMap = new Map<string, { allow: string[]; deny: string[] }>()

  for (const policy of role.policies) {
    if (!resourceMap.has(policy.resource)) {
      resourceMap.set(policy.resource, { allow: [], deny: [] })
    }
    const entry = resourceMap.get(policy.resource)!
    if (policy.effect === "allow") {
      entry.allow.push(policy.action)
    } else {
      entry.deny.push(policy.action)
    }
  }

  if (resourceMap.size === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/20">
      {Array.from(resourceMap.entries())
        .slice(0, 4)
        .map(([resource, actions]) => (
          <div
            key={resource}
            className="flex items-center gap-1 rounded bg-background-tertiary/70 px-2 py-0.5"
          >
            <span className="font-mono text-[11px] text-content-secondary">
              {resource}
            </span>
            {actions.deny.length > 0 && (
              <span className="text-[10px] text-destructive/70">
                -{actions.deny.length}
              </span>
            )}
          </div>
        ))}
      {resourceMap.size > 4 && (
        <div className="flex items-center rounded bg-background-tertiary/70 px-2 py-0.5">
          <span className="text-[11px] text-content-tertiary">
            +{resourceMap.size - 4} more
          </span>
        </div>
      )}
    </div>
  )
}

function RoleCard({ role }: { role: Doc<"roles"> }) {
  return (
    <Link
      href={`/settings/roles/${role._id}`}
      className="group relative block rounded-lg border border-border/40 bg-background-secondary/50 transition-all duration-200 hover:border-border/80 hover:bg-background-secondary cursor-pointer"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-200 ${
                role.isSystem
                  ? "bg-warning/10 text-warning"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-content-primary">
                  {role.name}
                </span>
                {role.isSystem && (
                  <Badge
                    variant="warning"
                    className="text-[10px] px-1.5 py-0 font-normal"
                  >
                    system
                  </Badge>
                )}
              </div>
              {role.description && (
                <p className="text-xs text-content-tertiary mt-0.5 line-clamp-1 max-w-[280px]">
                  {role.description}
                </p>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-content-tertiary opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
        </div>

        <div className="mt-4">
          <RoleSummaryStats roleId={role._id} />
        </div>

        <ResourcePreview roleId={role._id} />
      </div>
    </Link>
  )
}

function StatsBar({ roles }: { roles: Doc<"roles">[] }) {
  const systemCount = roles.filter((r) => r.isSystem).length
  const customCount = roles.filter((r) => !r.isSystem).length

  return (
    <div className="flex items-center gap-6 text-xs text-content-tertiary">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-primary/50" />
        <span>
          {roles.length} total
        </span>
      </div>
      {systemCount > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-warning/50" />
          <span>{systemCount} system</span>
        </div>
      )}
      {customCount > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-content-tertiary/50" />
          <span>{customCount} custom</span>
        </div>
      )}
    </div>
  )
}

export default function RolesPage() {
  const { environment } = useEnvironment()
  const roles = useRoles(environment)
  const [search, setSearch] = useState("")

  if (roles === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Roles</h1>
          <p className="text-sm text-content-secondary mt-1">
            Permission roles and access policies
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
        </div>
      </div>
    )
  }

  const filtered = roles.filter(
    (r: Doc<"roles">) =>
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  )

  const systemRoles = filtered.filter((r: Doc<"roles">) => r.isSystem)
  const customRoles = filtered.filter((r: Doc<"roles">) => !r.isSystem)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Roles</h1>
          <p className="text-sm text-content-secondary mt-1">
            Permission roles and access policies
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-normal text-content-tertiary"
        >
          {environment}
        </Badge>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-border/20 bg-background-secondary/30 px-3 py-2 text-xs text-content-tertiary">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-content-tertiary" />
        <span>
          Roles are managed via{" "}
          <code className="mx-0.5 rounded bg-background-tertiary px-1.5 py-0.5 text-[11px] font-mono text-content-secondary">
            defineRole()
          </code>{" "}
          in your project and synced with{" "}
          <code className="mx-0.5 rounded bg-background-tertiary px-1.5 py-0.5 text-[11px] font-mono text-content-secondary">
            struere dev
          </code>
        </span>
      </div>

      {roles.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-tertiary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter roles..."
              className="h-8 bg-background-secondary/50 border-border/30 pl-9 text-xs placeholder:text-content-tertiary"
            />
          </div>
          <StatsBar roles={roles} />
        </div>
      )}

      {roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/30 py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-secondary mb-4">
            <Shield className="h-6 w-6 text-content-tertiary" />
          </div>
          <p className="text-sm font-medium text-content-secondary">
            No roles defined
          </p>
          <p className="text-xs text-content-tertiary mt-1.5 max-w-[240px] text-center">
            Define roles in your project using the CLI to manage access control
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-content-tertiary">
            No roles matching &quot;{search}&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {systemRoles.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[11px] font-medium uppercase tracking-widest text-content-tertiary">
                  System Roles
                </h2>
                <Separator className="flex-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {systemRoles.map((role: Doc<"roles">) => (
                  <RoleCard key={role._id} role={role} />
                ))}
              </div>
            </section>
          )}

          {customRoles.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[11px] font-medium uppercase tracking-widest text-content-tertiary">
                  Custom Roles
                </h2>
                <Separator className="flex-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {customRoles.map((role: Doc<"roles">) => (
                  <RoleCard key={role._id} role={role} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
