interface PullStateAgent {
  name: string
  slug: string
  description?: string
  version: string
  systemPrompt: string
  model: { provider: string; name: string; temperature?: number; maxTokens?: number }
  tools: Array<{ name: string; description: string; parameters: unknown; handlerCode?: string; isBuiltin: boolean }>
}

interface PullStateEntityType {
  name: string
  slug: string
  schema: unknown
  searchFields?: string[]
  displayConfig?: unknown
  boundToRole?: string
  userIdField?: string
}

interface PullStateRole {
  name: string
  description?: string
  policies: Array<{ resource: string; actions: string[]; effect: string }>
  scopeRules: Array<{ entityType: string; field: string; operator: string; value: string }>
  fieldMasks: Array<{ entityType: string; fieldPath: string; maskType: string; maskConfig?: Record<string, unknown> }>
}

interface PullStateTrigger {
  name: string
  slug: string
  description?: string
  entityType: string
  action: string
  condition?: unknown
  actions: Array<{ tool: string; args: unknown; as?: string }>
  schedule?: { delay?: number; at?: string; offset?: number; cancelPrevious?: boolean }
  retry?: { maxAttempts?: number; backoffMs?: number }
}

export interface PullState {
  agents: PullStateAgent[]
  entityTypes: PullStateEntityType[]
  roles: PullStateRole[]
  triggers: PullStateTrigger[]
}

export interface ProjectFile {
  path: string
  content: string
}

function escapeTemplateLiteral(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")
}

function stringifyValue(value: unknown, indent = 2): string {
  if (value === null || value === undefined) return "undefined"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    const items = value.map((v) => `${" ".repeat(indent + 2)}${stringifyValue(v, indent + 2)}`).join(",\n")
    return `[\n${items},\n${" ".repeat(indent)}]`
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return "{}"
    const items = entries
      .map(([k, v]) => `${" ".repeat(indent + 2)}${k}: ${stringifyValue(v, indent + 2)}`)
      .join(",\n")
    return `{\n${items},\n${" ".repeat(indent)}}`
  }
  return String(value)
}

const BUILTIN_PREFIXES = ["entity.", "event.", "agent.", "calendar.", "whatsapp."]

function generateAgentFile(agent: PullStateAgent): string {
  const builtinTools = agent.tools.filter((t) => t.isBuiltin).map((t) => `"${t.name}"`)
  const toolsStr = builtinTools.length > 0 ? `\n    ${builtinTools.join(",\n    ")},\n  ` : ""

  const modelStr = [
    `    provider: "${agent.model.provider}"`,
    `    name: "${agent.model.name}"`,
    agent.model.temperature !== undefined ? `    temperature: ${agent.model.temperature}` : null,
    agent.model.maxTokens !== undefined ? `    maxTokens: ${agent.model.maxTokens}` : null,
  ]
    .filter(Boolean)
    .join(",\n")

  return `import { defineAgent } from 'struere'

export default defineAgent({
  name: "${agent.name}",
  slug: "${agent.slug}",
  version: "${agent.version}",${agent.description ? `\n  description: ${JSON.stringify(agent.description)},` : ""}
  model: {
${modelStr},
  },
  systemPrompt: \`${escapeTemplateLiteral(agent.systemPrompt)}\`,
  tools: [${toolsStr}],
})
`
}

function generateEntityTypeFile(et: PullStateEntityType): string {
  const parts = [
    `  name: ${JSON.stringify(et.name)}`,
    `  slug: ${JSON.stringify(et.slug)}`,
    `  schema: ${stringifyValue(et.schema)}`,
  ]
  if (et.searchFields?.length) parts.push(`  searchFields: ${JSON.stringify(et.searchFields)}`)
  if (et.displayConfig) parts.push(`  displayConfig: ${stringifyValue(et.displayConfig)}`)
  if (et.boundToRole) parts.push(`  boundToRole: ${JSON.stringify(et.boundToRole)}`)
  if (et.userIdField) parts.push(`  userIdField: ${JSON.stringify(et.userIdField)}`)

  return `import { defineEntityType } from 'struere'

export default defineEntityType({
${parts.join(",\n")},
})
`
}

function generateRoleFile(role: PullStateRole): string {
  return `import { defineRole } from 'struere'

export default defineRole({
  name: ${JSON.stringify(role.name)},${role.description ? `\n  description: ${JSON.stringify(role.description)},` : ""}
  policies: ${stringifyValue(role.policies)},
  scopeRules: ${stringifyValue(role.scopeRules)},
  fieldMasks: ${stringifyValue(role.fieldMasks)},
})
`
}

