import { z } from 'zod'

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/)
})

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100)
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['agent:read', 'agent:write', 'agent:execute', 'agent:deploy'])),
  expiresAt: z.string().datetime().optional()
})

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional()
})

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'paused']).optional()
})

export const deployAgentSchema = z.object({
  bundle: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  environment: z.enum(['preview', 'staging', 'production']).default('preview'),
  metadata: z.object({
    modelProvider: z.string(),
    modelName: z.string(),
    toolCount: z.number(),
    bundleSize: z.number()
  })
})

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(100000),
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  stream: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional()
})

export const syncMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth'),
    apiKey: z.string()
  }),
  z.object({
    type: z.literal('sync'),
    agentSlug: z.string(),
    bundle: z.string(),
    configHash: z.string()
  }),
  z.object({
    type: z.literal('ping')
  }),
  z.object({
    type: z.literal('unsync')
  })
])

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type CreateAgentInput = z.infer<typeof createAgentSchema>
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
export type DeployAgentInput = z.infer<typeof deployAgentSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
export type SyncMessageInput = z.infer<typeof syncMessageSchema>
