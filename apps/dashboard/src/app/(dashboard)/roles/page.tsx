"use client"

import { useState, useMemo } from "react"
import {
  Shield,
  Loader2,
  Terminal,
  Search,
  Lock,
  Filter,
  EyeOff,
  Users,
  User,
  ShieldCheck,
  ShieldX,
  Check,
  X,
  Minus,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import {
  useRoles,
  useRoleWithPolicies,
  useRoleAssignedUsers,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { AdminOnly } from "@/components/role-redirect"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
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

function humanizeField(field: string): string {
  const cleaned = field.replace(/^data\./, "")
  return cleaned
    .replace(/([A-Z])/g, " $1")
    .replace(/[._]/g, " ")
    .trim()
    .toLowerCase()
}

function pluralize(word: string): string {
  if (word.endsWith("s")) return word
  if (word.endsWith("y")) return word.slice(0, -1) + "ies"
  return word + "s"
}

function sortActions(actions: string[]): string[] {
  return [...actions].sort(
    (a, b) =>
      ALL_ACTIONS.indexOf(a as (typeof ALL_ACTIONS)[number]) -
      ALL_ACTIONS.indexOf(b as (typeof ALL_ACTIONS)[number])
  )
}

function BoldActions({ actions }: { actions: string[] }) {
  const sorted = sortActions(actions)
  if (sorted.length === 1) {
    return <><span className="font-medium text-content-primary">{sorted[0]}</span></>
  }
  const last = sorted[sorted.length - 1]
  const rest = sorted.slice(0, -1)
  return (
    <>
      {rest.map((a, i) => (
        <span key={a}>
          <span className="font-medium text-content-primary">{a}</span>
          {i < rest.length - 1 ? ", " : ""}
        </span>
      ))}
      {", and "}
      <span className="font-medium text-content-primary">{last}</span>
    </>
  )
}

function ScopeRuleDescription({
  resource,
  field,
  operator,
  value,
  actions,
  effect,
}: {
  resource: string
  field: string
  operator: string
  value: string
  actions: string[]
  effect: "allow" | "deny"
}) {
  const isAll = actions.includes("*") || actions.length >= 5
  const res = pluralize(resource)

  const opLabel: Record<string, string> = {
    eq: "matches",
    neq: "does not match",
    contains: "contains",
    in: "is one of",
    gt: "is greater than",
    lt: "is less than",
    gte: "is at least",
    lte: "is at most",
  }
  const opText = opLabel[operator] ?? operator

  let valueText = value
  if (value === "actor.entityId") valueText = "their linked entity"
  else if (value === "actor.userId") valueText = "them"
  else if (value.startsWith("actor."))
    valueText = "their " + humanizeField(value.replace("actor.", ""))

  const fieldName = humanizeField(field)

  let suffix: React.ReactNode
  if (field === "_id" && operator === "eq" && value === "actor.entityId") {
    suffix = <>{res} that represent their own profile</>
  } else if (field === "_id" && operator === "eq" && value === "actor.userId") {
    suffix = <>their own {resource} record</>
  } else if (operator === "eq" && value === "actor.entityId") {
    suffix = <>{res} where {fieldName} matches their linked entity</>
  } else if (operator === "eq" && value === "actor.userId") {
    suffix = <>{res} assigned to them</>
  } else {
    suffix = <>{res} where {fieldName} {opText} {valueText}</>
  }

  if (effect === "allow") {
    if (isAll) {
      return <>
        <span className="font-medium text-content-primary">Full access</span> to {suffix}
      </>
    }
    return <>Can <BoldActions actions={actions} /> {suffix}</>
  }

  if (isAll) {
    return <>
      <span className="font-medium text-content-primary">No access</span> to {suffix}
    </>
  }
  return <>Cannot <BoldActions actions={actions} /> {suffix}</>
}

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
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          isWildcard
            ? "bg-success/8 text-success/60 border border-success/15"
            : "bg-success/12 text-success"
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </div>
    )
  }

  if (state === "deny" || state === "wildcard-deny") {
    const isWildcard = state === "wildcard-deny"
    return (
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          isWildcard
            ? "bg-destructive/8 text-destructive/60 border border-destructive/15"
            : "bg-destructive/12 text-destructive"
        )}
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

