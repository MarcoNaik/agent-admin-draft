import { v } from "convex/values"
import { action, internalAction } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { polar } from "./polarClient"

export const { generateCustomerPortalUrl } = polar.api()

const getAuthInfoWithEmailRef = makeFunctionReference<"query">("polarHelpers:getAuthInfoWithEmail")

export const checkoutStarter = action({
  args: {
    origin: v.string(),
    successUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(getAuthInfoWithEmailRef) as { organizationId: string; email: string } | null
    if (!auth) throw new Error("Not authenticated")
    const productId = polar.products.starter
    if (!productId) throw new Error("Starter product not configured")
    const checkout = await polar.createCheckoutSession(ctx, {
      productIds: [productId],
      userId: auth.organizationId,
      email: auth.email,
      origin: args.origin,
      successUrl: args.successUrl,
    })
    return { url: checkout.url }
  },
})

export const checkoutPro = action({
  args: {
    origin: v.string(),
    successUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(getAuthInfoWithEmailRef) as { organizationId: string; email: string } | null
    if (!auth) throw new Error("Not authenticated")
    const productId = polar.products.pro
    if (!productId) throw new Error("Pro product not configured")
    const checkout = await polar.createCheckoutSession(ctx, {
      productIds: [productId],
      userId: auth.organizationId,
      email: auth.email,
      origin: args.origin,
      successUrl: args.successUrl,
    })
    return { url: checkout.url }
  },
})

export const buyCredits = action({
  args: {
    amount: v.number(),
    successUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(getAuthInfoWithEmailRef) as { organizationId: string; email: string } | null
    if (!auth) throw new Error("Not authenticated")
    if (args.amount < 100) throw new Error("Minimum purchase is $1.00")

    const productId = process.env.POLAR_PRODUCT_ID
    if (!productId) throw new Error("Credit purchase product not configured")

    const polarBase = process.env.POLAR_SERVER === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh"
    const resp = await fetch(`${polarBase}/v1/checkouts/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.POLAR_ORGANIZATION_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [productId],
        prices: {
          [productId]: [{
            amount_type: "fixed",
            price_amount: args.amount,
            price_currency: "usd",
          }],
        },
        success_url: args.successUrl,
        customer_email: auth.email,
        metadata: {
          organizationId: auth.organizationId,
        },
      }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`Checkout failed: ${text}`)
    }

    const checkout = await resp.json() as { url: string }
    return { url: checkout.url }
  },
})

export const syncProducts = internalAction({
  handler: async (ctx) => {
    await polar.syncProducts(ctx)
  },
})
