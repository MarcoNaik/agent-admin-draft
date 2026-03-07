---
title: "How do I test my agents with evals?"
description: "Write eval suites in YAML to test agent behavior with automated assertions and LLM-as-judge scoring"
section: "Knowledge Base"
order: 5
---

# How do I test my agents with evals?

## Quick Answer

Create YAML eval suites in `evals/`, define test cases with multi-turn conversations and assertions, sync with `struere dev`, then run from the dashboard or CLI. Evals execute in an isolated eval environment with fixture data.

## Step by Step

### 1. Scaffold an eval suite

```bash
npx struere add eval customer-support-tests
```

This creates `evals/customer-support-tests.eval.yaml`.

### 2. Write test cases

```yaml
suite: "Customer Support Tests"
slug: "customer-support-tests"
agent: "support"
description: "Verify the support agent handles common requests"
tags: ["regression"]
judgeModel: "claude-haiku-4-5-20251001"

cases:
  - name: "Greeting"
    turns:
      - user: "Hello, who are you?"
        assertions:
          - type: llm_judge
            criteria: "Response is polite, introduces itself, and offers to help"
          - type: contains
            value: "help"

  - name: "Query customers"
    turns:
      - user: "Show me all customers"
        assertions:
          - type: tool_called
            value: "entity.query"
          - type: tool_not_called
            value: "entity.delete"

  - name: "Multi-turn context"
    turns:
      - user: "My name is Alex"
        assertions:
          - type: llm_judge
            criteria: "Acknowledges the name"
      - user: "What is my name?"
        assertions:
          - type: contains
            value: "Alex"
    finalAssertions:
      - type: llm_judge
        criteria: "Agent maintained context across the entire conversation"
```

### 3. Create fixture data

Evals run against controlled test data. Create `fixtures/test-data.fixture.yaml`:

```yaml
name: "Test Customers"
slug: "test-customers"

entities:
  - ref: "customer-alice"
    type: "customer"
    data:
      name: "Alice Smith"
      email: "alice@example.com"
      plan: "pro"
    status: "active"

  - ref: "customer-bob"
    type: "customer"
    data:
      name: "Bob Jones"
      email: "bob@example.com"
      plan: "free"
```

### 4. Sync and run

```bash
npx struere dev
npx struere eval run customer-support-tests
```

Results are written to `evals/runs/` as Markdown files. The command exits with code 1 if any case fails, making it CI-friendly.

### 5. Assertion types

| Type | What it checks |
|------|----------------|
| `llm_judge` | LLM evaluates response against criteria (score 1-5, pass at 3+) |
| `contains` | Response contains substring (case-insensitive) |
| `matches` | Response matches regex pattern |
| `tool_called` | Agent called a specific tool |
| `tool_not_called` | Agent did NOT call a specific tool |

### 6. Use weights for priority

```yaml
assertions:
  - type: llm_judge
    criteria: "Never reveals internal system details"
    weight: 5
  - type: contains
    value: "help"
    weight: 1
```

Higher weight assertions have more impact on the overall score.

### 7. Test channel-specific behavior

If your agent uses `{{threadContext.channel}}` or `{{threadContext.params.*}}` in its system prompt, set `channel` and `contextParams` on the case:

```yaml
cases:
  - name: "WhatsApp greeting"
    channel: whatsapp
    contextParams:
      guardianPhone: "+56912345678"
    turns:
      - user: "Hello"
        assertions:
          - type: llm_judge
            criteria: "Response is appropriate for WhatsApp (concise, no markdown)"
```

Without these fields, template variables like `{{threadContext.channel}}` resolve empty during eval runs.

## Best Practices

### Move `tool_called` to `finalAssertions`

Agents often ask for confirmation or clarifying questions before executing a tool. If you assert `tool_called` on a single turn, it fails because the agent hasn't acted yet. Use `finalAssertions` for `tool_called` and `tool_not_called` checks — they verify the outcome across the entire conversation.

```yaml
# Bad: per-turn tool_called fails when agent confirms first
turns:
  - role: user
    content: "Book a session for tomorrow"
    assertions:
      - type: tool_called
        tool: book_session  # Fails — agent asks "What time?" first

# Good: finalAssertions checks across all turns
turns:
  - role: user
    content: "Book a session for tomorrow"
    assertions:
      - type: llm_judge
        criteria: "Agent asks for required details"
  - role: user
    content: "10am with Teacher Ana"
finalAssertions:
  - type: tool_called
    tool: book_session
```

### Include the current date in judge criteria

LLM judges don't know what today's date is. If your eval involves date-sensitive logic, include it directly in the criteria:

```yaml
assertions:
  - type: llm_judge
    criteria: "Today is 2026-03-07. Agent only shows sessions from today forward."
```

### Guard against judge hallucinations

LLM judges can hallucinate passing scores or fabricate reasoning. To mitigate this:

- Make criteria as specific as possible.
- Include expected values directly in criteria text (e.g., "Response mentions 'Ana García' as the teacher").
- Use `tool_called` / `contains` for objective checks instead of relying solely on judge reasoning.

### Connect fixture data to test cases

Every entity referenced in your test conversation must exist in fixtures. If a case says "Show me teacher Ana" but no fixture creates a teacher named Ana, the eval fails unpredictably. Align your fixture refs with the data your cases expect.

## Common Mistakes

- **Vague judge criteria.** "Good response" is too vague. Use specific criteria like "Response mentions the order status and expected delivery date."
- **Not creating fixtures.** Without fixtures, `entity.query` returns empty results in the eval environment. Always create fixture data for your tests.
- **Testing in development.** Evals run in the isolated eval environment. Development data is not visible during eval runs.
- **Missing agent slug.** The `agent` field must match an agent slug defined in `agents/`.

## Iteration Workflow

- Read eval failure details, not just scores. The judge reasoning tells you why it failed.
- Fix one thing at a time, then re-run that specific case: `struere eval --suite booking --case B16`.
- Watch for regressions. Fixing one case can break another. Always re-run the full suite after targeted fixes.
- The eval platform can return transient errors. Don't retry in a loop — make your changes, sync, and try again later.

## Related

- [Evaluations](/platform/evals) — Full eval system reference
- [CLI eval command](/cli/eval) — CLI eval runner details
- [Environment Isolation](/platform/environment-isolation) — How the eval environment works
