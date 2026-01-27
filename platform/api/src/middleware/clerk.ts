import { createMiddleware } from 'hono/factory'
import { verifyToken } from '@clerk/backend'
import { AuthenticationError, AuthorizationError } from '@struere/platform-shared'
import type { Env, AuthContext } from '../types'

export const clerkAuth = createMiddleware<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verifyToken(token, {
      secretKey: c.env.CLERK_SECRET_KEY,
      authorizedParties: [c.env.CLERK_AUTHORIZED_PARTY || 'https://struere.dev']
    })

    const userId = payload.sub
    const orgId = payload.org_id || payload.metadata?.organizationId as string
    const email = payload.email as string || ''

    if (!orgId) {
      throw new AuthenticationError('No organization associated with user')
    }

    c.set('auth', {
      clerkUserId: userId,
      userId: payload.metadata?.internalUserId as string || userId,
      organizationId: orgId,
      email
    })

    await next()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    throw new AuthenticationError('Invalid or expired token')
  }
})

export const clerkWebhook = createMiddleware<{
  Bindings: Env
}>(async (c, next) => {
  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new AuthenticationError('Missing webhook signature headers')
  }

  await next()
})