function tooltipLabel(
  resource: string,
  action: string,
  state: CellState
): string {
  if (state === "allow") return `${resource}.${action}: Explicitly allowed`
  if (state === "wildcard-allow")
    return `${resource}.${action}: Allowed via wildcard (*)`
  if (state === "deny") return `${resource}.${action}: Explicitly denied`
  if (state === "wildcard-deny")
    return `${resource}.${action}: Denied via wildcard (*)`
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

function ScopeRulesGrouped({
  rules,
}: {
  rules: (ScopeRule & {
    resource: string
    allowActions: string[]
    denyActions: string[]
  })[]
}) {
  const grouped = new Map<
    string,
    (ScopeRule & {
      resource: string
      allowActions: string[]
      denyActions: string[]
    })[]
  >()
  for (const rule of rules) {
    if (!grouped.has(rule.resource)) grouped.set(rule.resource, [])
    grouped.get(rule.resource)!.push(rule)
  }

  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([resource, resourceRules]) => (
        <div
          key={resource}
          className="rounded-lg border border-border/20 bg-background-tertiary/20 overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-border/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-content-primary">
                {resource}
              </span>
              <span className="text-[11px] text-content-tertiary">
                {resourceRules.length} rule
                {resourceRules.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Filter className="h-3 w-3 text-content-tertiary/40" />
          </div>
          <div className="divide-y divide-border/10">
            {resourceRules.map((rule, i) => (
              <div
                key={`${rule.field}-${rule.operator}-${rule.value}-${i}`}
                className="px-4 py-3 space-y-1"
              >
                {rule.allowActions.length > 0 && (
                  <div className="text-[13px] text-content-secondary leading-relaxed">
                    <ScopeRuleDescription
                      resource={rule.resource}
                      field={rule.field}
                      operator={rule.operator}
                      value={rule.value}
                      actions={rule.allowActions}
                      effect="allow"
                    />
                  </div>
                )}
                {rule.denyActions.length > 0 && (
                  <div className="text-[13px] text-content-tertiary leading-relaxed">
                    <ScopeRuleDescription
                      resource={rule.resource}
                      field={rule.field}
                      operator={rule.operator}
                      value={rule.value}
                      actions={rule.denyActions}
                      effect="deny"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldMasksGrouped({
  masks,
}: {
  masks: (FieldMask & { resource: string; actions: string[] })[]
}) {
  const grouped = new Map<
    string,
    (FieldMask & { resource: string; actions: string[] })[]
  >()
  for (const mask of masks) {
    if (!grouped.has(mask.resource)) grouped.set(mask.resource, [])
    grouped.get(mask.resource)!.push(mask)
  }

  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([resource, resourceMasks]) => (
        <div
          key={resource}
          className="rounded-lg border border-border/20 bg-background-tertiary/20 overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-border/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-content-primary">
                {resource}
              </span>
              <span className="text-[11px] text-content-tertiary">
                {resourceMasks.length} hidden field
                {resourceMasks.length !== 1 ? "s" : ""}
              </span>
            </div>
            <EyeOff className="h-3 w-3 text-content-tertiary/40" />
          </div>
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {resourceMasks.map((mask, i) => (
              <TooltipProvider key={`${mask.fieldPath}-${mask.maskType}-${i}`} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 rounded-md bg-background-tertiary/50 px-2.5 py-1.5 cursor-default">
                      <EyeOff className="h-3 w-3 text-content-tertiary/60" />
                      <span className="text-xs text-content-secondary">
                        {humanizeField(mask.fieldPath)}
                      </span>
                      {mask.maskType === "redact" && (
                        <span className="text-[10px] text-content-tertiary">
                          (redacted)
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      <span className="font-mono">{mask.fieldPath}</span>
                      {" \u2014 "}
                      {mask.maskType === "hide"
                        ? "hidden when " + mask.actions.join(", ")
                        : "redacted when " + mask.actions.join(", ")}
                    </p>
                    {mask.maskConfig && (
                      <pre className="font-mono text-[10px] mt-1 opacity-70">
                        {JSON.stringify(mask.maskConfig, null, 2)}
                      </pre>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      ))}
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
                expires{" "}
                {new Date(assignment.expiresAt).toLocaleDateString()}
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

function RoleExpandedDetail({ roleId }: { roleId: Id<"roles"> }) {
  const role = useRoleWithPolicies(roleId) as
    | RoleWithPolicies
    | null
    | undefined
  const assignedUsers = useRoleAssignedUsers(roleId) as
    | AssignedUser[]
    | undefined

  if (role === undefined || assignedUsers === undefined) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
      </div>
    )
  }

  if (!role) return null

  const policies: PolicyWithRules[] = role.policies
  const policiesByResource: Record<string, PolicyWithRules[]> = {}
  for (const policy of policies) {
    if (!policiesByResource[policy.resource])
      policiesByResource[policy.resource] = []
    policiesByResource[policy.resource].push(policy)
  }

  type ScopeRuleWithContext = ScopeRule & {
    resource: string
    allowActions: string[]
    denyActions: string[]
  }
  const scopeMap = new Map<string, ScopeRuleWithContext>()
  for (const p of policies) {
    for (const sr of p.scopeRules) {
      const key = `${p.resource}:${sr.field}:${sr.operator}:${sr.value}`
      const existing = scopeMap.get(key)
      if (existing) {
        const list =
          p.effect === "allow" ? existing.allowActions : existing.denyActions
        if (!list.includes(p.action)) list.push(p.action)
      } else {
        scopeMap.set(key, {
          ...sr,
          resource: p.resource,
          allowActions: p.effect === "allow" ? [p.action] : [],
          denyActions: p.effect === "deny" ? [p.action] : [],
        })
      }
    }
  }
  const allScopeRules = Array.from(scopeMap.values())

  type FieldMaskWithContext = FieldMask & { resource: string; actions: string[] }
  const maskMap = new Map<string, FieldMaskWithContext>()
  for (const p of policies) {
    for (const fm of p.fieldMasks) {
      const key = `${p.resource}:${fm.fieldPath}:${fm.maskType}`
      const existing = maskMap.get(key)
      if (existing) {
        if (!existing.actions.includes(p.action)) existing.actions.push(p.action)
      } else {
        maskMap.set(key, { ...fm, resource: p.resource, actions: [p.action] })
      }
    }
  }
  const allFieldMasks = Array.from(maskMap.values())

  const allowCount = policies.filter((p) => p.effect === "allow").length
  const denyCount = policies.filter((p) => p.effect === "deny").length
  const resourceCount = Object.keys(policiesByResource).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-1.5 text-content-secondary">
          <Lock className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{policies.length}</span>
          <span className="text-xs opacity-70">
            polic{policies.length !== 1 ? "ies" : "y"}
          </span>
        </div>
        {allScopeRules.length > 0 && (
          <>
            <ChevronRight className="h-3 w-3 text-content-tertiary/40" />
            <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-1.5 text-content-secondary">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {allScopeRules.length}
              </span>
              <span className="text-xs opacity-70">scope rules</span>
            </div>
          </>
        )}
        {allFieldMasks.length > 0 && (
          <>
            <ChevronRight className="h-3 w-3 text-content-tertiary/40" />
            <div className="flex items-center gap-2 rounded-md bg-background-tertiary px-3 py-1.5 text-content-secondary">
              <EyeOff className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {allFieldMasks.length}
              </span>
              <span className="text-xs opacity-70">hidden fields</span>
            </div>
          </>
        )}
      </div>

      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList className="bg-background-tertiary/60 h-9">
          <TabsTrigger value="matrix" className="text-xs gap-1.5 px-3">
            <Layers className="h-3.5 w-3.5" />
            Permissions
          </TabsTrigger>
          {allScopeRules.length > 0 && (
            <TabsTrigger value="scopes" className="text-xs gap-1.5 px-3">
              <Filter className="h-3.5 w-3.5" />
              Data Filters
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
              Hidden Fields
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

        <TabsContent value="matrix" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-content-secondary" />
              <h3 className="text-xs font-medium text-content-primary">
                Access Control Grid
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-content-tertiary">
              <span>{allowCount} allow</span>
              {denyCount > 0 && (
                <span className="text-destructive">{denyCount} deny</span>
              )}
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

        <TabsContent value="scopes" className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-content-secondary" />
            <h3 className="text-xs font-medium text-content-primary">
              Data Filters
            </h3>
            <span className="text-[11px] text-content-tertiary">
              This role can only see records matching these conditions
            </span>
          </div>
          <ScopeRulesGrouped rules={allScopeRules} />
        </TabsContent>

        <TabsContent value="masks" className="space-y-3">
          <div className="flex items-center gap-2">
            <EyeOff className="h-3.5 w-3.5 text-content-secondary" />
            <h3 className="text-xs font-medium text-content-primary">
              Hidden Fields
            </h3>
            <span className="text-[11px] text-content-tertiary">
              These fields are not visible to this role
            </span>
          </div>
          <FieldMasksGrouped masks={allFieldMasks} />
        </TabsContent>

        <TabsContent value="users" className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-content-secondary" />
            <h3 className="text-xs font-medium text-content-primary">
              Assigned Users
            </h3>
            <span className="text-[11px] text-content-tertiary">
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

function RoleSummaryStats({ roleId }: { roleId: Id<"roles"> }) {
  const role = useRoleWithPolicies(roleId) as
    | RoleWithPolicies
    | null
    | undefined
  const assignedUsers = useRoleAssignedUsers(roleId)

  if (role === undefined) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-background-tertiary" />
        <div className="h-4 w-14 animate-pulse rounded bg-background-tertiary" />
      </div>
    )
  }

  if (!role) return null

  const policies: PolicyWithRules[] = role.policies
  const resources = new Set(policies.map((p: PolicyWithRules) => p.resource))
  const allowCount = policies.filter(
    (p: PolicyWithRules) => p.effect === "allow"
  ).length
  const denyCount = policies.filter(
    (p: PolicyWithRules) => p.effect === "deny"
  ).length
  const scopeKeys = new Set<string>()
  for (const p of policies) {
    for (const sr of p.scopeRules) {
      scopeKeys.add(`${sr.field}:${sr.operator}:${sr.value}`)
    }
  }
  const scopeCount = scopeKeys.size

  const maskKeys = new Set<string>()
  for (const p of policies) {
    for (const fm of p.fieldMasks) {
      maskKeys.add(`${fm.fieldPath}:${fm.maskType}`)
    }
  }
  const maskCount = maskKeys.size
  const userCount = assignedUsers?.length ?? 0

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-3 text-xs text-content-tertiary">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-default">
              <Lock className="h-3 w-3" />
              <span>{resources.size}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-mono text-xs">
              {Array.from(resources).join(", ") || "none"}
            </p>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          <span>{allowCount}</span>
        </div>
        {denyCount > 0 && (
          <div className="flex items-center gap-1 text-destructive">
            <ShieldX className="h-3 w-3" />
            <span>{denyCount}</span>
          </div>
        )}

        {scopeCount > 0 && (
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            <span>{scopeCount}</span>
          </div>
        )}
        {maskCount > 0 && (
          <div className="flex items-center gap-1">
            <EyeOff className="h-3 w-3" />
            <span>{maskCount}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{userCount}</span>
        </div>
      </div>
    </TooltipProvider>
  )
}

function RoleRow({
  role,
  isExpanded,
  onToggle,
}: {
  role: Doc<"roles">
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        isExpanded
          ? "border-border/60 bg-background-secondary/70 shadow-sm shadow-black/5"
          : "border-border/30 bg-background-secondary/30 hover:border-border/50 hover:bg-background-secondary/50"
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left cursor-pointer"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-tertiary text-content-secondary transition-colors duration-200">
          <Shield className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-content-primary">
              {role.name}
            </span>
            {role.isSystem && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 font-normal"
              >
                system
              </Badge>
            )}
          </div>
          {role.description && (
            <p className="text-xs text-content-tertiary mt-0.5 line-clamp-1">
              {role.description}
            </p>
          )}
        </div>

        <div className="hidden sm:block shrink-0">
          <RoleSummaryStats roleId={role._id} />
        </div>

        <div
          className={cn(
            "shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        >
          <ChevronDown className="h-4 w-4 text-content-tertiary" />
        </div>
      </button>

      <div className="sm:hidden px-4 pb-3 -mt-1">
        <RoleSummaryStats roleId={role._id} />
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/20 px-5 py-5">
            {isExpanded && <RoleExpandedDetail roleId={role._id} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatsBar({ roles }: { roles: Doc<"roles">[] }) {
  const systemCount = roles.filter((r) => r.isSystem).length
  const customCount = roles.filter((r) => !r.isSystem).length

  return (
    <div className="flex items-center gap-4 text-xs text-content-tertiary">
      <span>{roles.length} total</span>
      {systemCount > 0 && (
        <span>{systemCount} system</span>
      )}
      {customCount > 0 && (
        <span>{customCount} custom</span>
      )}
    </div>
  )
}

function RolesPageContent() {
  const { environment } = useEnvironment()
  const roles = useRoles(environment)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<Id<"roles"> | null>(null)

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

  const toggleRole = (id: Id<"roles">) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

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
              <div className="space-y-2">
                {systemRoles.map((role: Doc<"roles">) => (
                  <RoleRow
                    key={role._id}
                    role={role}
                    isExpanded={expandedId === role._id}
                    onToggle={() => toggleRole(role._id)}
                  />
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
              <div className="space-y-2">
                {customRoles.map((role: Doc<"roles">) => (
                  <RoleRow
                    key={role._id}
                    role={role}
                    isExpanded={expandedId === role._id}
                    onToggle={() => toggleRole(role._id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default function RolesPage() {
  return (
    <AdminOnly>
      <div className="p-6 max-w-4xl">
        <RolesPageContent />
      </div>
    </AdminOnly>
  )
}
