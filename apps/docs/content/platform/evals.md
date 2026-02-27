---
title: "Evaluations"
description: "Test agent behavior with automated assertions and LLM-as-judge scoring"
section: "Platform Concepts"
order: 7
---

# Evaluations

Evaluations (evals) let you test agent behavior with automated assertions and LLM-as-judge scoring. Define test suites in YAML, sync them with `struere dev`, and run them from the dashboard or CLI.

## How It Works

```
evals/*.eval.yaml          struere dev           Dashboard / CLI
   (define)        ──────►  (sync)  ──────►   (run & review)
                                                    │
                                                    ▼
                                              Agent executes
                                              each turn, then
                                              assertions evaluate
                                              the responses
```

1. You define eval suites as YAML files in `evals/`
2. `struere dev` syncs them to Convex (like agents and entity types)
3. Trigger runs from the dashboard or CLI (`struere eval run <suite-slug>`)
4. Each case plays out a multi-turn conversation, then assertions evaluate the agent's responses
5. Results are persisted with full conversation history, tool calls, and scores

## YAML Format

```yaml
suite: "Customer Support Tests"
slug: "customer-support-tests"
agent: "support"
description: "Verify the support agent handles common requests correctly"
tags: ["regression", "tools"]
judgeModel: "claude-haiku-4-5-20251001"
judgePrompt: "Be strict on factual accuracy but lenient on phrasing."

cases:
  - name: "Greeting test"
    description: "Agent introduces itself"
    turns:
      - user: "Hello, who are you?"
        assertions:
          - type: llm_judge
            criteria: "Response is polite, introduces itself, and offers to help"
            weight: 3
          - type: contains
            value: "help"

  - name: "Tool usage test"
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

## Suite Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `suite` | Yes | Display name |
| `slug` | Yes | Unique identifier (used for sync) |
| `agent` | Yes | Agent slug to test (must exist in `agents/`) |
| `description` | No | What this suite tests |
| `tags` | No | Tags for filtering and organization |
| `judgeModel` | No | LLM model for `llm_judge` assertions (default: `claude-haiku-4-5-20251001`) |
| `judgePrompt` | No | Custom instructions for the judge LLM (e.g., strictness level, focus areas) |
| `judgeContext` | No | Reference data or ground-truth information provided to the judge |

## Cases and Turns

Each case defines a multi-turn conversation to test:

```yaml
cases:
  - name: "Refund request flow"
    description: "Agent should look up order, then process refund"
    turns:
      - user: "I need a refund for order #123"
        assertions:
          - type: tool_called
            value: "entity.query"
          - type: llm_judge
            criteria: "Agent acknowledges the request and looks up the order"

      - user: "Yes, please process it"
        assertions:
          - type: tool_called
            value: "entity.update"
          - type: llm_judge
            criteria: "Agent confirms the refund was processed"

    finalAssertions:
      - type: llm_judge
        criteria: "Agent handled the complete refund flow professionally"
        weight: 5
```

**Turn fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `user` | Yes | The user message sent to the agent |
| `assertions` | No | Assertions evaluated after the agent responds to this turn |

**Case fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name |
| `description` | No | What this case tests |
| `tags` | No | Tags for filtering |
| `turns` | Yes | Ordered list of user messages and per-turn assertions |
| `finalAssertions` | No | Assertions evaluated after all turns complete (evaluate overall conversation) |
| `channel` | No | Thread channel: `widget`, `whatsapp`, `api`, or `dashboard` |
| `contextParams` | No | Key-value pairs passed as thread context parameters |

## Thread Context

Agents that use `{{threadContext.channel}}` or `{{threadContext.params.*}}` in their system prompts need `channel` and `contextParams` set on the eval case. Without them, these template variables resolve empty during eval runs.

Both fields are **case-level** (not per-turn), matching real usage where a conversation always happens on a single channel with fixed context parameters.

```yaml
cases:
  - name: "WhatsApp booking flow"
    channel: whatsapp
    contextParams:
      guardianPhone: "+56912345678"
      studentName: "Mateo"
    turns:
      - user: "I want to book a session for tomorrow"
        assertions:
          - type: tool_called
            value: "entity.query"

  - name: "Widget general inquiry"
    channel: widget
    turns:
      - user: "What services do you offer?"
        assertions:
          - type: llm_judge
            criteria: "Response lists available services"
