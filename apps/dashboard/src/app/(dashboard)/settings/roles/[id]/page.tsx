"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Shield,
  Loader2,
  User,
  Lock,
  EyeOff,
  Filter,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Minus,
  Layers,
  ShieldCheck,
  ShieldX,
} from "lucide-react"
import { useRoleWithPolicies, useRoleAssignedUsers } from "@/hooks/use-convex-data"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
type AssignedUser = {
  _id: Id<"userRoles">
  userId: Id<"users">
  userName: string | undefined
  userEmail: string
  createdAt: number
  expiresAt: number | undefined
}

const ALL_ACTIONS = ["create", "read", "update", "delete", "list"] as const

type CellState =
  | "allow"
  | "deny"
  | "wildcard-allow"
  | "wildcard-deny"
  | undefined

function MatrixCell({ state }: { state: CellState }) {
  if (state === "allow" || state === "wildcard-allow") {
    const isWildcard = state === "wildcard-allow"
    return (
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          isWildcard
            ? "bg-success/8 text-success/60 border border-success/15"
            : "bg-success/12 text-success"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </div>
    )
  }

  if (state === "deny" || state === "wildcard-deny") {
    const isWildcard = state === "wildcard-deny"
    return (
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          isWildcard
            ? "bg-destructive/8 text-destructive/60 border border-destructive/15"
            : "bg-destructive/12 text-destructive"
        }`}
      >
        <X className="h-3.5 w-3.5" />
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background-tertiary/30">
      <Minus className="h-3 w-3 text-content-tertiary/30" />
    </div>
  )
}

function tooltipLabel(resource: string, action: string, state: CellState): string {
  if (state === "allow") return `${resource}.${action}: Explicitly allowed`
  if (state === "wildcard-allow") return `${resource}.${action}: Allowed via wildcard (*)`
  if (state === "deny") return `${resource}.${action}: Explicitly denied`
  if (state === "wildcard-deny") return `${resource}.${action}: Denied via wildcard (*)`
  return `${resource}.${action}: No policy (denied by default)`
}

function PermissionMatrix({
  policiesByResource,
}: {
  policiesByResource: Record<string, PolicyWithRules[]>
}) {
  const resources = Object.keys(policiesByResource)

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-content-tertiary">
        <Lock className="h-7 w-7 mb-3 opacity-40" />
        <p className="text-sm">No policies defined</p>
      </div>
    )
  }

  const matrixData = useMemo(() => {
    const data: Record<string, Record<string, CellState>> = {}
    for (const resource of resources) {
      const actionMap: Record<string, CellState> = {}
      const policies = policiesByResource[resource]

      for (const policy of policies) {
        if (policy.action === "*") {
          for (const a of ALL_ACTIONS) {
            if (!actionMap[a]) {
              actionMap[a] =
                policy.effect === "allow" ? "wildcard-allow" : "wildcard-deny"
            }
          }
        } else {
          actionMap[policy.action] = policy.effect as "allow" | "deny"
        }
      }

      for (const policy of policies) {
        if (policy.effect === "deny") {
          if (policy.action === "*") {
            for (const a of ALL_ACTIONS) {
              actionMap[a] = "wildcard-deny"
            }
          } else {
            actionMap[policy.action] = "deny"
          }
        }
      }

      data[resource] = actionMap
    }
    return data
  }, [policiesByResource])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20">
              <th className="pb-3 pr-6 text-left text-[11px] font-medium uppercase tracking-widest text-content-tertiary">
                Resource
              </th>
              {ALL_ACTIONS.map((action) => (
                <th
                  key={action}
                  className="pb-3 px-2 text-center text-[11px] font-medium uppercase tracking-widest text-content-tertiary"
                >
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {resources.map((resource) => {
              const actionMap = matrixData[resource]

              return (
                <tr
                  key={resource}
                  className="group transition-colors hover:bg-background-tertiary/20"
                >
                  <td className="py-3 pr-6">
                    <span className="font-mono text-[13px] font-medium text-content-primary">
                      {resource}
                    </span>
                  </td>
                  {ALL_ACTIONS.map((action) => {
                    const state = actionMap[action]
                    return (
                      <td key={action} className="py-3 px-2">
                        <div className="flex justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-default">
                                <MatrixCell state={state} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">
                                {tooltipLabel(resource, action, state)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border/10">
          <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary">
            <div className="flex h-4 w-4 items-center justify-center rounded bg-success/12 text-success">
              <Check className="h-2.5 w-2.5" />
            </div>
            <span>Allow</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary">
            <div className="flex h-4 w-4 items-center justify-center rounded bg-destructive/12 text-destructive">
              <X className="h-2.5 w-2.5" />
            </div>
            <span>Deny</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary">
            <div className="flex h-4 w-4 items-center justify-center rounded bg-background-tertiary/30">
              <Minus className="h-2 w-2 text-content-tertiary/30" />
            </div>
            <span>No policy</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-content-tertiary">
            <div className="flex h-4 w-4 items-center justify-center rounded border border-success/15 bg-success/8 text-success/60">
              <Check className="h-2.5 w-2.5" />
            </div>
            <span>Wildcard</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function ScopeRuleExpression({ rule }: { rule: ScopeRule & { resource: string } }) {
  return (
    <div className="rounded-lg border border-border/20 bg-background-tertiary/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-warning/20 text-warning font-normal"
          >
            {rule.resource}
          </Badge>
          <span className="text-[10px] uppercase tracking-widest text-content-tertiary font-medium">
            {rule.type ?? "field_match"}
          </span>
        </div>
        <Filter className="h-3 w-3 text-warning/50" />
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-0 font-mono text-[13px] leading-relaxed">
          <span className="text-primary">{rule.field}</span>
          <span className="mx-2 rounded bg-background-tertiary px-1.5 py-0.5 text-[11px] text-content-tertiary font-semibold">
            {rule.operator}
          </span>
          <span className="text-success">{rule.value}</span>
        </div>
      </div>
    </div>
  )
}

function FieldMaskRow({ mask }: { mask: FieldMask & { resource: string } }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/20 bg-background-tertiary/30 px-4 py-3 transition-colors hover:bg-background-tertiary/50">
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 border-primary/20 text-primary font-normal"
        >
          {mask.resource}
        </Badge>
        <code className="font-mono text-[13px] text-content-primary">
          {mask.fieldPath}
        </code>
      </div>
      <div className="flex items-center gap-2">
        {mask.maskConfig && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-content-tertiary cursor-default">
                  config
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <pre className="font-mono text-xs">
                  {JSON.stringify(mask.maskConfig, null, 2)}
                </pre>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Badge
          variant={mask.maskType === "hide" ? "destructive" : "secondary"}
          className="text-[10px] px-2 py-0 font-normal"
        >
          {mask.maskType}
        </Badge>
      </div>
    </div>
  )
}

function AssignedUsersPanel({ users }: { users: AssignedUser[] }) {
  const [expanded, setExpanded] = useState(users.length <= 5)

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-content-tertiary">
        <User className="h-6 w-6 mb-2 opacity-40" />
        <p className="text-sm">No users assigned</p>
      </div>
    )
  }

  const displayed = expanded ? users : users.slice(0, 5)

  return (
    <div className="space-y-2">
      {displayed.map((assignment) => (
        <div
          key={assignment._id}
          className="flex items-center justify-between rounded-lg border border-border/20 bg-background-tertiary/30 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-content-primary">
                {assignment.userName || "Unnamed User"}
              </p>
              <p className="text-xs text-content-tertiary">
                {assignment.userEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {assignment.expiresAt && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal text-warning border-warning/20"
              >
                expires {new Date(assignment.expiresAt).toLocaleDateString()}
              </Badge>
            )}
            <span className="text-[11px] text-content-tertiary tabular-nums">
              {new Date(assignment.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
      {!expanded && users.length > 5 && (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-border/20 bg-background-tertiary/20 py-2 text-xs text-content-tertiary transition-colors hover:text-content-secondary hover:bg-background-tertiary/40 cursor-pointer"
        >
          <ChevronDown className="h-3 w-3" />
          <span>Show {users.length - 5} more</span>
        </button>
      )}
    </div>
  )
}

function PermissionPipelineStat({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: typeof Lock
  label: string
  count: number
  color: string
}) {
  const colorClasses: Record<string, string> = {
    default: "bg-background-tertiary text-content-secondary",
    warning: "bg-warning/8 text-warning",
    primary: "bg-primary/8 text-primary",
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 ${colorClasses[color] || colorClasses.default}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{count}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  )
}

export default function RoleDetailPage() {
  const params = useParams()
  const roleId = params.id as Id<"roles">
  const role = useRoleWithPolicies(roleId) as
    | RoleWithPolicies
    | null
    | undefined
  const assignedUsers = useRoleAssignedUsers(roleId) as
    | AssignedUser[]
    | undefined

  if (role === undefined || assignedUsers === undefined) {
    return (
      <div className="space-y-6">
        <Link
          href="/settings/roles"
          className="inline-flex items-center gap-1.5 text-sm text-content-tertiary hover:text-content-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Roles
        </Link>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
        </div>
      </div>
    )
  }

  if (role === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/settings/roles"
          className="inline-flex items-center gap-1.5 text-sm text-content-tertiary hover:text-content-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Roles
        </Link>
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="h-8 w-8 text-content-tertiary/30 mb-3" />
          <p className="text-sm text-content-secondary">Role not found</p>
        </div>
      </div>
    )
  }

  const policies: PolicyWithRules[] = role.policies
  const policiesByResource: Record<string, PolicyWithRules[]> = {}
  for (const policy of policies) {
    if (!policiesByResource[policy.resource])
      policiesByResource[policy.resource] = []
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

  const resourceCount = Object.keys(policiesByResource).length
  const allowCount = policies.filter((p) => p.effect === "allow").length
  const denyCount = policies.filter((p) => p.effect === "deny").length

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <Link
          href="/settings/roles"
          className="inline-flex items-center gap-1.5 text-xs text-content-tertiary hover:text-content-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Roles
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                role.isSystem
                  ? "bg-warning/10 text-warning"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold text-content-primary">
                  {role.name}
                </h1>
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
                <p className="text-sm text-content-secondary mt-0.5">
                  {role.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PermissionPipelineStat
            icon={Lock}
            label={`polic${policies.length !== 1 ? "ies" : "y"}`}
            count={policies.length}
            color="default"
          />
          {allScopeRules.length > 0 && (
            <>
              <ChevronRight className="h-3 w-3 text-content-tertiary/40" />
              <PermissionPipelineStat
                icon={Filter}
                label="scope rules"
                count={allScopeRules.length}
                color="warning"
              />
            </>
          )}
          {allFieldMasks.length > 0 && (
            <>
              <ChevronRight className="h-3 w-3 text-content-tertiary/40" />
              <PermissionPipelineStat
                icon={EyeOff}
                label="field masks"
                count={allFieldMasks.length}
                color="primary"
              />
            </>
          )}
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="matrix" className="space-y-5">
        <TabsList className="bg-background-secondary/80 h-9">
          <TabsTrigger value="matrix" className="text-xs gap-1.5 px-3">
            <Layers className="h-3.5 w-3.5" />
            Permission Matrix
          </TabsTrigger>
          {allScopeRules.length > 0 && (
            <TabsTrigger value="scopes" className="text-xs gap-1.5 px-3">
              <Filter className="h-3.5 w-3.5" />
              Scope Rules
              <Badge
                variant="secondary"
                className="ml-1 text-[9px] px-1 py-0 h-4 min-w-[16px] flex items-center justify-center"
              >
                {allScopeRules.length}
              </Badge>
            </TabsTrigger>
          )}
          {allFieldMasks.length > 0 && (
            <TabsTrigger value="masks" className="text-xs gap-1.5 px-3">
              <EyeOff className="h-3.5 w-3.5" />
              Field Masks
              <Badge
                variant="secondary"
                className="ml-1 text-[9px] px-1 py-0 h-4 min-w-[16px] flex items-center justify-center"
              >
                {allFieldMasks.length}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="users" className="text-xs gap-1.5 px-3">
            <User className="h-3.5 w-3.5" />
            Users
            <Badge
              variant="secondary"
              className="ml-1 text-[9px] px-1 py-0 h-4 min-w-[16px] flex items-center justify-center"
            >
              {assignedUsers.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-content-secondary" />
              <h2 className="text-sm font-medium text-content-primary">
                Access Control Grid
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-content-tertiary">
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-success" />
                <span>{allowCount} allow</span>
              </div>
              <div className="flex items-center gap-1">
                <ShieldX className="h-3 w-3 text-destructive" />
                <span>{denyCount} deny</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <span>
                {resourceCount} resource{resourceCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-border/20 bg-background-secondary/50 p-5">
            <PermissionMatrix policiesByResource={policiesByResource} />
          </div>
        </TabsContent>

        <TabsContent value="scopes" className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-medium text-content-primary">
              Row-Level Security
            </h2>
            <span className="text-xs text-content-tertiary">
              Filters applied to queries for this role
            </span>
          </div>
          <div className="space-y-3">
            {allScopeRules.map((rule) => (
              <ScopeRuleExpression key={rule._id} rule={rule} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="masks" className="space-y-4">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium text-content-primary">
              Column-Level Visibility
            </h2>
            <span className="text-xs text-content-tertiary">
              Fields hidden or redacted for this role
            </span>
          </div>
          <div className="space-y-2">
            {allFieldMasks.map((mask) => (
              <FieldMaskRow key={mask._id} mask={mask} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-content-secondary" />
            <h2 className="text-sm font-medium text-content-primary">
              Assigned Users
            </h2>
            <span className="text-xs text-content-tertiary">
              {assignedUsers.length} user
              {assignedUsers.length !== 1 ? "s" : ""} with this role
            </span>
          </div>
          <AssignedUsersPanel users={assignedUsers} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
