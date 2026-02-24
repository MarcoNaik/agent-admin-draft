---
title: "How do I add a Struere chatbot to my website?"
description: "Embed a live AI chatbot on any webpage using the floating widget or a direct iframe"
section: "Knowledge Base"
order: 9
---

# How do I add a Struere chatbot to my website?

There are two ways to add a Struere agent to your website: a **floating widget** (chat bubble) or a **direct iframe embed**. Both work on any website — no framework or backend required.

## Option 1: Floating Chat Widget (Recommended)

Add a single script tag to your HTML. A chat bubble appears in the corner of the page. Visitors click it to open a chat window.

### Step 1: Deploy your agent

The widget uses the **production** environment. Make sure your agent is deployed:

```bash
struere deploy
```

Or deploy from the dashboard: Agents → Select agent → Deploy.

### Step 2: Get your slugs

Find your org slug and agent slug in the public chat URL:

```
https://app.struere.dev/chat/{org-slug}/{agent-slug}
```

### Step 3: Add the script tag

Add this before the closing `</body>` tag:

```html
<script
  src="https://app.struere.dev/embed/widget.js?org=YOUR_ORG_SLUG&agent=YOUR_AGENT_SLUG"
  async
  defer
></script>
```

### Step 4: Customize (optional)

Add parameters to the URL to adjust appearance and position:

```html
<script
  src="https://app.struere.dev/embed/widget.js?org=my-company&agent=support-bot&theme=light&accent=%234F46E5&position=br"
  async
  defer
></script>
```

| Parameter | Options | Default |
|-----------|---------|---------|
| `theme` | `dark`, `light` | `dark` |
| `accent` | Any hex color (URL-encoded) | `#3B82F6` |
| `position` | `br`, `bl`, `tr`, `tl` | `br` |

## Option 2: Direct Iframe Embed

If you want the chat embedded inline (not floating), use an iframe:

```html
<iframe
  src="https://app.struere.dev/embed/YOUR_ORG_SLUG/YOUR_AGENT_SLUG?theme=dark"
  style="width: 100%; height: 600px; border: none; border-radius: 12px;"
  allow="clipboard-read; clipboard-write"
  loading="lazy"
  title="Chat with our AI assistant"
></iframe>
```

This renders a clean chat interface with no header or navigation — just the input and messages.

## Framework Examples

### Next.js / React

```tsx
export default function ContactPage() {
  return (
    <div>
      <h1>Contact Us</h1>
      <iframe
        src="https://app.struere.dev/embed/my-company/support-bot?theme=dark"
        style={{ width: "100%", height: 600, border: "none", borderRadius: 12 }}
        allow="clipboard-read; clipboard-write"
        loading="lazy"
        title="Chat with our AI assistant"
      />
    </div>
  )
}
```

For the floating widget in Next.js, add it via the `Script` component:

```tsx
import Script from "next/script"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://app.struere.dev/embed/widget.js?org=my-company&agent=support-bot"
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}
```

### WordPress

Add the script tag using a custom HTML widget, or paste it in your theme's `footer.php` before `</body>`:

```html
<script
  src="https://app.struere.dev/embed/widget.js?org=my-company&agent=support-bot"
  async
  defer
></script>
```

### Static HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
</head>
<body>
  <h1>Welcome</h1>
  <p>Chat with our AI assistant using the bubble in the corner.</p>

  <script
    src="https://app.struere.dev/embed/widget.js?org=my-company&agent=support-bot&theme=light"
    async
    defer
  ></script>
</body>
</html>
```

## Listening to Chat Events

The widget sends events to your host page when the agent responds:

```javascript
window.addEventListener("struere:message", function (event) {
  console.log("Thread:", event.detail.threadId)
  console.log("Response:", event.detail.message)
})
```

You can use this to trigger actions on your page — like showing a notification, updating a counter, or logging analytics.

## Common Issues

**Widget doesn't show up**

- Check your org and agent slugs — they're case-sensitive
- Verify the agent is deployed to production (`struere deploy`)
- Look at your browser console for script loading errors

**"Agent Not Found" in the chat**

- The agent needs a production config. Deploy it first.
- Double-check slugs match the URL at `app.struere.dev/chat/{org}/{agent}`

**Content Security Policy blocks the iframe**

Add the Struere domain to your CSP `frame-src` directive:

```
Content-Security-Policy: frame-src https://app.struere.dev;
```

For more technical details, see the [Embeddable Chat Widget](../integrations/embeddable-widget) integration reference.
