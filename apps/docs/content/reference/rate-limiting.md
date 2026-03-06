---
title: "Rate Limiting"
description: "API rate limits, credit-based throttling, and managing usage"
section: "Reference"
order: 7
---

# Rate Limiting

Struere enforces rate limits at multiple layers to protect platform stability and ensure fair usage across organizations. This page covers API rate limits, credit-based throttling, per-request execution bounds, and LLM provider limits.

## API Rate Limits

Chat endpoints are rate-limited using token bucket and fixed window algorithms via `convex-helpers/server/rateLimit`.

### Chat Endpoints

Both `/v1/chat` and `/v1/agents/:slug/chat` are subject to two independent rate limits:

| Limit | Algorithm | Rate | Burst Capacity |
|-------|-----------|------|----------------|
| Per API key | Token bucket | 30 requests/minute | 10 burst |
| Per organization | Token bucket | 100 requests/minute | 30 burst |

Both limits are checked on every chat request. If either limit is exceeded, the request is rejected.

The token bucket algorithm allows short bursts above the sustained rate. For example, the per-key limit allows a burst of up to 10 requests at once, then refills at 30 requests per minute.

### Auth Refresh

The `/v1/auth/refresh` endpoint has its own rate limit:

| Limit | Algorithm | Rate |
|-------|-----------|------|
| Per session | Fixed window | 20 requests/minute |

## 429 Response Format

When a rate limit is exceeded, the API returns a `429` status with a JSON body and a `Retry-After` header:

```json
{
  "error": "Rate limit exceeded",
  "retryAt": 1709312456789
}
```

| Field | Type | Description |
|-------|------|-------------|
| `error` | `string` | Always `"Rate limit exceeded"` |
| `retryAt` | `number` | Unix timestamp (milliseconds) indicating when the limit resets |

The `Retry-After` response header contains the number of seconds to wait before retrying (minimum 1 second).

### Handling 429 in Code

**TypeScript:**

```typescript
const response = await fetch("https://your-deployment.convex.site/v1/agents/scheduler/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_prod_xyz789",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: "Book a session" }),
})

if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5")
  await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
}
```

**Python:**

```python
import time
import requests

response = requests.post(
    "https://your-deployment.convex.site/v1/agents/scheduler/chat",
    headers={
        "Authorization": "Bearer sk_prod_xyz789",
        "Content-Type": "application/json",
    },
    json={"message": "Book a session"},
)

if response.status_code == 429:
    retry_after = int(response.headers.get("Retry-After", "5"))
    time.sleep(retry_after)
```

## Credit-Based Throttling

When using platform-managed API keys (as opposed to your own provider keys), LLM usage is deducted from your organization's credit balance. Credits act as a soft limit on usage.

### How It Works

1. Before each chat execution, the platform checks your organization's effective balance against the estimated minimum cost for the configured model
2. If the balance is insufficient, the request fails with: `"Insufficient credits. Please add credits to your account to continue using platform API keys."`
3. After execution, the actual token usage is deducted based on the model's per-token pricing

The minimum cost check estimates the cost of processing 1,000 input tokens at the model's input rate. This prevents requests from starting when the balance is clearly too low to complete.

### Credit Balance

Credit balances are tracked in microdollars (1 USD = 1,000,000 microdollars). Deductions are recorded as transactions and periodically reconciled against the balance.

Pending deductions (transactions not yet reconciled) are subtracted from the cached balance to calculate the effective balance in real time.

### Adding Credits

Credits can be added through the dashboard via Polar checkout. The minimum purchase is $1.00. Credits are added to your organization's balance immediately after payment confirmation via the `/webhook/polar` webhook.

## Per-Request Execution Bounds

Each chat request has built-in execution bounds that limit resource consumption:

| Bound | Value | Description |
|-------|-------|-------------|
| Tool call iterations | 10 | Maximum LLM loop steps per request (`stepCountIs(10)`) |
| Multi-agent depth | 3 | Maximum delegation depth for `agent.chat` tool calls |
| Cycle detection | Enabled | Prevents A -> B -> A delegation loops |
| LLM max retries | 2 | Retries on transient LLM failures |
| Convex action timeout | 10 minutes | Hard timeout on the server-side action |

The 10-iteration tool call limit means a single chat request can make at most 10 LLM calls (each of which may include tool calls). If the agent has not finished after 10 steps, the last generated text is returned.

## LLM Provider Rate Limits

Each LLM provider enforces its own rate limits independently of Struere's platform limits:

| Provider | Limit Type | Notes |
|----------|------------|-------|
| xAI | Per-key RPM/TPM | Limits vary by model and account tier |
| Anthropic | Per-key RPM/TPM | Limits vary by usage tier |
| OpenAI | Per-key RPM/TPM | Limits vary by organization tier |
| Google | Per-key RPM/TPM | Limits vary by project and model |

When the platform encounters a provider rate limit (HTTP 429 from the provider), it retries up to 2 times before failing the request.

### Platform Keys vs. Your Own Keys

| Mode | Rate Limits |
|------|-------------|
| **Platform keys** | Shared across all Struere users of that provider. Higher contention during peak usage. |
| **Your own keys** | Dedicated limits for your organization. Configure in **Settings > Providers** in the dashboard. |

Using your own provider keys gives you dedicated rate limits and removes dependence on shared platform capacity.

## Convex Platform Limits

Struere runs on Convex, which enforces its own platform-level limits:

| Limit | Value |
|-------|-------|
| Document size | 1 MB |
| Function execution | 10 minutes (actions), 2 seconds (mutations/queries) |
| Request body size | 8 MB |
| Bandwidth | See [Convex docs](https://docs.convex.dev/production/state/limits) |

These limits apply to all Convex functions including chat actions, tool executions, and webhook handlers.

## Recommendations

- **Use your own provider keys** for production workloads. This gives you dedicated LLM rate limits and avoids contention with other platform users. Configure keys in **Settings > Providers**.
- **Monitor usage** in the dashboard under **Settings > Usage** to track credit consumption and request volume.
- **Implement retry logic** with exponential backoff when you receive 429 responses. Use the `Retry-After` header to determine wait time.
- **Distribute load across API keys** if you need more than 30 requests/minute from a single integration. Each API key has its own per-key bucket.
- **Choose cost-effective models** for high-volume agents. Models like `grok-4-1-fast` or `claude-haiku-4-5` offer strong capabilities at lower per-token cost, reducing credit consumption. See [Model Configuration](../reference/model-configuration) for pricing details.

For the full list of platform limits, see [Limits and Quotas](../reference/limits).
