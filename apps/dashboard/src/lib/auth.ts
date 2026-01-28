import { auth } from "@clerk/nextjs/server"

export async function getAuthToken(): Promise<string | null> {
  const { getToken, userId } = await auth()

  if (!userId) {
    console.error("[Auth] No userId - user not authenticated")
    return null
  }

  const token = await getToken()

  if (!token) {
    console.error("[Auth] getToken() returned null for userId:", userId)
    return null
  }

  return token
}

export async function requireAuthToken(): Promise<string> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error("Unauthorized")
  }
  return token
}

export async function getAuthDebugInfo() {
  const { userId, sessionId, orgId } = await auth()
  return {
    hasUserId: !!userId,
    hasSessionId: !!sessionId,
    hasOrgId: !!orgId,
    userId: userId?.slice(0, 10) + "...",
  }
}
