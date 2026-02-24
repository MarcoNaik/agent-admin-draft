import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/authorize(.*)",
  "/api/webhooks(.*)",
  "/api/cli(.*)",
  "/chat(.*)",
  "/embed(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    try {
      const session = await auth()
      if (!session.userId) {
        return session.redirectToSignIn()
      }
    } catch {
      const session = await auth()
      return session.redirectToSignIn()
    }
  }
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
