import { Buffer as BufferPolyfill } from "buffer"
globalThis.Buffer = BufferPolyfill as unknown as typeof Buffer
import { Polar } from "@convex-dev/polar"
import { components } from "./_generated/api"
import { makeFunctionReference } from "convex/server"

const getAuthInfoWithEmailRef = makeFunctionReference<"query">("polarHelpers:getAuthInfoWithEmail")

export const polar = new Polar(components.polar, {
  products: {
    starter: process.env.POLAR_STARTER_PRODUCT_ID ?? "",
    pro: process.env.POLAR_PRO_PRODUCT_ID ?? "",
  },
  getUserInfo: async (ctx) => {
    const auth = await ctx.runQuery(getAuthInfoWithEmailRef) as { organizationId: string; email: string } | null
    if (!auth) throw new Error("Not authenticated")
    return {
      userId: auth.organizationId,
      email: auth.email,
    }
  },
  organizationToken: process.env.POLAR_ORGANIZATION_TOKEN,
  server: (process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox",
})
