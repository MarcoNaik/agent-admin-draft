import type { EntityTypeConfig } from '../types'

export function defineEntityType(config: EntityTypeConfig): EntityTypeConfig {
  if (!config.name) {
    throw new Error('Entity type name is required')
  }
  if (!config.slug) {
    throw new Error('Entity type slug is required')
  }
  if (!config.schema) {
    throw new Error('Entity type schema is required')
  }
  if (config.schema.type !== 'object') {
    throw new Error('Entity type schema must be an object type')
  }

  return {
    ...config,
    searchFields: config.searchFields || [],
  }
}
