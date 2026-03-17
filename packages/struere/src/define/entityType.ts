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

  if (schema.references !== undefined) {
    if (schema.references === '') {
      throw new Error(
        `Schema field "${path}" has an empty "references" value.`
      )
    }
    if (schema.type !== 'string') {
      throw new Error(
        `Schema field "${path}" has "references" but is not type "string". References can only be used on string fields.`
      )
    }
  }

  if (schema.items) {
    validateObjectProperties(schema.items, `${path}[]`)
  }
}

export function defineData(config: EntityTypeConfig): EntityTypeConfig {
  if (!config.name) {
    throw new Error('Data type name is required')
  }
  if (!config.slug) {
    throw new Error('Data type slug is required')
  }
  if (!config.schema) {
    throw new Error('Data type schema is required')
  }
  if (config.schema.type !== 'object') {
    throw new Error('Data type schema must be an object type')
  }

  if (config.schema.properties) {
    for (const [key, value] of Object.entries(config.schema.properties)) {
      validateObjectProperties(value, key)
    }
  }

  if (config.boundToRole !== undefined && config.boundToRole === '') {
    throw new Error('boundToRole cannot be an empty string')
  }

  if (config.userIdField !== undefined && !config.boundToRole) {
    throw new Error('userIdField requires boundToRole to be set')
  }

  const userIdField = config.boundToRole && !config.userIdField
    ? 'userId'
    : config.userIdField

  return {
    ...config,
    searchFields: config.searchFields || [],
    userIdField,
  }
}