```

When a case has `channel` or `contextParams`:
- The eval thread is created with the specified channel and params
- The agent's system prompt resolves `{{threadContext.channel}}` and `{{threadContext.params.*}}` correctly
- The judge also sees the resolved system prompt for accurate evaluation

See [System Prompt Templates](/tools/system-prompt-templates) for the full list of template variables.

## Assertion Types

### `llm_judge` — LLM Evaluates Response

The most flexible assertion. An LLM judge evaluates the agent's response against your criteria and returns a score from 1-5.

```yaml
- type: llm_judge
  criteria: "Response mentions the order status and expected delivery date"
  weight: 3
```

The judge scores on a 1-5 scale:
- **5**: Fully meets criteria
- **4**: Mostly meets criteria
- **3**: Partially meets criteria (pass threshold)
- **2**: Mostly fails criteria
- **1**: Completely fails criteria

A score of 3 or higher counts as **passed**. The judge uses temperature 0 for deterministic results.

The `judgePrompt` at the suite level customizes judge behavior. For example, you can make the judge strict for safety tests or lenient for creative responses.

The `judgeContext` field provides reference data to the judge — useful for fact-checking against ground truth.

### `contains` — Substring Check

Checks if the response contains a specific substring (case-insensitive).

```yaml
- type: contains
  value: "refund"
```

### `matches` — Regex Pattern

Checks if the response matches a regex pattern (case-insensitive).

```yaml
- type: matches
  value: "order #\\d+"
```

### `tool_called` — Tool Was Used

Verifies that the agent called a specific tool during this turn.

```yaml
- type: tool_called
  value: "entity.query"
```

### `tool_not_called` — Tool Was Not Used

Verifies that a specific tool was NOT called (useful for testing guardrails).

```yaml
- type: tool_not_called
  value: "entity.delete"
```

## Weights and Scoring

Each assertion can have an optional `weight` (default: 1). Weights affect the overall score calculation:

```yaml
assertions:
  - type: llm_judge
    criteria: "Critical safety check"
    weight: 5          # This assertion matters 5x more
  - type: contains
    value: "disclaimer"
    weight: 1          # Standard weight
```

**Scoring aggregation:**
- **Per-case score**: Weighted average of all assertion scores (1-5 scale)
- **Overall run score**: Average of all case scores
- **Pass/fail**: A case passes only if ALL assertions pass

## Execution Model

When you run an eval suite (from the dashboard or via `struere eval run`):

1. A **run** record is created with status `"running"`
2. Each case is executed **asynchronously** (cases run in parallel)
3. For each case, a new **thread** is created for the agent conversation
4. Each turn sends the user message to the agent and captures the full response including tool calls
5. Assertions are evaluated against the response
6. After all turns, `finalAssertions` are evaluated against the complete conversation
7. Results are persisted with full conversation history, tool call details, and scores

**Rate limit handling:** If the LLM returns a 429 error, execution retries automatically (up to 5 times with 30-second delays).

**Token tracking:** Both agent tokens and judge tokens are tracked per case and aggregated at the run level.

## Dashboard Features

The eval dashboard provides:

- **Suite list**: All suites for an agent with last run results and pass rates
- **Run history**: Full history of runs with status, scores, duration, and token counts
- **Case results**: Expandable view showing turn-by-turn conversation, tool calls, and assertion results
- **Re-run failed**: Run only the cases that failed in a previous run
- **Cancel**: Stop a running suite
- **Export**: Copy results as Markdown

## Fixtures — Test Data for Evals

Evals run in an isolated **eval** environment with its own data. Fixtures let you define a controlled, pre-known dataset that your evals run against, so test results are predictable and reproducible.

### Fixture YAML Format

Create fixture files in `fixtures/` with the `.fixture.yaml` extension:

```yaml
name: "Classroom Data"
slug: "classroom-data"

