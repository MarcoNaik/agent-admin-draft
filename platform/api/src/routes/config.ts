import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { NotFoundError } from '@struere/platform-shared'
import { createDb, agents, agentVersions } from '../db'
import { clerkAuth } from '../middleware/clerk'
import type { Env, AuthContext } from '../types'

export const configRoutes = new Hono<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>()

configRoutes.use('*', clerkAuth)

interface ExtractedConfig {
  name?: string
  version?: string
  description?: string
  systemPrompt?: string
  model?: {
    provider?: string
    name?: string
    temperature?: number
    maxTokens?: number
  }
  tools?: Array<{
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }>
  state?: {
    storage?: string
    ttl?: number
    prefix?: string
  }
}

configRoutes.get('/', async (c) => {
  const auth = c.get('auth')
  const agentId = c.req.param('agentId') as string
  const environment = c.req.query('environment') || 'development'
  const db = createDb(c.env.DB)

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.id, agentId),
      eq(agents.organizationId, auth.organizationId)
    ))
    .limit(1)

  if (!agent) {
    throw new NotFoundError('Agent', agentId)
  }

  const versionId = environment === 'production'
    ? agent.productionVersionId
    : agent.developmentVersionId

  if (!versionId) {
    return c.json({
      config: null,
      error: `No ${environment} version deployed`
    })
  }

  const [version] = await db
    .select()
    .from(agentVersions)
    .where(eq(agentVersions.id, versionId))
    .limit(1)

  if (!version) {
    return c.json({
      config: null,
      error: 'Version not found'
    })
  }

  const bundle = await c.env.BUNDLES.get(version.bundleKey)
  if (!bundle) {
    return c.json({
      config: null,
      error: 'Bundle not found in storage'
    })
  }

  const bundleCode = await bundle.text()
  const config = extractConfigFromBundle(bundleCode)

  return c.json({
    config,
    version: {
      id: version.id,
      version: version.version,
      bundleKey: version.bundleKey,
      bundleSize: bundleCode.length,
      configHash: version.configHash,
      metadata: version.metadata,
      deployedAt: version.deployedAt,
      deployedBy: version.deployedBy
    }
  })
})

function extractConfigFromBundle(bundleCode: string): ExtractedConfig {
  const config: ExtractedConfig = {}

  const nameMatch = bundleCode.match(/name\s*:\s*["'`]([^"'`]+)["'`]/)
  if (nameMatch) config.name = nameMatch[1]

  const versionMatch = bundleCode.match(/version\s*:\s*["'`]([^"'`]+)["'`]/)
  if (versionMatch) config.version = versionMatch[1]

  const descriptionMatch = bundleCode.match(/description\s*:\s*["'`]([^"'`]+)["'`]/)
  if (descriptionMatch) config.description = descriptionMatch[1]

  const systemPromptMatch = bundleCode.match(/systemPrompt\s*:\s*["'`]([^"'`]*(?:[^"'`\\]|\\.)*)["'`]/s)
  if (systemPromptMatch) {
    config.systemPrompt = systemPromptMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
  }

  const templateLiteralMatch = bundleCode.match(/systemPrompt\s*:\s*`([^`]*)`/s)
  if (templateLiteralMatch && !config.systemPrompt) {
    config.systemPrompt = templateLiteralMatch[1]
  }

  config.model = {}

  const providerMatch = bundleCode.match(/provider\s*:\s*["'`]([^"'`]+)["'`]/)
  if (providerMatch) config.model.provider = providerMatch[1]

  const modelNameMatch = bundleCode.match(/model\s*:\s*\{[^}]*name\s*:\s*["'`]([^"'`]+)["'`]/)
  if (modelNameMatch) {
    config.model.name = modelNameMatch[1]
  } else {
    const simpleModelMatch = bundleCode.match(/["'`](claude-[^"'`]+|gpt-[^"'`]+|gemini-[^"'`]+)["'`]/)
    if (simpleModelMatch) config.model.name = simpleModelMatch[1]
  }

  const temperatureMatch = bundleCode.match(/temperature\s*:\s*([\d.]+)/)
  if (temperatureMatch) config.model.temperature = parseFloat(temperatureMatch[1])

  const maxTokensMatch = bundleCode.match(/maxTokens\s*:\s*(\d+)/)
  if (maxTokensMatch) config.model.maxTokens = parseInt(maxTokensMatch[1])

  const tools: ExtractedConfig['tools'] = []
  const toolMatches = bundleCode.matchAll(/\{\s*name\s*:\s*["'`]([^"'`]+)["'`]\s*,\s*description\s*:\s*["'`]([^"'`]+)["'`]/g)

  for (const match of toolMatches) {
    tools.push({
      name: match[1],
      description: match[2]
    })
  }

  const simpleToolMatches = bundleCode.matchAll(/name\s*:\s*["'`]([^"'`]+)["'`][^}]*?description\s*:\s*["'`]([^"'`]+)["'`]/g)
  for (const match of simpleToolMatches) {
    if (!tools.find(t => t.name === match[1])) {
      tools.push({
        name: match[1],
        description: match[2]
      })
    }
  }

  if (tools.length > 0) {
    config.tools = tools.filter(t =>
      t.name !== config.name &&
      !t.name.includes('claude') &&
      !t.name.includes('gpt')
    )
  }

  const storageMatch = bundleCode.match(/storage\s*:\s*["'`]([^"'`]+)["'`]/)
  const ttlMatch = bundleCode.match(/ttl\s*:\s*(\d+)/)
  const prefixMatch = bundleCode.match(/prefix\s*:\s*["'`]([^"'`]+)["'`]/)

  if (storageMatch || ttlMatch || prefixMatch) {
    config.state = {}
    if (storageMatch) config.state.storage = storageMatch[1]
    if (ttlMatch) config.state.ttl = parseInt(ttlMatch[1])
    if (prefixMatch) config.state.prefix = prefixMatch[1]
  }

  return config
}
