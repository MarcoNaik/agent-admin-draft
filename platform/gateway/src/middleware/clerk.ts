import { createMiddleware } from 'hono/factory'
import { verifyToken } from '@clerk/backend'
import { jwtVerify } from 'jose'
import { eq } from 'drizzle-orm'
import { AuthenticationError, generateId } from '@struere/platform-shared'
import { createDb, users, organizations } from '../db'
import type { Env, AuthContext } from '../types'

async function tryCliToken(token: string, jwtSecret: string): Promise<AuthContext | null> {
  if (!jwtSecret) {
    return null
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)

    if (payload.type !== 'cli') {
      return null
    }

    return {
      clerkUserId: '',
      userId: payload.sub as string,
      organizationId: payload.org as string,
      email: (payload.email as string) || ''
    }
  } catch {
    return null
  }
}

export const clerkAuth = createMiddleware<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[ClerkAuth] Missing Authorization header')
    throw new AuthenticationError('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)

  if (!token || token.length < 10) {
    console.error('[ClerkAuth] Token is empty or too short')
    throw new AuthenticationError('Invalid token format')
  }

  const cliAuthResult = await tryCliToken(token, c.env.JWT_SECRET)
  if (cliAuthResult) {
    c.set('auth', cliAuthResult)
    await next()
    return
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: c.env.CLERK_SECRET_KEY,
      clockSkewInMs: 60000
    })

    const clerkUserId = payload.sub
    if (!clerkUserId) {
      console.error('[ClerkAuth] Token payload missing sub claim')
      throw new AuthenticationError('Invalid token: missing user ID')
    }

    const db = createDb(c.env.DB)

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1)

    let internalUserId: string
    let orgId: string

    if (existingUser) {
      internalUserId = existingUser.id
      orgId = existingUser.organizationId
    } else {
      const clerkUserInfo = await fetchClerkUser(clerkUserId, c.env.CLERK_SECRET_KEY)
      const userEmail = clerkUserInfo?.email || payload.email as string || `${clerkUserId}@unknown.local`
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
      console.log('[ClerkAuth] Created new user:', { userId: newUserId, orgId: newOrgId, email: userEmail })
    }

    c.set('auth', {
      clerkUserId,
      userId: internalUserId,
      organizationId: orgId,
      email: existingUser?.email || payload.email as string || ''
    })

    await next()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ClerkAuth] Token verification failed:', errorMessage)

    if (errorMessage.includes('token has expired') || errorMessage.includes('exp')) {
      throw new AuthenticationError('Token expired. Please sign in again.')
    }

    if (errorMessage.includes('signature')) {
      throw new AuthenticationError('Invalid token signature')
    }

    throw new AuthenticationError('Authentication failed: ' + errorMessage)
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
      console.error('[ClerkAuth] Failed to fetch user from Clerk API:', response.status)
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
    console.error('[ClerkAuth] Error fetching Clerk user:', err)
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
