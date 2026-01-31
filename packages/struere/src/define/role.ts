import type { RoleConfig } from '../types'

export function defineRole(config: RoleConfig): RoleConfig {
  if (!config.name) {
    throw new Error('Role name is required')
  }
  if (!config.policies || config.policies.length === 0) {
    throw new Error('Role must have at least one policy')
  }

  for (const policy of config.policies) {
    if (!policy.resource) {
      throw new Error('Policy resource is required')
    }
    if (!policy.actions || policy.actions.length === 0) {
      throw new Error('Policy must have at least one action')
    }
    if (!policy.effect) {
      throw new Error('Policy effect is required')
    }
  }

  return {
    ...config,
    policies: config.policies.map((policy, index) => ({
      ...policy,
      priority: policy.priority ?? (index + 1) * 10,
    })),
    scopeRules: config.scopeRules || [],
    fieldMasks: config.fieldMasks || [],
  }
}
