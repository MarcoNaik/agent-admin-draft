import { tutoringPack } from "./tutoring"

export interface PackDefinition {
  id: string
  name: string
  version: string
  description: string
  entityTypes: EntityTypeDefinition[]
  roles: RoleDefinition[]
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

export const AVAILABLE_PACKS: PackDefinition[] = [tutoringPack]

export function getPackById(id: string): PackDefinition | undefined {
  return AVAILABLE_PACKS.find((p) => p.id === id)
}
