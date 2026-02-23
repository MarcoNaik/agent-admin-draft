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

## Common Mistakes

- **Vague judge criteria.** "Good response" is too vague. Use specific criteria like "Response mentions the order status and expected delivery date."
- **Not creating fixtures.** Without fixtures, `entity.query` returns empty results in the eval environment. Always create fixture data for your tests.
- **Testing in development.** Evals run in the isolated eval environment. Development entities are not visible during eval runs.
- **Missing agent slug.** The `agent` field must match an agent slug defined in `agents/`.

## Related

- [Evaluations](/platform/evals) — Full eval system reference
- [CLI eval command](/cli/eval) — CLI eval runner details
- [Environment Isolation](/platform/environment-isolation) — How the eval environment works
