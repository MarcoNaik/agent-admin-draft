export interface RelationDefinition {
  name: string
  fromType: string
  toType: string
  inverseName?: string
}

export class RelationRegistry {
  private relations: Map<string, RelationDefinition> = new Map()
  private inverseMap: Map<string, string> = new Map()

  register(definition: RelationDefinition): void {
    this.relations.set(definition.name, definition)

    if (definition.inverseName) {
      this.inverseMap.set(definition.inverseName, definition.name)
      this.relations.set(definition.inverseName, {
        name: definition.inverseName,
        fromType: definition.toType,
        toType: definition.fromType,
        inverseName: definition.name
      })
    }
  }

  get(name: string): RelationDefinition | undefined {
    return this.relations.get(name)
  }

  getInverse(name: string): RelationDefinition | undefined {
    const inverseName = this.inverseMap.get(name)
    if (inverseName) {
      return this.relations.get(inverseName)
    }
    const relation = this.relations.get(name)
    if (relation?.inverseName) {
      return this.relations.get(relation.inverseName)
    }
    return undefined
  }

  getInheritanceChain(relationPath: string): string[] {
    const parts = relationPath.split('.')
    const chain: string[] = []

    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts.slice(0, i + 1).join('.')
      chain.push(segment)
    }

    return chain
  }

  resolveRelationPath(path: string): Array<{ relation: string; field: string }> {
    const parts = path.split('.')
    const result: Array<{ relation: string; field: string }> = []

    for (let i = 0; i < parts.length - 1; i++) {
      const currentPart = parts[i]
      const nextPart = parts[i + 1]

      const relation = this.relations.get(currentPart)
      if (relation) {
        result.push({ relation: currentPart, field: nextPart })
      }
    }

    if (result.length === 0 && parts.length >= 2) {
      result.push({
        relation: parts.slice(0, -1).join('.'),
        field: parts[parts.length - 1]
      })
    }

    return result
  }

  getAllRelations(): RelationDefinition[] {
    return Array.from(this.relations.values())
  }

  getRelationsForType(entityType: string): RelationDefinition[] {
    return Array.from(this.relations.values()).filter(
      r => r.fromType === entityType || r.toType === entityType
    )
  }

  clear(): void {
    this.relations.clear()
    this.inverseMap.clear()
  }
}

export const globalRelationRegistry = new RelationRegistry()
