import type { PullStateAgent, PullStateEntityType, PullStateRole, PullStateTrigger } from './convex'

const BUILTIN_TOOLS = [
  'entity.create',
  'entity.get',
  'entity.query',
  'entity.update',
  'entity.delete',
  'entity.link',
  'entity.unlink',
  'event.emit',
  'event.query',
  'agent.chat',
]

function escapeTemplateLiteral(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function stringifyValue(value: unknown, indent: number): string {
  if (value === null || value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((item) => `${' '.repeat(indent + 2)}${stringifyValue(item, indent + 2)}`)
    return `[\n${items.join(',\n')},\n${' '.repeat(indent)}]`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const lines = entries.map(([key, val]) => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
      return `${' '.repeat(indent + 2)}${safeKey}: ${stringifyValue(val, indent + 2)}`
    })
    return `{\n${lines.join(',\n')},\n${' '.repeat(indent)}}`
  }

  return JSON.stringify(value)
}

export function generateAgentFile(agent: PullStateAgent): string {
  const toolNames = agent.tools.map((t) => t.name)
  const toolsArray = toolNames.map((n) => `    "${n}"`).join(',\n')

  const modelParts: string[] = [
    `    provider: "${agent.model.provider}"`,
    `    name: "${agent.model.name}"`,
  ]
  if (agent.model.temperature !== undefined) {
    modelParts.push(`    temperature: ${agent.model.temperature}`)
  }
  if (agent.model.maxTokens !== undefined) {
    modelParts.push(`    maxTokens: ${agent.model.maxTokens}`)
  }

  const parts: string[] = [
    `  name: "${agent.name}"`,
    `  slug: "${agent.slug}"`,
    `  version: "${agent.version}"`,
  ]

  if (agent.description) {
    parts.push(`  description: "${agent.description}"`)
  }

  parts.push(`  model: {\n${modelParts.join(',\n')},\n  }`)
  parts.push(`  systemPrompt: \`${escapeTemplateLiteral(agent.systemPrompt)}\``)
  parts.push(`  tools: [\n${toolsArray},\n  ]`)

  return `import { defineAgent } from 'struere'

export default defineAgent({
${parts.join(',\n')},
})
`
}

export function generateEntityTypeFile(entityType: PullStateEntityType): string {
  const parts: string[] = [
    `  name: "${entityType.name}"`,
    `  slug: "${entityType.slug}"`,
    `  schema: ${stringifyValue(entityType.schema, 2)}`,
  ]

  if (entityType.searchFields && entityType.searchFields.length > 0) {
    parts.push(`  searchFields: ${JSON.stringify(entityType.searchFields)}`)
  }

  if (entityType.displayConfig) {
    parts.push(`  displayConfig: ${stringifyValue(entityType.displayConfig, 2)}`)
  }

  return `import { defineEntityType } from 'struere'

export default defineEntityType({
${parts.join(',\n')},
})
`
}

export function generateRoleFile(role: PullStateRole): string {
  const policyLines = role.policies.map((p) => {
    const pParts: string[] = [
      `      resource: "${p.resource}"`,
      `      actions: ${JSON.stringify(p.actions)}`,
      `      effect: "${p.effect}"`,
    ]
    return `    {\n${pParts.join(',\n')},\n    }`
  })

  const parts: string[] = [
    `  name: "${role.name}"`,
  ]

  if (role.description) {
    parts.push(`  description: "${role.description}"`)
  }

  parts.push(`  policies: [\n${policyLines.join(',\n')},\n  ]`)

  if (role.scopeRules.length > 0) {
    const srLines = role.scopeRules.map((sr) => {
      const srParts = [
        `      entityType: "${sr.entityType}"`,
        `      field: "${sr.field}"`,
        `      operator: "${sr.operator}"`,
        `      value: "${sr.value}"`,
      ]
      return `    {\n${srParts.join(',\n')},\n    }`
    })
    parts.push(`  scopeRules: [\n${srLines.join(',\n')},\n  ]`)
  }

  if (role.fieldMasks.length > 0) {
    const fmLines = role.fieldMasks.map((fm) => {
      const fmParts: string[] = [
        `      entityType: "${fm.entityType}"`,
        `      fieldPath: "${fm.fieldPath}"`,
        `      maskType: "${fm.maskType}"`,
      ]
      if (fm.maskConfig) {
        fmParts.push(`      maskConfig: ${stringifyValue(fm.maskConfig, 6)}`)
      }
      return `    {\n${fmParts.join(',\n')},\n    }`
    })
    parts.push(`  fieldMasks: [\n${fmLines.join(',\n')},\n  ]`)
  }

  return `import { defineRole } from 'struere'

export default defineRole({
${parts.join(',\n')},
})
`
}

