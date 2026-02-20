import { Id } from "../../_generated/dataModel"

export type Action = "create" | "read" | "update" | "delete" | "list"

export type ActorType = "user" | "agent" | "system" | "webhook"

export type Environment = "development" | "production" | "eval"

export interface ActorContext {
  organizationId: Id<"organizations">
  actorType: ActorType
  actorId: string
  roleIds: Id<"roles">[]
  isOrgAdmin?: boolean
  environment: Environment
}

export interface PermissionResult {
  allowed: boolean
  reason?: string
  matchedPolicy?: Id<"policies">
  evaluatedPolicies?: number
}

export class PermissionError extends Error {
  constructor(
    public readonly reason: string,
    public readonly actor: ActorContext,
    public readonly action: Action,
    public readonly resource: string
  ) {
    super(`Permission denied: ${reason}`)
    this.name = "PermissionError"
  }
}

export interface ScopeFilter {
  field: string
  operator: "eq" | "neq" | "in" | "contains"
  value: unknown
}

export interface FieldMaskResult {
  allowedFields: string[]
  isWildcard: boolean
}
