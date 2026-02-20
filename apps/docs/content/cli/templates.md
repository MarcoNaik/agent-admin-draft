---
title: "struere templates"
description: "Manage WhatsApp message templates from the command line"
section: "CLI"
order: 9
---

# struere templates

The `templates` command manages WhatsApp message templates directly from the CLI. Templates are required for outbound messages outside the 24-hour messaging window and must be approved by Meta before use.

## Usage

```bash
# List all templates
npx struere templates list

# Create a template from a JSON file
npx struere templates create order_update --file template.json

# Create a template with inline JSON
npx struere templates create order_update --components '[{"type":"BODY","text":"Hello {{1}}","example":{"body_text":[["World"]]}}]'

# Check template approval status
npx struere templates status order_update

# Delete a template
npx struere templates delete order_update
```

## Subcommands

### templates list

Lists all message templates for a WhatsApp connection.

```bash
npx struere templates list [options]
```

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment (`development` or `production`). Default: `development` |
| `--connection <id>` | WhatsApp connection ID. Auto-resolved if only one connection exists |
| `--json` | Output raw JSON |

**Output:**

```
✓ Found 3 templates

  Name                           Category          Language    Status
  ─────────────────────────────  ────────────────  ──────────  ────────────
  order_update                   UTILITY           en_US       APPROVED
  welcome_message                MARKETING         en_US       PENDING
  verify_otp                     AUTHENTICATION    en_US       APPROVED
```

### templates create

Creates a new message template on Meta via the Kapso proxy.

```bash
npx struere templates create <name> [options]
```

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment. Default: `development` |
| `--connection <id>` | WhatsApp connection ID |
| `--language <code>` | Language code. Default: `en_US` |
| `--category <cat>` | Category: `UTILITY`, `MARKETING`, or `AUTHENTICATION`. Default: `UTILITY` |
| `--components <json>` | Components as a JSON string |
| `--file <path>` | Read components from a JSON file |
| `--allow-category-change` | Allow Meta to reassign the category |
| `--json` | Output raw JSON |

Either `--components` or `--file` is required. The file can contain a JSON array of components or an object with a `components` key.

**Example component file (`template.json`):**

```json
[
  {
    "type": "BODY",
    "text": "Hi {{customer_name}}, your order {{order_id}} is ready for pickup.",
    "example": {
      "body_text_named_params": [
        { "param_name": "customer_name", "example": "Alex" },
        { "param_name": "order_id", "example": "ORDER-123" }
      ]
    }
  },
  {
    "type": "FOOTER",
    "text": "Reply STOP to opt out"
  }
]
```

**Output:**

```
✓ Template "order_update" created

  ID:       1234567890
  Status:   PENDING
  Category: UTILITY
```

### templates delete

Deletes a message template from Meta. This action is irreversible.

```bash
npx struere templates delete <name> [options]
```

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment. Default: `development` |
| `--connection <id>` | WhatsApp connection ID |
| `--yes` | Skip confirmation prompt |

### templates status

Checks the current approval status and details of a template.

```bash
npx struere templates status <name> [options]
```

| Flag | Description |
|------|-------------|
| `--env <environment>` | Environment. Default: `development` |
| `--connection <id>` | WhatsApp connection ID |
| `--json` | Output raw JSON |

**Output:**

```
✓ Template "order_update" found

  Name:       order_update
  Status:     APPROVED
  Category:   UTILITY
  Language:   en_US
  Components: [
                {
                  "type": "BODY",
                  "text": "Hi {{customer_name}}, your order {{order_id}} is ready."
                }
              ]
```

## Connection Resolution

All subcommands need a WhatsApp connection ID. The CLI resolves this automatically:

- **One connected number** — used automatically
- **Multiple connected numbers** — prompts you to specify `--connection <id>`
- **No connected numbers** — exits with an error

## Template Categories

| Category | Use Case |
|----------|----------|
| `UTILITY` | Transactional updates (order confirmations, appointment reminders) |
| `MARKETING` | Promotional content and offers |
| `AUTHENTICATION` | OTP/verification codes (special Meta rules apply) |

## Template Status Flow

Templates go through Meta's review process:

```
Created → PENDING → APPROVED
                 → REJECTED
                 → PAUSED
```

Use `struere templates status <name>` to check the current state.

## Component Rules

- **HEADER** (optional): TEXT, IMAGE, VIDEO, or DOCUMENT format
- **BODY** (required): main message text with variables
- **FOOTER** (optional): short text, no variables allowed
- **BUTTONS** (optional): QUICK_REPLY, URL, or PHONE_NUMBER

### Parameter Formats

- **NAMED** (recommended): `{{customer_name}}` — use `parameter_format: "NAMED"` at creation
- **POSITIONAL**: `{{1}}`, `{{2}}` — sequential, no gaps

If variables appear in HEADER or BODY, you must include examples in the component definition.

### Button Ordering

Do not interleave QUICK_REPLY buttons with URL/PHONE_NUMBER buttons.

Valid: `QUICK_REPLY, QUICK_REPLY, URL, PHONE_NUMBER`

Invalid: `QUICK_REPLY, URL, QUICK_REPLY`

## Example Workflow

```bash
# Create a template from a file
npx struere templates create order_ready \
  --category UTILITY \
  --language en_US \
  --file templates/order_ready.json

# Check if it's been approved
npx struere templates status order_ready

# List all templates
npx struere templates list

# Clean up a rejected template
npx struere templates delete order_ready --yes
```