interface CustomTool {
  name: string
  description: string
  parameters: unknown
  handlerCode?: string
}

export function generateToolsFile(customTools: CustomTool[]): string {
  if (customTools.length === 0) {
    return `import { defineTools } from 'struere'

export default defineTools([])
`
  }

  const toolEntries = customTools.map((tool) => {
    const parts: string[] = [
      `    name: "${tool.name}"`,
      `    description: "${tool.description}"`,
      `    parameters: ${stringifyValue(tool.parameters, 4)}`,
    ]

    if (tool.handlerCode) {
      parts.push(`    handler: async (args, context, fetch) => {\n      ${tool.handlerCode.split('\n').join('\n      ')}\n    }`)
    } else {
      parts.push(`    handler: async (args, context, fetch) => {\n      throw new Error("TODO: implement handler")\n    }`)
    }

    return `  {\n${parts.join(',\n')},\n  }`
  })

  return `import { defineTools } from 'struere'

export default defineTools([
${toolEntries.join(',\n')},
])
`
}

export function generateTriggerFile(trigger: PullStateTrigger): string {
  const onParts: string[] = [
    `    entityType: "${trigger.entityType}"`,
    `    action: "${trigger.action}"`,
  ]
  if (trigger.condition && Object.keys(trigger.condition).length > 0) {
    onParts.push(`    condition: ${stringifyValue(trigger.condition, 4)}`)
  }

  const actionLines = trigger.actions.map((a) => {
    const aParts: string[] = [
      `      tool: "${a.tool}"`,
      `      args: ${stringifyValue(a.args, 6)}`,
    ]
    if (a.as) {
      aParts.push(`      as: "${a.as}"`)
    }
    return `    {\n${aParts.join(',\n')},\n    }`
  })

  const parts: string[] = [
    `  name: "${trigger.name}"`,
    `  slug: "${trigger.slug}"`,
  ]

  if (trigger.description) {
    parts.push(`  description: "${trigger.description}"`)
  }

  parts.push(`  on: {\n${onParts.join(',\n')},\n  }`)
  parts.push(`  actions: [\n${actionLines.join(',\n')},\n  ]`)

  if (trigger.schedule) {
    parts.push(`  schedule: ${stringifyValue(trigger.schedule, 2)}`)
  }

  if (trigger.retry) {
    parts.push(`  retry: ${stringifyValue(trigger.retry, 2)}`)
  }

  return `import { defineTrigger } from 'struere'

export default defineTrigger({
${parts.join(',\n')},
})
`
}

export function generateIndexFile(type: 'agents' | 'entity-types' | 'roles' | 'triggers', slugs: string[]): string {
  if (slugs.length === 0) {
    return ''
  }

  const exports = slugs.map((slug) => {
    const camelName = slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    return `export { default as ${camelName} } from './${slug}'`
  })

  return exports.join('\n') + '\n'
}

export function collectCustomTools(agents: PullStateAgent[]): CustomTool[] {
  const seen = new Map<string, CustomTool>()

  for (const agent of agents) {
    for (const tool of agent.tools) {
      if (!BUILTIN_TOOLS.includes(tool.name) && !seen.has(tool.name)) {
        seen.set(tool.name, {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          handlerCode: tool.handlerCode,
        })
      }
    }
  }

  return Array.from(seen.values())
}
