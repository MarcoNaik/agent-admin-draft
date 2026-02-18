
function defineAgent(config) {
  if (!config.name) throw new Error('Agent name is required')
  if (!config.version) throw new Error('Agent version is required')
  if (!config.systemPrompt) throw new Error('System prompt is required')
  return {
    model: {
      provider: 'anthropic',
      name: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      maxTokens: 4096,
    },
    ...config,
  }
}

function defineRole(config) {
  if (!config.name) throw new Error('Role name is required')
  if (!config.policies || config.policies.length === 0) throw new Error('Role must have at least one policy')
  for (const policy of config.policies) {
    if (!policy.resource) throw new Error('Policy resource is required')
    if (!policy.actions || policy.actions.length === 0) throw new Error('Policy must have at least one action')
    if (!policy.effect) throw new Error('Policy effect is required')
  }
  return {
    ...config,
    scopeRules: config.scopeRules || [],
    fieldMasks: config.fieldMasks || [],
  }
}

function validateObjectProperties(schema, path) {
  if (schema.type === 'object' && !schema.properties) {
    throw new Error('Schema field "' + path + '" has type "object" but is missing "properties". All object fields must declare their properties.')
  }
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      validateObjectProperties(value, path ? path + '.' + key : key)
    }
  }
  if (schema.items) {
    validateObjectProperties(schema.items, path + '[]')
  }
}

function defineEntityType(config) {
  if (!config.name) throw new Error('Entity type name is required')
  if (!config.slug) throw new Error('Entity type slug is required')
  if (!config.schema) throw new Error('Entity type schema is required')
  if (config.schema.type !== 'object') throw new Error('Entity type schema must be an object type')
  if (config.schema.properties) {
    for (const [key, value] of Object.entries(config.schema.properties)) {
      validateObjectProperties(value, key)
    }
  }
  if (config.boundToRole !== undefined && config.boundToRole === '') throw new Error('boundToRole cannot be an empty string')
  if (config.userIdField !== undefined && !config.boundToRole) throw new Error('userIdField requires boundToRole to be set')
  const userIdField = config.boundToRole && !config.userIdField ? 'userId' : config.userIdField
  return {
    ...config,
    searchFields: config.searchFields || [],
    userIdField,
  }
}

function defineTrigger(config) {
  const VALID_ACTIONS = ['created', 'updated', 'deleted']
  if (!config.name) throw new Error('Trigger name is required')
  if (!config.slug) throw new Error('Trigger slug is required')
  if (!config.on) throw new Error('Trigger "on" configuration is required')
  if (!config.on.entityType) throw new Error('Trigger entityType is required')
  if (!config.on.action || !VALID_ACTIONS.includes(config.on.action)) throw new Error('Trigger action must be one of: ' + VALID_ACTIONS.join(', '))
  if (!config.actions || config.actions.length === 0) throw new Error('Trigger must have at least one action')
  for (const action of config.actions) {
    if (!action.tool) throw new Error('Trigger action tool is required')
    if (!action.args || typeof action.args !== 'object') throw new Error('Trigger action args must be an object')
  }
  return config
}

function wrapHandler(name, handler) {
  return async (params, context) => {
    try {
      return await handler(params, context)
    } catch (error) {
      console.error('Tool "' + name + '" execution error:', error)
      throw error
    }
  }
}

function defineTools(tools) {
  return tools.map((tool) => {
    if (!tool.name) throw new Error('Tool name is required')
    if (!tool.description) throw new Error('Tool "' + tool.name + '" requires a description')
    if (!tool.parameters) throw new Error('Tool "' + tool.name + '" requires parameters definition')
    if (typeof tool.handler !== 'function') throw new Error('Tool "' + tool.name + '" requires a handler function')
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      handler: wrapHandler(tool.name, tool.handler),
      _originalHandler: tool.handler,
    }
  })
}

function defineConfig(config) {
  const defaultConfig = {
    port: 3000,
    host: 'localhost',
    cors: { origins: ['http://localhost:3000'], credentials: true },
    logging: { level: 'info', format: 'pretty' },
    auth: { type: 'none' },
  }
  return {
    ...defaultConfig,
    ...config,
    cors: config.cors ? { ...defaultConfig.cors, ...config.cors } : defaultConfig.cors,
    logging: config.logging ? { ...defaultConfig.logging, ...config.logging } : defaultConfig.logging,
    auth: config.auth ? { ...defaultConfig.auth, ...config.auth } : defaultConfig.auth,
  }
}

export { defineAgent, defineRole, defineEntityType, defineTrigger, defineTools, defineConfig }
