import type {
  ActorContext,
  ResolvedPolicy,
  Action,
  PermissionResult,
  ScopeFilter,
  FieldMask,
  ScopeRule,
  ScopeOperator
} from './types'

export class PermissionEvaluator {
  private policies: ResolvedPolicy[]

  constructor(policies: ResolvedPolicy[]) {
    this.policies = policies
  }

  async evaluate(
    actor: ActorContext,
    resource: string,
    action: Action,
    resourceData?: Record<string, unknown>
  ): Promise<PermissionResult> {
    const matchingPolicies = this.collectMatchingPolicies(resource, action)

    if (matchingPolicies.length === 0) {
      return {
        allowed: false,
        reason: `No policies found for resource '${resource}' and action '${action}'`,
        scopeFilters: [],
        fieldMasks: []
      }
    }

    const sortedPolicies = this.sortPolicies(matchingPolicies)

    const scopeFilters: ScopeFilter[] = []
    const fieldMasks: FieldMask[] = []

    for (const policy of sortedPolicies) {
      const scopeResult = this.evaluateScopeRules(policy.scopeRules, actor, resourceData)

      if (policy.effect === 'deny' && scopeResult.matches) {
        return {
          allowed: false,
          reason: `Denied by policy '${policy.id}'`,
          scopeFilters: [],
          fieldMasks: []
        }
      }

      if (policy.effect === 'allow' && scopeResult.matches) {
        scopeFilters.push(...scopeResult.filters)
        fieldMasks.push(...policy.fieldMasks)
      }
    }

    const hasAllowPolicy = sortedPolicies.some(p => p.effect === 'allow')

    if (!hasAllowPolicy) {
      return {
        allowed: false,
        reason: 'No allow policies matched',
        scopeFilters: [],
        fieldMasks: []
      }
    }

    return {
      allowed: true,
      reason: 'Permission granted',
      scopeFilters: this.deduplicateFilters(scopeFilters),
      fieldMasks: this.deduplicateMasks(fieldMasks)
    }
  }

  private collectMatchingPolicies(resource: string, action: Action): ResolvedPolicy[] {
    return this.policies.filter(policy => {
      const resourceMatches = policy.resource === '*' || policy.resource === resource
      const actionMatches = policy.action === '*' || policy.action === action
      return resourceMatches && actionMatches
    })
  }

  private sortPolicies(policies: ResolvedPolicy[]): ResolvedPolicy[] {
    return [...policies].sort((a, b) => {
      if (a.effect !== b.effect) {
        return a.effect === 'deny' ? -1 : 1
      }
      return b.priority - a.priority
    })
  }

  private evaluateScopeRules(
    scopeRules: ScopeRule[],
    actor: ActorContext,
    resourceData?: Record<string, unknown>
  ): { matches: boolean; filters: ScopeFilter[] } {
    if (scopeRules.length === 0) {
      return { matches: true, filters: [] }
    }

    const filters: ScopeFilter[] = []

    for (const rule of scopeRules) {
      if (rule.type === 'field' && rule.field && rule.operator && rule.value !== null) {
        const resolvedValue = this.resolveVariable(rule.value, actor)
        const operator = rule.operator as ScopeOperator

        if (resourceData) {
          const fieldValue = this.getNestedValue(resourceData, rule.field)
          if (!this.compareValues(fieldValue, operator, resolvedValue)) {
            return { matches: false, filters: [] }
          }
        }

        filters.push({
          field: rule.field,
          operator,
          value: resolvedValue
        })
      } else if (rule.type === 'relation' && rule.relationPath) {
        const parts = rule.relationPath.split('.')
        const finalField = parts[parts.length - 1]
        const resolvedValue = rule.value ? this.resolveVariable(rule.value, actor) : actor.userId

        filters.push({
          field: rule.relationPath,
          operator: 'eq',
          value: resolvedValue
        })

        if (resourceData) {
          const fieldValue = this.getNestedValue(resourceData, rule.relationPath)
          if (fieldValue !== resolvedValue) {
            return { matches: false, filters: [] }
          }
        }
      }
    }

    return { matches: true, filters }
  }

  private resolveVariable(value: string, actor: ActorContext): unknown {
    if (!value.startsWith('$actor.')) {
      return value
    }

    const path = value.slice(7)

    if (path === 'userId') {
      return actor.userId
    }
    if (path === 'organizationId') {
      return actor.organizationId
    }
    if (path === 'roles') {
      return actor.roles
    }
    if (path.startsWith('attributes.')) {
      const attrPath = path.slice(11)
      return this.getNestedValue(actor.attributes, attrPath)
    }

    return value
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }
      if (typeof current !== 'object') {
        return undefined
      }
      current = (current as Record<string, unknown>)[part]
    }

    return current
  }

  private compareValues(fieldValue: unknown, operator: ScopeOperator, targetValue: unknown): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === targetValue
      case 'neq':
        return fieldValue !== targetValue
      case 'in':
        if (Array.isArray(targetValue)) {
          return targetValue.includes(fieldValue)
        }
        return false
      case 'nin':
        if (Array.isArray(targetValue)) {
          return !targetValue.includes(fieldValue)
        }
        return true
      case 'contains':
        if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
          return fieldValue.includes(targetValue)
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(targetValue)
        }
        return false
      case 'exists':
        return targetValue ? fieldValue !== undefined && fieldValue !== null : fieldValue === undefined || fieldValue === null
      case 'gt':
        return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue > targetValue
      case 'gte':
        return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue >= targetValue
      case 'lt':
        return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue < targetValue
      case 'lte':
        return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue <= targetValue
      default:
        return false
    }
  }

  private deduplicateFilters(filters: ScopeFilter[]): ScopeFilter[] {
    const seen = new Set<string>()
    return filters.filter(filter => {
      const key = `${filter.field}:${filter.operator}:${JSON.stringify(filter.value)}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private deduplicateMasks(masks: FieldMask[]): FieldMask[] {
    const seen = new Set<string>()
    return masks.filter(mask => {
      const key = `${mask.fieldPath}:${mask.maskType}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
}