function generateTriggerFile(trigger: PullStateTrigger): string {
  const onObj: Record<string, unknown> = {
    entityType: trigger.entityType,
    action: trigger.action,
  }
  if (trigger.condition) onObj.condition = trigger.condition

  const parts = [
    `  name: ${JSON.stringify(trigger.name)}`,
    `  slug: ${JSON.stringify(trigger.slug)}`,
  ]
  if (trigger.description) parts.push(`  description: ${JSON.stringify(trigger.description)}`)
  parts.push(`  on: ${stringifyValue(onObj)}`)
  parts.push(`  actions: ${stringifyValue(trigger.actions)}`)
  if (trigger.schedule) parts.push(`  schedule: ${stringifyValue(trigger.schedule)}`)
  if (trigger.retry) parts.push(`  retry: ${stringifyValue(trigger.retry)}`)

  return `import { defineTrigger } from 'struere'

export default defineTrigger({
${parts.join(",\n")},
})
`
}

function toCamelCase(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function generateIndexFile(items: Array<{ slug?: string; name?: string }>, keyField: "slug" | "name"): string {
  return items
    .map((item) => {
      const key = keyField === "slug" ? item.slug! : item.name!
      const camel = toCamelCase(key)
      return `export { default as ${camel} } from './${key}'`
    })
    .join("\n") + "\n"
}

export function generateProjectFiles(
  pullState: PullState,
  orgInfo: { id: string; slug: string; name: string },
  apiKey: string,
  convexUrl: string,
  claudeMdContent: string,
): ProjectFile[] {
  const files: ProjectFile[] = []

  files.push({
    path: "/workspace/struere.json",
    content: JSON.stringify(
      { version: "2.0", organization: { id: orgInfo.id, slug: orgInfo.slug, name: orgInfo.name } },
      null,
      2
    ),
  })

  files.push({
    path: "/workspace/package.json",
    content: JSON.stringify(
      {
        name: orgInfo.slug,
        version: "0.1.0",
        type: "module",
        scripts: { dev: "struere dev", deploy: "struere deploy", status: "struere status" },
        devDependencies: { "bun-types": "^1.0.0", typescript: "^5.3.0" },
      },
      null,
      2
    ),
  })

  files.push({
    path: "/workspace/tsconfig.json",
    content: JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          lib: ["ES2022"],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          outDir: "dist",
          rootDir: ".",
          types: ["bun-types"],
          paths: { struere: ["./.struere/index.js"] },
        },
        include: ["**/*.ts"],
        exclude: ["node_modules", "dist", ".struere"],
      },
      null,
      2
    ),
  })

  files.push({
    path: "/workspace/.env",
    content: `STRUERE_API_KEY=${apiKey}\nSTRUERE_CONVEX_URL=${convexUrl}\n`,
  })

  files.push({
    path: "/workspace/CLAUDE.md",
    content: claudeMdContent,
  })

  for (const agent of pullState.agents) {
    files.push({
      path: `/workspace/agents/${agent.slug}.ts`,
      content: generateAgentFile(agent),
    })
  }
  if (pullState.agents.length > 0) {
    files.push({
      path: "/workspace/agents/index.ts",
      content: generateIndexFile(pullState.agents, "slug"),
    })
  }

  for (const et of pullState.entityTypes) {
    files.push({
      path: `/workspace/entity-types/${et.slug}.ts`,
      content: generateEntityTypeFile(et),
    })
  }
  if (pullState.entityTypes.length > 0) {
    files.push({
      path: "/workspace/entity-types/index.ts",
      content: generateIndexFile(pullState.entityTypes, "slug"),
    })
  }

  for (const role of pullState.roles) {
    files.push({
      path: `/workspace/roles/${role.name}.ts`,
      content: generateRoleFile(role),
    })
  }
  if (pullState.roles.length > 0) {
    files.push({
      path: "/workspace/roles/index.ts",
      content: generateIndexFile(pullState.roles, "name"),
    })
  }

  for (const trigger of pullState.triggers) {
    files.push({
      path: `/workspace/triggers/${trigger.slug}.ts`,
      content: generateTriggerFile(trigger),
    })
  }
  if (pullState.triggers.length > 0) {
    files.push({
      path: "/workspace/triggers/index.ts",
      content: generateIndexFile(pullState.triggers, "slug"),
    })
  }

  const customTools = pullState.agents.flatMap((a) =>
    a.tools.filter((t) => !t.isBuiltin && !BUILTIN_PREFIXES.some((p) => t.name.startsWith(p)))
  )
  const uniqueTools = Array.from(new Map(customTools.map((t) => [t.name, t])).values())

  if (uniqueTools.length > 0) {
    const toolDefs = uniqueTools
      .map((t) => {
        const handler = t.handlerCode ?? `async (args, context, fetch) => {\n      throw new Error("TODO: implement handler")\n    }`
        return `  {
    name: ${JSON.stringify(t.name)},
    description: ${JSON.stringify(t.description)},
    parameters: ${stringifyValue(t.parameters, 4)},
    handler: ${handler},
  }`
      })
      .join(",\n")

    files.push({
      path: "/workspace/tools/index.ts",
      content: `import { defineTools } from 'struere'\n\nexport default defineTools([\n${toolDefs},\n])\n`,
    })
  } else {
    files.push({
      path: "/workspace/tools/index.ts",
      content: `import { defineTools } from 'struere'\n\nexport default defineTools([])\n`,
    })
  }

  return files
}
