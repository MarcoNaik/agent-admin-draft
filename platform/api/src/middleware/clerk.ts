import { createMiddleware } from 'hono/factory'
import { verifyToken } from '@clerk/backend'
import { eq } from 'drizzle-orm'
import { AuthenticationError, generateId } from '@struere/platform-shared'
import { createDb, users, organizations } from '../db'
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
    const authorizedParties = [
      'https://struere.dev',
      'https://app.struere.dev',
      'http://localhost:3000',
      'http://localhost:3001'
    ]
    if (c.env.CLERK_AUTHORIZED_PARTY) {
      authorizedParties.push(c.env.CLERK_AUTHORIZED_PARTY)
    }

    const payload = await verifyToken(token, {
      secretKey: c.env.CLERK_SECRET_KEY,
      authorizedParties
    })

    const clerkUserId = payload.sub
    let internalUserId = payload.metadata?.internalUserId as string
    let orgId = payload.org_id || payload.metadata?.organizationId as string
    const email = payload.email as string || ''

    const db = createDb(c.env.DB)

    if (!orgId || !internalUserId) {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId))
        .limit(1)

      if (existingUser) {
        internalUserId = existingUser.id
        orgId = existingUser.organizationId
      } else {
        const clerkUserInfo = await fetchClerkUser(clerkUserId, c.env.CLERK_SECRET_KEY)
        const userEmail = clerkUserInfo?.email || email || `${clerkUserId}@unknown.local`
        const userName = clerkUserInfo?.name || userEmail.split('@')[0] || 'User'

        const now = new Date()
        const newOrgId = generateId('org')
        const newUserId = generateId('usr')

        await db.insert(organizations).values({
          id: newOrgId,
          name: `${userName}'s Organization`,
          slug: generateSlug(userName),
          plan: 'free',
          createdAt: now,
          updatedAt: now
        })

        await db.insert(users).values({
          id: newUserId,
          clerkId: clerkUserId,
          email: userEmail,
          name: userName,
          organizationId: newOrgId,
          role: 'owner',
          createdAt: now,
          updatedAt: now
        })

        internalUserId = newUserId
        orgId = newOrgId
      }
    }

    c.set('auth', {
      clerkUserId,
      userId: internalUserId || clerkUserId,
      organizationId: orgId,
      email
    })

    await next()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    console.error('Clerk token verification failed:', error)
    throw new AuthenticationError('Invalid or expired token')
  }
})

async function fetchClerkUser(userId: string, secretKey: string): Promise<{ email: string; name: string } | null> {
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch Clerk user:', response.status)
      return null
    }

    const data = await response.json() as {
      email_addresses?: Array<{ email_address: string }>
      first_name?: string
      last_name?: string
    }

    const email = data.email_addresses?.[0]?.email_address || ''
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || ''

    return { email, name }
  } catch (err) {
    console.error('Error fetching Clerk user:', err)
    return null
  }
}

function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
  return `${baseSlug}-${Date.now().toString(36)}`
}

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
