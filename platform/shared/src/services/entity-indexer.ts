import type { IndexMapping, IndexedFields } from '../types'

export function populateIndexes(
  data: Record<string, unknown>,
  indexMapping: IndexMapping | null | undefined
): IndexedFields {
  if (!indexMapping) return {}

  const result: IndexedFields = {}

  if (indexMapping.idx_0) {
    const value = data[indexMapping.idx_0]
    result.idx0 = value !== undefined && value !== null ? String(value) : null
  }

  if (indexMapping.idx_1) {
    const value = data[indexMapping.idx_1]
    result.idx1 = value !== undefined && value !== null ? String(value) : null
  }

  if (indexMapping.idx_2) {
    const value = data[indexMapping.idx_2]
    result.idx2 = value !== undefined && value !== null ? String(value) : null
  }

  if (indexMapping.idx_3) {
    const value = data[indexMapping.idx_3]
    result.idx3 = value !== undefined && value !== null ? String(value) : null
  }

  if (indexMapping.idx_num_0) {
    const value = data[indexMapping.idx_num_0]
    result.idxNum0 = typeof value === 'number' ? value : null
  }

  if (indexMapping.idx_num_1) {
    const value = data[indexMapping.idx_num_1]
    result.idxNum1 = typeof value === 'number' ? value : null
  }

  if (indexMapping.idx_date_0) {
    const value = data[indexMapping.idx_date_0]
    if (value) {
      result.idxDate0 = value instanceof Date ? value : new Date(value as string)
    }
  }

  if (indexMapping.idx_date_1) {
    const value = data[indexMapping.idx_date_1]
    if (value) {
      result.idxDate1 = value instanceof Date ? value : new Date(value as string)
    }
  }

  return result
}

export function buildSearchText(
  data: Record<string, unknown>,
  searchFields: string[] | null | undefined
): string | null {
  if (!searchFields || searchFields.length === 0) return null

  const parts = searchFields
    .map(field => {
      const value = data[field]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    })
    .filter(Boolean)

  if (parts.length === 0) return null
  return parts.join(' ').toLowerCase()
}

export function validateDataAgainstSchema(
  data: Record<string, unknown>,
  schema: { properties: Record<string, { type: string }>; required?: string[] }
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`)
      }
    }
  }

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    const value = data[fieldName]
    if (value === undefined || value === null) continue

    const expectedType = fieldSchema.type
    const actualType = Array.isArray(value) ? 'array' : typeof value

    if (expectedType === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push(`Field ${fieldName} must be an integer`)
      }
    } else if (expectedType === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`Field ${fieldName} must be an array`)
      }
    } else if (expectedType === 'object') {
      if (actualType !== 'object' || Array.isArray(value)) {
        errors.push(`Field ${fieldName} must be an object`)
      }
    } else if (expectedType !== actualType) {
      errors.push(`Field ${fieldName} must be of type ${expectedType}, got ${actualType}`)
    }
  }

  return { valid: errors.length === 0, errors }
}
