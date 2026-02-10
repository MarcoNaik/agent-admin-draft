import type { EntityTypeConfig, JSONSchemaProperty } from '../types'

function validateObjectProperties(
  schema: JSONSchemaProperty,
  path: string
): void {
  if (schema.type === 'object' && !schema.properties) {
    throw new Error(
      `Schema field "${path}" has type "object" but is missing "properties". All object fields must declare their properties.`
    )
  }

  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const childPath = path ? `${path}.${key}` : key
      validateObjectProperties(value, childPath)
    }
  }

  if (schema.items) {
    validateObjectProperties(schema.items, `${path}[]`)
  }
}

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

  if (config.schema.properties) {
    for (const [key, value] of Object.entries(config.schema.properties)) {
      validateObjectProperties(value, key)
    }
  }

  return {
    ...config,
    searchFields: config.searchFields || [],
  }
}
