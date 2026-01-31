import { tutoringPack } from "./tutoring"

export type MigrationStepType =
  | "add_field"
  | "remove_field"
  | "rename_field"
  | "add_entity_type"
  | "modify_schema"
  | "run_script"

export interface AddFieldStep {
  type: "add_field"
  entityType: string
  field: string
  defaultValue: unknown
}

export interface RemoveFieldStep {
  type: "remove_field"
  entityType: string
  field: string
}

export interface RenameFieldStep {
  type: "rename_field"
  entityType: string
  oldField: string
  newField: string
}

export interface AddEntityTypeStep {
  type: "add_entity_type"
  entityType: EntityTypeDefinition
}

export interface ModifySchemaStep {
  type: "modify_schema"
  entityType: string
  schemaChanges: Record<string, unknown>
}

export interface RunScriptStep {
  type: "run_script"
  script: string
}

export type MigrationStep =
  | AddFieldStep
  | RemoveFieldStep
  | RenameFieldStep
  | AddEntityTypeStep
  | ModifySchemaStep
  | RunScriptStep

export interface Migration {
  fromVersion: string
  toVersion: string
  steps: MigrationStep[]
}

export interface PackHooks {
  postInstall?: string
  preUpgrade?: string
  postUpgrade?: string
}

export interface PackDefinition {
  id: string
  name: string
  version: string
  description: string
  author: string
  license: string
  entityTypes: EntityTypeDefinition[]
  roles: RoleDefinition[]
  scopeRules?: ScopeRuleDefinition[]
  fieldMasks?: FieldMaskDefinition[]
  migrations: Migration[]
  hooks?: PackHooks
  migrationScripts?: Record<string, (ctx: unknown, organizationId: unknown) => Promise<void>>
}

export interface EntityTypeDefinition {
  name: string
  slug: string
  description: string
  schema: object
  searchFields?: string[]
  displayConfig?: object
}

export interface RoleDefinition {
  name: string
  description: string
  isSystem: boolean
  policies: PolicyDefinition[]
}

export interface PolicyDefinition {
  resource: string
  actions: string[]
  effect: "allow" | "deny"
  priority: number
}

export interface ScopeRuleDefinition {
  roleName: string
  entityTypeSlug: string
  type: "field" | "relation"
  field?: string
  operator?: "eq" | "neq" | "in" | "contains"
  value?: string
  relationPath?: string
}

export interface FieldMaskDefinition {
  roleName: string
  entityTypeSlug: string
  fieldPath: string
  maskType: "hide" | "redact"
  maskConfig?: object
}

export const AVAILABLE_PACKS: PackDefinition[] = [tutoringPack]

export function getPackById(id: string): PackDefinition | undefined {
  return AVAILABLE_PACKS.find((p) => p.id === id)
}
