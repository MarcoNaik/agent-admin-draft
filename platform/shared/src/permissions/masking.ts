import type { FieldMask, FieldMaskConfig } from './types'

export class FieldMasker {
  private defaultRedactPattern = '***'

  mask<T extends Record<string, unknown>>(data: T, masks: FieldMask[]): T {
    if (!masks || masks.length === 0) {
      return data
    }

    const result = this.deepClone(data)

    for (const mask of masks) {
      this.applyMask(result, mask.fieldPath, mask.maskType, mask.config)
    }

    return result
  }

  maskArray<T extends Record<string, unknown>>(data: T[], masks: FieldMask[]): T[] {
    if (!masks || masks.length === 0) {
      return data
    }

    return data.map(item => this.mask(item, masks))
  }

  private applyMask(
    obj: Record<string, unknown>,
    fieldPath: string,
    maskType: 'hide' | 'redact',
    config: FieldMaskConfig | null
  ): void {
    const parts = fieldPath.split('.')

    if (parts.length === 1) {
      if (maskType === 'hide') {
        delete obj[fieldPath]
      } else if (maskType === 'redact') {
        if (obj[fieldPath] !== undefined && obj[fieldPath] !== null) {
          obj[fieldPath] = this.redactValue(obj[fieldPath], config)
        }
      }
      return
    }

    const [first, ...rest] = parts
    const child = obj[first]

    if (child === null || child === undefined) {
      return
    }

    if (Array.isArray(child)) {
      for (const item of child) {
        if (typeof item === 'object' && item !== null) {
          this.applyMask(item as Record<string, unknown>, rest.join('.'), maskType, config)
        }
      }
    } else if (typeof child === 'object') {
      this.applyMask(child as Record<string, unknown>, rest.join('.'), maskType, config)
    }
  }

  private redactValue(value: unknown, config: FieldMaskConfig | null): string {
    if (value === null || value === undefined) {
      return this.defaultRedactPattern
    }

    const stringValue = String(value)

    if (config?.pattern && config?.replacement) {
      try {
        const regex = new RegExp(config.pattern, 'g')
        return stringValue.replace(regex, config.replacement)
      } catch {
        return this.defaultRedactPattern
      }
    }

    if (config?.replacement) {
      return config.replacement
    }

    const length = stringValue.length
    if (length <= 4) {
      return this.defaultRedactPattern
    }

    return stringValue.slice(0, 1) + '*'.repeat(Math.min(length - 2, 8)) + stringValue.slice(-1)
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as unknown as T
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T
    }

    const cloned = {} as T
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        (cloned as Record<string, unknown>)[key] = this.deepClone((obj as Record<string, unknown>)[key])
      }
    }

    return cloned
  }
}
