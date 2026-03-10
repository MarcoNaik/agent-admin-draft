---
name: svg-icon-builder
description: |
  Build custom SVG icons for the Struere dashboard sourced from Lucide.
  Trigger phrases: "create icon", "build icon", "new icon", "custom icon", "svg icon", "add icon", "design icon", "update icon", "fix icon", "improve icon", "regenerate icon", "replace icon"
---

# SVG Icon Builder for Struere Dashboard

This skill creates professional SVG icons for the Struere dashboard by sourcing from the **Lucide** icon library (MIT license). All icons live in `apps/dashboard/src/lib/icons-custom.tsx` and are re-exported from `apps/dashboard/src/lib/icons.ts`.

## Source Library

**Lucide** (https://lucide.dev) — MIT licensed, 24x24 viewBox, stroke-based.

Raw SVG URL pattern:
```
https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/{kebab-case-name}.svg
```

## React Component Format

Every icon follows this exact pattern:

```tsx
export const IconName = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" {...props}>
    {inner elements from Lucide}
  </svg>
)
```

### JSX Conversion Rules

When copying from raw Lucide SVGs, convert these HTML attributes to JSX:
- `stroke-width` → `strokeWidth`
- `stroke-linecap` → `strokeLinecap`
- `stroke-linejoin` → `strokeLinejoin`
- `fill-rule` → `fillRule`
- `clip-rule` → `clipRule`
- `x1`, `x2`, `y1`, `y2` stay the same (they are valid JSX)
- `cx`, `cy`, `rx`, `ry`, `r` stay the same

### Important Notes

- `import React from "react"` already exists at top of `icons-custom.tsx` — NEVER add it again
- No comments in the code
- All inner elements (`<path>`, `<circle>`, `<rect>`, `<line>`, `<ellipse>`) go directly inside the `<svg>` wrapper
- Do NOT include the outer `<svg>` tag from Lucide — use our wrapper format above

## Step-by-Step Process

### Step 1: Find the Icon

Look up the icon in the **Complete Icon Reference** section below. If the icon exists there, copy the inner elements directly.

If the icon is NOT in the reference below, fetch it from Lucide:
```
https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/{kebab-case-name}.svg
```

### Step 2: Write the React Component

Add or replace the component in `apps/dashboard/src/lib/icons-custom.tsx` using the component format above.

### Step 3: Export the Icon

Ensure the icon is exported in `apps/dashboard/src/lib/icons.ts`. Use direct exports or aliases as needed.

### Step 4: Verify

Run `bunx tsc --noEmit` from the `apps/dashboard` directory.

## Name Mapping

Our component name → Lucide kebab-case name (for fetching).

| Component | Lucide Name | Notes |
|-----------|-------------|-------|
| Activity | activity | |
| AlertTriangle | triangle-alert | Renamed in Lucide |
| ArrowDown | arrow-down | |
| ArrowLeft | arrow-left | |
| ArrowRight | arrow-right | |
| ArrowRightLeft | arrow-right-left | |
| ArrowUp | arrow-up | |
| Blocks | blocks | |
| BookOpen | book-open | |
| Bot | bot | |
| Brain | brain | |
| Building2 | building-2 | |
| Calendar | calendar | |
| Check | check | |
| CheckCheck | check-check | |
| CheckCircle | circle-check | Renamed in Lucide |
| ChevronDown | chevron-down | |
| ChevronLeft | chevron-left | |
| ChevronRight | chevron-right | |
| ChevronUp | chevron-up | |
| ChevronsUpDown | chevrons-up-down | |
| Circle | circle | |
| CircleDot | circle-dot | |
| ClipboardCopy | clipboard-copy | |
| Clock | clock | |
| Code | code | |
| Copy | copy | |
| Cpu | cpu | |
| CreditCard | credit-card | |
| Database | database | |
| DollarSign | dollar-sign | |
| Edit | square-pen | We name it Edit |
| ExternalLink | external-link | |
| FileCode | file-code | |
| FileText | file-text | |
| Filter | filter (or funnel) | Renamed to funnel in latest Lucide |
| FlaskConical | flask-conical | |
| Globe | globe | |
| HelpCircle | circle-help | Renamed in Lucide |
| ImageIcon | image | |
| Key | key | |
| Layers | layers | |
| LayoutGrid | layout-grid | |
| Link | link | |
| List | list | |
| Loader2 | loader | |
| Mic | mic | |
| Minus | minus | |
| Monitor | monitor | |
| Moon | moon | |
| MoreHorizontal | ellipsis | Renamed in Lucide |
| MoreVertical | ellipsis-vertical | Renamed in Lucide |
| PanelLeft | panel-left | |
| PanelRight | panel-right | |
| Paperclip | paperclip | |
| Play | play | |
| Plus | plus | |
| Power | power | |
| PowerOff | power-off | |
| RefreshCw | refresh-cw | |
| Repeat | repeat | |
| RotateCcw | rotate-ccw | |
| Save | save | |
| Search | search | |
| Server | server | |
| Settings | settings | |
| Shield | shield | |
| ShieldCheck | shield-check | |
| ShieldX | shield-x | |
| Skull | skull | |
| Smartphone | smartphone | |
| Sparkles | sparkles | |
| Square | square | |
| Sun | sun | |
| Table | table | |
| Terminal | terminal | |
| Timer | timer | |
| ToggleLeft | toggle-left | |
| Trash2 | trash-2 | |
| TrendingUp | trending-up | |
| Unlink | unlink | |
| User | user | |
| UserPlus | user-plus | |
| Users | users | |
| Webhook | webhook | |
| Wifi | wifi | |
| WifiOff | wifi-off | |
| Wrench | wrench | |
| X | x | |
| XOctagon | octagon-x | Renamed in Lucide |
| Zap | zap | |

### Aliased Icons (in icons.ts)

| Export Name | Source Component | Lucide Name |
|-------------|-----------------|-------------|
| AlertCircle | PixelAlertCircle | circle-alert |
| ArrowUpDown | — | arrow-up-down |
| Ban | PixelBan | ban |
| BarChart3 | — | chart-bar |
| Bell | PixelBell | bell |
| CheckCircle2 | CheckCircle | circle-check |
| Eye | PixelEye | eye |
| EyeOff | PixelEyeOff | eye-off |
| FileEdit | FileCode | file-code |
| LayoutList | List | list |
| Link2 | — | link-2 |
| Lock | PixelLock | lock |
| Mail | PixelMail | mail |
| MessageCircle | PixelMessageCircle | message-circle |
| MessageSquare | PixelMessageSquare | message-square |
| Pencil | Edit | pencil |
| Phone | PixelPhone | phone |
| Plug | Plug | plug |
| RotateCw | — | rotate-cw |
| Send | PixelSend | send |
| XCircle | PixelXCircle | circle-x |

## Complete Icon Reference

All inner SVG elements from Lucide, ready to copy into components.

### Navigation — Arrows

**ArrowDown**:
```
<path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
```

**ArrowLeft**:
```
<path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
```

**ArrowRight**:
```
<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
```

**ArrowUp**:
```
<path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
```

**ArrowRightLeft**:
```
<path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" />
```

**ArrowUpDown**:
```
<path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
```

### Navigation — Chevrons

**ChevronDown**:
```
<path d="m6 9 6 6 6-6" />
```

**ChevronLeft**:
```
<path d="m15 18-6-6 6-6" />
```

**ChevronRight**:
```
<path d="m9 18 6-6-6-6" />
```

**ChevronUp**:
```
<path d="m18 15-6-6-6 6" />
```

**ChevronsUpDown**:
```
<path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" />
```

### Status — Check/Confirm

**Check**:
```
<path d="M20 6 9 17l-5-5" />
```

**CheckCheck**:
```
<path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" />
```

**CheckCircle** (circle-check):
```
<circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
```

### Status — Alerts/Errors

**AlertTriangle** (triangle-alert):
```
<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />
```

**AlertCircle** (circle-alert):
```
<circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
```

**HelpCircle** (circle-help):
```
<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
```

**Ban**:
```
<circle cx="12" cy="12" r="10" /><path d="M4.929 4.929 19.07 19.071" />
```

**XCircle** (circle-x):
```
<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
```

**XOctagon** (octagon-x):
```
<path d="m15 9-6 6" /><path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z" /><path d="m9 9 6 6" />
```

### Status — Visibility

**Eye**:
```
<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
```

**EyeOff**:
```
<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" />
```

### Actions

**Search**:
```
<path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />
```

**Edit** (square-pen):
```
<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
```

**Pencil**:
```
<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />
```

**Copy**:
```
<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
```

**ClipboardCopy**:
```
<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M16 4h2a2 2 0 0 1 2 2v4" /><path d="M21 14H11" /><path d="m15 10-4 4 4 4" />
```

**Trash2**:
```
<path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
```

**Save**:
```
<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" />
```

**Filter** (funnel):
```
<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
```

**RefreshCw**:
```
<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
```

**RotateCcw**:
```
<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
```

**RotateCw**:
```
<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
```

**Repeat**:
```
<path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
```

### Shapes

**Circle**:
```
<circle cx="12" cy="12" r="10" />
```

**CircleDot**:
```
<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" />
```

**Square**:
```
<rect width="18" height="18" x="3" y="3" rx="2" />
```

**Plus**:
```
<path d="M5 12h14" /><path d="M12 5v14" />
```

**Minus**:
```
<path d="M5 12h14" />
```

**X**:
```
<path d="M18 6 6 18" /><path d="m6 6 12 12" />
```

### Objects

**Bell**:
```
<path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
```

**BookOpen**:
```
<path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
```

**Calendar**:
```
<path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
```

**Clock**:
```
<circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
```

**Timer**:
```
<line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" />
```

**CreditCard**:
```
<rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
```

**DollarSign**:
```
<line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
```

**Key**:
```
<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
```

**Lock**:
```
<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
```

**ImageIcon**:
```
<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
```

**Paperclip**:
```
<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
```

**Wrench**:
```
<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
```

**Layers**:
```
<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
```

### Tech

**Bot**:
```
<path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
```

**Brain**:
```
<path d="M12 18V5" /><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" /><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" /><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" /><path d="M18 18a4 4 0 0 0 2-7.464" /><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" /><path d="M6 18a4 4 0 0 1-2-7.464" /><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
```

**Code**:
```
<path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" />
```

**Cpu**:
```
<path d="M12 20v2" /><path d="M12 2v2" /><path d="M17 20v2" /><path d="M17 2v2" /><path d="M2 12h2" /><path d="M2 17h2" /><path d="M2 7h2" /><path d="M20 12h2" /><path d="M20 17h2" /><path d="M20 7h2" /><path d="M7 20v2" /><path d="M7 2v2" /><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="8" y="8" width="8" height="8" rx="1" />
```

**Database**:
```
<ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" />
```

**Server**:
```
<rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
```

**Terminal**:
```
<path d="M12 19h8" /><path d="m4 17 6-6-6-6" />
```

**Monitor**:
```
<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
```

**Smartphone**:
```
<rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
```

### Communication

**Mail**:
```
<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" />
```

**MessageSquare**:
```
<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
```

**MessageCircle**:
```
<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
```

**Phone**:
```
<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233a14 14 0 0 0 6.392 6.384" />
```

**Send**:
```
<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" />
```

**Mic**:
```
<path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" />
```

### Connectivity

**Globe**:
```
<circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
```

**Wifi**:
```
<path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" />
```

**WifiOff**:
```
<path d="M12 20h.01" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /><path d="M5 12.859a10 10 0 0 1 5.17-2.69" /><path d="M19 12.859a10 10 0 0 0-2.007-1.523" /><path d="M2 8.82a15 15 0 0 1 4.177-2.643" /><path d="M22 8.82a15 15 0 0 0-11.288-3.764" /><path d="m2 2 20 20" />
```

**Link**:
```
<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
```

**Link2**:
```
<path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" x2="16" y1="12" y2="12" />
```

**Unlink**:
```
<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" /><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" /><line x1="8" x2="8" y1="2" y2="5" /><line x1="2" x2="5" y1="8" y2="8" /><line x1="16" x2="16" y1="19" y2="22" /><line x1="19" x2="22" y1="16" y2="16" />
```

**ExternalLink**:
```
<path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
```

**Plug**:
```
<path d="M12 22v-5" /><path d="M15 8V2" /><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z" /><path d="M9 8V2" />
```

**Webhook**:
```
<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" /><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" /><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
```

### Files/Documents

**FileText**:
```
<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
```

**FileCode**:
```
<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 12.5 8 15l2 2.5" /><path d="m14 12.5 2 2.5-2 2.5" />
```

### Layout

**PanelLeft**:
```
<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" />
```

**PanelRight**:
```
<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3v18" />
```

**LayoutGrid**:
```
<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
```

**Table**:
```
<path d="M12 3v18" /><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" />
```

**List**:
```
<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />
```

**Blocks**:
```
<path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" /><rect x="14" y="2" width="8" height="8" rx="1" />
```

### Misc

**Activity**:
```
<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
```

**Zap**:
```
<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
```

**Sparkles**:
```
<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /><path d="M20 2v4" /><path d="M22 4h-4" /><circle cx="4" cy="20" r="2" />
```

**Moon**:
```
<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
```

**Sun**:
```
<circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
```

**Shield**:
```
<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
```

**ShieldCheck**:
```
<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" />
```

**ShieldX**:
```
<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m14.5 9.5-5 5" /><path d="m9.5 9.5 5 5" />
```

**Settings**:
```
<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" />
```

**MoreHorizontal** (ellipsis):
```
<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
```

**MoreVertical** (ellipsis-vertical):
```
<circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
```

**ToggleLeft**:
```
<circle cx="9" cy="12" r="3" /><rect width="20" height="14" x="2" y="5" rx="7" />
```

**Power**:
```
<path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
```

**PowerOff**:
```
<path d="M18.36 6.64A9 9 0 0 1 20.77 15" /><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68" /><path d="M12 2v4" /><path d="m2 2 20 20" />
```

**Play**:
```
<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
```

**Loader2** (loader):
```
<path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
```

**Skull**:
```
<path d="m12.5 17-.5-1-.5 1h1z" /><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="12" r="1" />
```

**FlaskConical**:
```
<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" /><path d="M6.453 15h11.094" /><path d="M8.5 2h7" />
```

**TrendingUp**:
```
<path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" />
```

**BarChart3** (chart-bar):
```
<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 16h8" /><path d="M7 11h12" /><path d="M7 6h3" />
```

**Building2**:
```
<path d="M10 12h4" /><path d="M10 8h4" /><path d="M14 21v-3a2 2 0 0 0-4 0v3" /><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" /><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
```

## File Locations

- Custom icon components: `apps/dashboard/src/lib/icons-custom.tsx`
- Icon exports and aliases: `apps/dashboard/src/lib/icons.ts`
