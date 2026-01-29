export type Action = 'create' | 'read' | 'update' | 'delete' | 'list'

export type ScopeOperator = 'eq' | 'neq' | 'in' | 'nin' | 'contains' | 'exists' | 'gt' | 'gte' | 'lt' | 'lte'

export type ScopeRuleType = 'field' | 'relation'

export type MaskType = 'hide' | 'redact'

export type PolicyEffect = 'allow' | 'deny'

export interface ActorContext {
  userId: string
  organizationId: string
  roles: string[]
  attributes: Record<string, unknown>
}

export interface ResolvedRole {
  id: string
  name: string
  organizationId: string
  isSystem: boolean
}

export interface ScopeRule {
  id: string
  policyId: string
  type: ScopeRuleType
  field: string | null
  operator: ScopeOperator | null
  value: string | null
  relationPath: string | null
}

export interface FieldMask {
  id: string
  policyId: string
  fieldPath: string
  maskType: MaskType
  config: FieldMaskConfig | null
}

export interface FieldMaskConfig {
  pattern?: string
  replacement?: string
}

export interface ResolvedPolicy {
  id: string
  organizationId: string
  roleId: string
  resource: string
  action: string
  effect: PolicyEffect
  priority: number
  scopeRules: ScopeRule[]
  fieldMasks: FieldMask[]
}

export interface ScopeFilter {
  field: string
  operator: ScopeOperator
  value: unknown
}

export interface PermissionResult {
  allowed: boolean
  reason: string
  scopeFilters: ScopeFilter[]
  fieldMasks: FieldMask[]
}

export interface UserRoleAssignment {
  id: string
  userId: string
  roleId: string
  resourceType: string | null
  resourceId: string | null
  grantedBy: string | null
  expiresAt: Date | null
  createdAt: Date
}

export interface PolicyWithDetails {
  id: string
  organizationId: string
  roleId: string
  resource: string
  action: string
  effect: PolicyEffect
  priority: number
  createdAt: Date
  scopeRules: Array<{
    id: string
    type: ScopeRuleType
    field: string | null
    operator: string | null
    value: string | null
    relationPath: string | null
  }>
  fieldMasks: Array<{
    id: string
    fieldPath: string
    maskType: MaskType
    maskConfig: FieldMaskConfig | null
  }>
}
