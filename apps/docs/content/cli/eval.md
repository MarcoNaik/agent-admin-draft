---
title: "struere eval run"
description: "Run eval suites from the command line and generate Markdown result reports"
section: "CLI"
order: 8
---

# struere eval run

The `eval run` command executes an eval suite against your agent, polls for completion, and writes results as Markdown files.

## Usage

```bash
# Run all cases in a suite
npx struere eval run <suite-slug>

# Run specific case(s) by name
npx struere eval run <suite-slug> --case "Greeting test"

# Run cases matching a tag
npx struere eval run <suite-slug> --tag "regression"
```

### Options

| Flag | Description |
|------|-------------|
| `--case <name...>` | Run only cases matching the given name(s). Repeatable. |
| `--tag <tag...>` | Run only cases that have at least one of the given tags. Repeatable. |

## What It Does

1. **Auto-init** and **auto-login** if needed (same as `struere dev`)
2. **Syncs** all local resources (agents, entity types, roles, eval suites, fixtures) to the **eval** environment
3. **Resolves** the suite by slug — errors with a list of available slugs if not found
4. **Filters** cases by `--case` name or `--tag` if provided
5. **Starts** the eval run on the backend
6. **Polls** for completion every 3 seconds, showing a live progress spinner
7. **Prints** a results table to the terminal
8. **Writes** Markdown files to `evals/runs/`

## Terminal Output

```
Struere Eval Run

Organization: My Org
Suite: Basic Agent Tests (basic-agent-tests)

✓ Synced to eval environment
✓ Suite resolved (4 cases)
✓ Run completed in 45.2s

Results:
  PASS  Greeting test                 4.2/5    3.1s
  FAIL  Entity query test             1.8/5    8.4s
  PASS  Multi-turn conversation       4.5/5   12.1s
  ERROR Tool restriction test           -      0.0s

2 passed, 1 failed, 1 error | Score: 3.5/5

Results saved to evals/runs/2026-02-20T14-30-00_basic-agent-tests/
```

## Output Directory

Each run creates a timestamped folder under `evals/runs/`:

```
evals/runs/
  2026-02-20T14-30-00_basic-agent-tests/
    _summary.md
    PASS_greeting-test.md
    FAIL_entity-query-test.md
    ERROR_tool-restriction-test.md
```

- **Timestamp** uses ISO format with colons replaced by hyphens for filesystem safety
- **Case filenames** are prefixed with `PASS`, `FAIL`, or `ERROR` for quick scanning
- **`_summary.md`** is underscore-prefixed to sort first in directory listings

### `_summary.md`

Contains a run-level overview with a results table and totals:

```markdown
# Eval Run: Basic Agent Tests

| Field | Value |
|-------|-------|
| Suite | Basic Agent Tests (`basic-agent-tests`) |
| Agent | basic-agent-tests |
| Timestamp | 2026-02-20T14:30:00.000Z |
| Duration | 45.2s |
| Status | completed |

## Results

| Case | Status | Score | Duration |
|------|--------|-------|----------|
| Greeting test | PASS | 4.2/5 | 3.1s |
| Entity query test | FAIL | 1.8/5 | 8.4s |

## Totals

| Metric | Value |
|--------|-------|
| Passed | 2 |
| Failed | 1 |
| Errors | 1 |
| Overall score | 3.5/5 |
| Agent tokens | 12400 |
| Judge tokens | 3200 |
```

### Per-Case Files

Each case file contains the full conversation with tool calls and assertion results:

```markdown
# Greeting test

| Field | Value |
|-------|-------|
| Status | PASS |
| Score | 4.2/5 |
| Duration | 3.1s |

## Turn 1

### User
Hello, who are you?

### Assistant
Hi! I'm the support agent. How can I help you today?

### Assertions

| Type | Result | Details |
|------|--------|--------|
| llm_judge | PASS (4/5) | Response is polite and offers help |
| contains | PASS | Response contains "help" |
```

For error cases, a simple `## Error` section replaces the turn details.

## Exit Code

The command exits with code **1** if any case failed or errored, and **0** if all cases passed. This makes it suitable for CI pipelines.

## Case Filtering

### By Name

Use `--case` to run specific cases. Names are matched case-insensitively:

```bash
npx struere eval run my-suite --case "Greeting test" --case "Tool usage test"
```

If no cases match, the command exits with a list of available case names.

### By Tag

Use `--tag` to run cases that have at least one matching tag:

```bash
npx struere eval run my-suite --tag "regression"
```

Tags are defined per-case in the YAML:

```yaml
cases:
  - name: "Greeting test"
    tags: ["regression", "basic"]
    turns:
      - user: "Hello"
```

If no cases match the tag, the command exits with a list of available tags.

## Sync Behavior

Before running, the command syncs your local resources to the **eval** environment. This ensures the backend has your latest agent configuration, entity types, roles, eval suites, and fixtures. The sync is identical to the eval-environment sync performed by `struere dev`.

## Example Workflow

```bash
# Define an eval suite
npx struere add eval my-agent-tests

# Edit evals/my-agent-tests.eval.yaml with your test cases

# Run the suite
npx struere eval run my-agent-tests

# Run only regression tests
npx struere eval run my-agent-tests --tag regression

# Check the results
cat evals/runs/*/\_summary.md
```
