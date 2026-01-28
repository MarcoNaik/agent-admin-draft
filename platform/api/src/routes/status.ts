import { Hono } from 'hono'
import { createRemoteJWKSet, jwtVerify, decodeJwt, decodeProtectedHeader } from 'jose'
import type { Env } from '../types'

const CLERK_DOMAIN = 'clerk.struere.dev'
const JWKS_URL = `https://${CLERK_DOMAIN}/.well-known/jwks.json`
const EXPECTED_ISSUER = `https://${CLERK_DOMAIN}`

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  data?: unknown
  duration?: number
}

export const statusRoutes = new Hono<{ Bindings: Env }>()

statusRoutes.get('/', async (c) => {
  const results: TestResult[] = []
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  results.push({
    name: 'env_clerk_secret_key',
    status: c.env.CLERK_SECRET_KEY ? 'pass' : 'fail',
    message: c.env.CLERK_SECRET_KEY ? 'CLERK_SECRET_KEY is set' : 'CLERK_SECRET_KEY is missing',
    data: c.env.CLERK_SECRET_KEY ? `${c.env.CLERK_SECRET_KEY.slice(0, 10)}...` : null
  })

  results.push({
    name: 'env_clerk_publishable_key',
    status: c.env.CLERK_PUBLISHABLE_KEY ? 'pass' : 'fail',
    message: c.env.CLERK_PUBLISHABLE_KEY ? 'CLERK_PUBLISHABLE_KEY is set' : 'CLERK_PUBLISHABLE_KEY is missing',
    data: c.env.CLERK_PUBLISHABLE_KEY ? c.env.CLERK_PUBLISHABLE_KEY : null
  })

  let jwksData: { keys: Array<{ kid: string; kty: string; alg: string }> } | null = null
  const jwksFetchStart = Date.now()
  try {
    const response = await fetch(JWKS_URL, {
      headers: { 'User-Agent': 'struere-api/1.0' }
    })
    const jwksFetchDuration = Date.now() - jwksFetchStart

    if (response.ok) {
      const text = await response.text()
      try {
        jwksData = JSON.parse(text)
        results.push({
          name: 'jwks_fetch',
          status: 'pass',
          message: `Successfully fetched JWKS from ${JWKS_URL}`,
          data: { status: response.status, keyCount: jwksData?.keys?.length },
          duration: jwksFetchDuration
        })
      } catch (parseErr) {
        results.push({
          name: 'jwks_fetch',
          status: 'fail',
          message: 'JWKS response is not valid JSON',
          data: { status: response.status, body: text.slice(0, 200) },
          duration: jwksFetchDuration
        })
      }
    } else {
      results.push({
        name: 'jwks_fetch',
        status: 'fail',
        message: `Failed to fetch JWKS: HTTP ${response.status}`,
        data: { status: response.status, statusText: response.statusText },
        duration: jwksFetchDuration
      })
    }
  } catch (fetchErr) {
    results.push({
      name: 'jwks_fetch',
      status: 'fail',
      message: `Network error fetching JWKS: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown'}`,
      data: { error: String(fetchErr) },
      duration: Date.now() - jwksFetchStart
    })
  }

  if (jwksData?.keys?.length) {
    results.push({
      name: 'jwks_keys_present',
      status: 'pass',
      message: `JWKS contains ${jwksData.keys.length} key(s)`,
      data: jwksData.keys.map(k => ({ kid: k.kid, kty: k.kty, alg: k.alg }))
    })
  } else {
    results.push({
      name: 'jwks_keys_present',
      status: 'fail',
      message: 'JWKS contains no keys',
      data: jwksData
    })
  }

  if (!token) {
    results.push({
      name: 'token_present',
      status: 'skip',
      message: 'No Authorization Bearer token provided - add header to test JWT verification'
    })
    return c.json({ tests: results, summary: summarize(results) })
  }

  results.push({
    name: 'token_present',
    status: 'pass',
    message: 'Authorization Bearer token provided',
    data: { length: token.length, preview: `${token.slice(0, 20)}...${token.slice(-10)}` }
  })

  let decodedHeader: { kid?: string; alg?: string; typ?: string } | null = null
  try {
    decodedHeader = decodeProtectedHeader(token)
    results.push({
      name: 'token_header_decode',
      status: 'pass',
      message: 'Successfully decoded JWT header',
      data: decodedHeader
    })
  } catch (headerErr) {
    results.push({
      name: 'token_header_decode',
      status: 'fail',
      message: `Failed to decode JWT header: ${headerErr instanceof Error ? headerErr.message : 'Unknown'}`,
      data: { error: String(headerErr) }
    })
  }

  let decodedPayload: { iss?: string; sub?: string; exp?: number; iat?: number; azp?: string } | null = null
  try {
    decodedPayload = decodeJwt(token)
    results.push({
      name: 'token_payload_decode',
      status: 'pass',
      message: 'Successfully decoded JWT payload',
      data: {
        iss: decodedPayload.iss,
        sub: decodedPayload.sub,
        azp: decodedPayload.azp,
        exp: decodedPayload.exp,
        iat: decodedPayload.iat,
        expDate: decodedPayload.exp ? new Date(decodedPayload.exp * 1000).toISOString() : null
      }
    })
  } catch (payloadErr) {
    results.push({
      name: 'token_payload_decode',
      status: 'fail',
      message: `Failed to decode JWT payload: ${payloadErr instanceof Error ? payloadErr.message : 'Unknown'}`,
      data: { error: String(payloadErr) }
    })
  }

  if (decodedPayload?.iss) {
    const issuerMatch = decodedPayload.iss === EXPECTED_ISSUER
    results.push({
      name: 'token_issuer_match',
      status: issuerMatch ? 'pass' : 'fail',
      message: issuerMatch
        ? `Issuer matches expected: ${EXPECTED_ISSUER}`
        : `Issuer mismatch: got "${decodedPayload.iss}", expected "${EXPECTED_ISSUER}"`,
      data: { actual: decodedPayload.iss, expected: EXPECTED_ISSUER }
    })
  }

  if (decodedPayload?.exp) {
    const now = Math.floor(Date.now() / 1000)
    const isExpired = decodedPayload.exp < now
    const expiresIn = decodedPayload.exp - now
    results.push({
      name: 'token_not_expired',
      status: isExpired ? 'fail' : 'pass',
      message: isExpired
        ? `Token expired ${Math.abs(expiresIn)} seconds ago`
        : `Token expires in ${expiresIn} seconds`,
      data: { exp: decodedPayload.exp, now, expiresIn }
    })
  }

  if (decodedHeader?.kid && jwksData?.keys) {
    const matchingKey = jwksData.keys.find(k => k.kid === decodedHeader?.kid)
    results.push({
      name: 'token_kid_in_jwks',
      status: matchingKey ? 'pass' : 'fail',
      message: matchingKey
        ? `Token kid "${decodedHeader.kid}" found in JWKS`
        : `Token kid "${decodedHeader.kid}" NOT found in JWKS`,
      data: {
        tokenKid: decodedHeader.kid,
        jwksKids: jwksData.keys.map(k => k.kid),
        match: !!matchingKey
      }
    })
  }

  const verifyStart = Date.now()
  try {
    const JWKS = createRemoteJWKSet(new URL(JWKS_URL))
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: EXPECTED_ISSUER,
      clockTolerance: 60
    })
    results.push({
      name: 'token_verify_jose',
      status: 'pass',
      message: 'JWT verification with jose succeeded',
      data: { sub: payload.sub },
      duration: Date.now() - verifyStart
    })
  } catch (verifyErr) {
    results.push({
      name: 'token_verify_jose',
      status: 'fail',
      message: `JWT verification with jose failed: ${verifyErr instanceof Error ? verifyErr.message : 'Unknown'}`,
      data: { error: String(verifyErr), stack: verifyErr instanceof Error ? verifyErr.stack : null },
      duration: Date.now() - verifyStart
    })
  }

  const verifyNoIssuerStart = Date.now()
  try {
    const JWKS = createRemoteJWKSet(new URL(JWKS_URL))
    const { payload } = await jwtVerify(token, JWKS, {
      clockTolerance: 60
    })
    results.push({
      name: 'token_verify_jose_no_issuer',
      status: 'pass',
      message: 'JWT verification without issuer check succeeded',
      data: { sub: payload.sub, iss: payload.iss },
      duration: Date.now() - verifyNoIssuerStart
    })
  } catch (verifyErr) {
    results.push({
      name: 'token_verify_jose_no_issuer',
      status: 'fail',
      message: `JWT verification without issuer check failed: ${verifyErr instanceof Error ? verifyErr.message : 'Unknown'}`,
      data: { error: String(verifyErr) },
      duration: Date.now() - verifyNoIssuerStart
    })
  }

  try {
    const response = await fetch(`https://api.clerk.com/v1/tokens/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    })
    const data = await response.json()
    results.push({
      name: 'token_verify_clerk_api',
      status: response.ok ? 'pass' : 'fail',
      message: response.ok
        ? 'Clerk API token verification succeeded'
        : `Clerk API token verification failed: ${response.status}`,
      data: { status: response.status, response: data }
    })
  } catch (clerkErr) {
    results.push({
      name: 'token_verify_clerk_api',
      status: 'fail',
      message: `Clerk API call failed: ${clerkErr instanceof Error ? clerkErr.message : 'Unknown'}`,
      data: { error: String(clerkErr) }
    })
  }

  return c.json({
    tests: results,
    summary: summarize(results),
    config: {
      clerkDomain: CLERK_DOMAIN,
      jwksUrl: JWKS_URL,
      expectedIssuer: EXPECTED_ISSUER
    }
  })
})

function summarize(results: TestResult[]) {
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  return { passed, failed, skipped, total: results.length }
}