entities:
  - ref: "teacher-alice"
    type: "teacher"
    data:
      name: "Alice Smith"
      email: "alice@school.com"
    status: "active"

  - ref: "student-bob"
    type: "student"
    data:
      name: "Bob Jones"
      grade: 5

relations:
  - from: "teacher-alice"
    to: "student-bob"
    type: "teaches"
    metadata:
      since: "2024-01-01"
```

### Fixture Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name for the fixture set |
| `slug` | Yes | Unique identifier (used for sync) |
| `entities` | Yes | List of entities to create |
| `relations` | No | List of relations between entities |

**Entity fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `ref` | Yes | Local identifier used to resolve relations (not stored in DB) |
| `type` | Yes | Entity type slug (must match an existing entity type) |
| `data` | Yes | Free-form data matching the entity type schema |
| `status` | No | Entity status (defaults to `"active"`) |

**Relation fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Source entity `ref` |
| `to` | Yes | Target entity `ref` |
| `type` | Yes | Relation type string |
| `metadata` | No | Optional metadata for the relation |

### How Fixtures Work

When `struere dev` runs, it makes two sync calls:

1. **Development** — agents, data types, roles, automations (your normal dev workflow)
2. **Eval** — agents, entity types, roles, eval suites, and fixtures

The eval environment mirrors your dev schema (types, roles, agent configs) but also receives fixture data and eval suites. Automations are **not** synced to eval to prevent side effects during test runs.

On every sync, the eval environment is reset: all existing entities and relations are deleted, then recreated from fixture YAML. This guarantees a clean, known state for every eval run.

### Eval Execution Environment

When you run an eval suite (from the dashboard or CLI), it executes in the **eval** environment. This means:

- The agent sees fixture entities via `entity.query`
- The agent can create and modify entities in eval without affecting dev or prod
- All tool calls operate in the eval environment
- Results are isolated from your real data

## CLI Commands

```bash
# Scaffold a new eval suite
struere add eval my-suite

# Scaffold a new fixture
struere add fixture classroom-data

# Sync evals and fixtures (along with all other resources)
struere dev

# Run an eval suite from the CLI
struere eval run my-suite

# Run specific cases or filter by tag
struere eval run my-suite --case "Greeting test"
struere eval run my-suite --tag regression
```

The `struere add eval` command creates `evals/{slug}.eval.yaml` with a starter template. The `struere add fixture` command creates `fixtures/{slug}.fixture.yaml`. Edit the files, then `struere dev` syncs them.

The `struere eval run` command syncs to the eval environment, executes the suite, and writes Markdown result files to `evals/runs/`. Each run creates a timestamped folder with a summary and per-case files prefixed with `PASS`, `FAIL`, or `ERROR`. The command exits with code 1 if any case failed, making it suitable for CI pipelines. See [struere eval run](/cli/eval) for full details.

## Writing Good Evals

1. **Be specific in `llm_judge` criteria.** "Response mentions the order status and delivery date" is better than "Good response"
2. **Use `contains`/`matches` for exact checks.** When you need a specific word or pattern, don't rely on the judge
3. **Use `tool_called`/`tool_not_called` for tool behavior.** Verify agents use the right tools and don't use dangerous ones
4. **Multi-turn tests catch context loss.** Test that the agent remembers information from earlier turns
5. **Use `weight` to prioritize critical assertions.** A weight-5 assertion matters 5x more than weight-1
6. **Use `finalAssertions` to evaluate overall conversation quality** after all turns complete
7. **Use `judgePrompt` to set the right strictness** per suite — strict for safety tests, lenient for creative tasks
8. **Use `judgeContext` for fact-checking** — provide ground-truth data the judge can verify against
9. **Keep cases focused.** Each case should test one specific behavior or flow
10. **Tag your suites and cases** for easy filtering (`tags: ["regression", "safety", "tools"]`)
11. **Set `channel` and `contextParams` when testing channel-specific behavior.** If your agent uses `{{threadContext.channel}}` or `{{threadContext.params.*}}`, these must be set on the case or the template variables resolve empty
