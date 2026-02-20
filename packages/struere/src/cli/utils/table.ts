import chalk from 'chalk'

interface Column {
  key: string
  label: string
  width?: number
  align?: 'left' | 'right'
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

function pad(str: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (align === 'right') return str.padStart(width)
  return str.padEnd(width)
}

export function renderTable(columns: Column[], rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log(chalk.gray('  No results'))
    return
  }

  const widths = columns.map((col) => {
    const headerLen = col.label.length
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? '')
      return Math.max(max, val.length)
    }, 0)
    const natural = Math.max(headerLen, maxDataLen)
    if (col.width) return Math.min(natural, col.width)
    return Math.min(natural, 40)
  })

  const header = columns.map((col, i) => chalk.bold(pad(col.label, widths[i], col.align))).join('  ')
  console.log(`  ${header}`)
  console.log(`  ${widths.map((w) => chalk.gray('─'.repeat(w))).join('  ')}`)

  for (const row of rows) {
    const line = columns.map((col, i) => {
      const raw = row[col.key]
      const val = raw === null || raw === undefined ? '' : String(raw)
      return pad(truncate(val, widths[i]), widths[i], col.align)
    }).join('  ')
    console.log(`  ${line}`)
  }
}

interface Schema {
  properties?: Record<string, unknown>
  required?: string[]
}

interface DisplayConfig {
  columns?: string[]
}

export function deriveColumnsFromSchema(schema: Schema, displayConfig?: DisplayConfig): Column[] {
  const cols: Column[] = [
    { key: '_id', label: 'ID', width: 20 },
  ]

  if (displayConfig?.columns) {
    for (const key of displayConfig.columns) {
      cols.push({ key, label: key, width: 25 })
    }
  } else if (schema.properties) {
    const keys = Object.keys(schema.properties).slice(0, 5)
    for (const key of keys) {
      cols.push({ key, label: key, width: 25 })
    }
  }

  cols.push({ key: 'status', label: 'status', width: 15 })

  return cols
}
