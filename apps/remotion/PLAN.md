# Struere Demo Video — Production Plan

## Overview
- **Duration**: 90 seconds (2700 frames at 30fps)
- **Resolution**: 1920x1080
- **Story**: Sara, dental clinic owner in Sydney, losing $12K/month from missed calls. Struere builds her an AI receptionist.
- **Key shift**: Show the REAL dashboard and studio UI, not Claude Code terminal mockups.

---

## Scene Map

| Scene | Time | Frames | What's On Screen |
|---|---|---|---|
| 1: Hook | 0:00-0:05 | 0-150 | Landing page hero with stat pills + typing prompt |
| 2: Create Agent | 0:05-0:15 | 150-450 | Dashboard + Studio panel building the agent |
| 3: Create Database | 0:15-0:25 | 450-750 | Entity table + Studio creating data type |
| 4: Test Conversation | 0:25-0:40 | 750-1200 | Full-width chat with tool call bubbles |
| 5: Create Eval | 0:40-0:50 | 1200-1500 | Agent detail Evals tab + Studio writing tests |
| 6: Run Eval | 0:50-1:00 | 1500-1800 | Eval results streaming 19/20 → fix → 20/20 |
| 7: Automation | 1:00-1:10 | 1800-2100 | Automations page with trigger detail + pipeline |
| 8A: Deploy | 1:10-1:18 | 2100-2340 | Environment switch dev→prod + deploy output |
| 8B: WhatsApp | 1:18-1:24 | 2340-2520 | Phone mockup with WhatsApp confirmation |
| 8C: End Card | 1:24-1:30 | 2520-2700 | struere.dev logo + prismatic bar + CTAs |

---

## Scene 1: HOOK (0:00-0:05)

### Second-by-Second

- **0:00-0:01**: Black fades to landing hero background. "Think. Write. Build." headline fades in with prismatic gradient text.
- **0:01-0:02**: Three stat pills appear staggered (200ms apart): "30 missed calls/day" | "$400 lost per call" | "$12,000/month". Liquid glass styling.
- **0:02-0:03**: Stat pills pulse amber. Text: "Sara runs a dental clinic in Sydney." fades in (DM Sans 24px, white/90).
- **0:03-0:04**: Hero prompt card slides up (translateY 40px→0, ease-out-soft). Liquid glass dark container with IBM Plex Mono textarea.
- **0:04-0:05**: Cursor types: "Build me a receptionist for my dental clinic..." at 35ms/char. Send button fades in. Enter key pressed at f145, prismatic flash.

### Components
- `LandingHeroMock` — adapted from `apps/web/src/components/hero-section.tsx`

### Camera
- Ken Burns zoom: scale 1.0→1.02 over 150 frames on background

---

## Scene 2: CREATE AGENT (0:05-0:15)

### Transition
Cross-dissolve from landing to dashboard. Prompt text becomes Studio user message.

### Second-by-Second

- **0:05-0:06**: Full dashboard appears. Header: "Struere" logo, "Sydney Dental" org, System/Data/Chats nav (System active), env selector amber "Development", studio toggle. Studio panel slides open (0→480px width, 300ms ease-out-soft). Config bar shows: xAI provider, grok-4-1-fast model, Platform key, green dot. Main content: Agents page with heading.
- **0:06-0:07**: User message in Studio: "Build me a receptionist agent for a dental clinic. It handles cleanings, whitening, and emergencies." (border-l-2 ocean/40)
- **0:07-0:08**: Thinking row: brain icon spinning, expands with text streaming.
- **0:08-0:10**: Tool call rows stream in (15-frame stagger):
  1. FileEdit + "Write agents/receptionist.ts" + green write badge
  2. FileEdit + "Write entity-types/appointment.ts" + green write badge
  3. Search + "Read project config" + "1 file" summary
- **0:10-0:12**: File change row expands with diff (green + lines showing defineAgent code)
- **0:12-0:14**: Assistant message streams: "Created your dental receptionist agent with appointment scheduling."
- **0:14-0:15**: Agent list updates — new "Dental Receptionist" row fades in with feed-in animation + highlight-new glow.

### Components
- `DashboardShell` — header + main + studio layout
- `DashboardHeader` — all header elements
- `StudioPanelMock` — config bar + chat
- `StudioMessageFlow` — orchestrates message/tool/thinking/file animations
- `AgentsPageMock` — agent rows

### Camera
- f240: zoom 115% centering on Studio panel (30 frames)
- f420: zoom back to 100% (30 frames)

---

## Scene 3: CREATE DATABASE (0:15-0:25)

### Transition
"Data" tab becomes active. Content cross-fades. Studio stays open.

### Second-by-Second

- **0:15-0:16**: Header nav switches to "Data". Studio shows new user message typing: "Add an appointment data type with patient name, service, date, and status."
- **0:16-0:17**: User message appears. Thinking row activates.
- **0:17-0:19**: Tool calls stream:
  1. FileEdit + "Write entity-types/appointment.ts" + write
  2. Search + "Read agents/receptionist.ts" + "1 file"
  3. FileEdit + "Patch agents/receptionist.ts" + amber patch badge
  File diff expands showing defineData code.
- **0:19-0:21**: Assistant: "Created the appointment data type and wired it to the dental-receptionist agent."
- **0:21-0:23**: Entity table appears in main content. Camera zooms 120% on table. Three sample rows fade in staggered:
  - Sarah Chen | Dental Cleaning | Thu 2:00 PM | confirmed (green badge)
  - James Wilson | Whitening | Fri 10:00 AM | scheduled (amber badge)
  - Emma Park | Emergency | Today 4:30 PM | active (green badge)
- **0:23-0:25**: Camera back to 100%. Entity type sidebar shows "appointment" with Database icon.

### Components
- `EntityTableMock` — adapted from `entity-table.tsx`

---

## Scene 4: TEST CONVERSATION (0:25-0:40)

### Transition
"Chats" tab active. Studio panel closes (480→0px). Full-width conversation page.

### Second-by-Second

- **0:25-0:27**: Conversations page appears. Left panel: thread "Sarah Chen" with preview + unread dot. Right: empty chat with agent header (avatar, "Dental Receptionist", "Online").
- **0:27-0:29**: User message bubble springs in from right: "Hi, I need a cleaning on Thursday please." (ocean bg, white text)
- **0:29-0:31**: Typing dots animate. Agent bubble slides in: "I'd be happy to help! I have availability at 2:00 PM on Thursday. Shall I book that for you?"
- **0:31-0:32**: User: "That works perfectly."
- **0:32-0:35**: Tool call bubble appears: Terminal icon + "entity.create" + green check. Expands to show JSON input/output. Agent message: "Booked: Dental Cleaning, Thursday 2:00 PM, Patient: Sarah Chen. See you then!"
- **0:35-0:38**: Camera zooms 130% on chat. Second tool bubble: "event.emit" with appointment.created. Toast notification slides in: "Appointment created: Sarah Chen"
- **0:38-0:40**: Camera back to 100%. Thread list updates (no unread dot, new preview text).

### Components
- `ConversationMock` — adapted from `chat-interface.tsx` + `tool-bubbles.tsx`

---

## Scene 5: CREATE EVAL (0:40-0:50)

### Transition
Studio reopens. "System" nav active. Main content: agent detail page, Evals tab.

### Second-by-Second

- **0:40-0:42**: Agent detail: "Dental Receptionist" header with slug, stats. Evals tab active showing empty state. Studio: user types eval request.
- **0:42-0:44**: Thinking row + tool calls: FileEdit "Write evals/receptionist-suite.ts"
- **0:44-0:47**: Diff expands showing defineEval with 20 cases (scrolls automatically).
- **0:47-0:48**: Assistant: "Created 20 eval scenarios. Running now..."
- **0:48-0:50**: Eval runs table appears with "Running" row. Progress: 0/20 → 5/20 → 10/20...

### Components
- `EvalRunMock` — adapted from eval results components

---

## Scene 6: RUN EVAL (0:50-1:00)

### Second-by-Second

- **0:50-0:53**: Camera zooms 120% on eval table. Pass rate climbs: 10→15→18→19/20. Warning tint on row. Detail panel slides open with pass/fail case list.
- **0:53-0:55**: Final: 19/20. Failed case "Australia Day public holiday" highlights red. Detail shows expected vs got.
- **0:55-0:56**: Studio assistant: "19/20 passed. One failure: Australian public holidays. I'll fix the prompt."
- **0:56-0:57**: Tool call: Patch agents/receptionist.ts. Diff shows holiday awareness added to system prompt.
- **0:57-0:58**: Assistant: "Fixed. Rerunning..."
- **0:58-1:00**: New eval run streams fast: 5→10→15→20/20. Green status. "100%" with brief scale-up celebration.

---

## Scene 7: BUILD AUTOMATION (1:00-1:10)

### Transition
Content switches to Automations page.

### Second-by-Second

- **1:00-1:02**: Automations page with empty state. Studio: user types trigger request.
- **1:02-1:04**: Tool calls: FileEdit "Write triggers/appointment-confirmation.ts". Diff shows defineTrigger code.
- **1:04-1:06**: Trigger row fades in: green dot + "Appointment Confirmation" + "When appointment is created - 1 action"
- **1:06-1:08**: Row auto-expands. Flow diagram: appointment → created → 1 action. Pipeline step: whatsapp.send with message template showing {{entity.date}} in amber.
- **1:08-1:10**: Camera zooms 115%. Recent run shows: green dot + "Completed" + "234ms". Execution expands with step detail.

### Components
- `AutomationMock` — adapted from `automations/page.tsx`

---

## Scene 8A: DEPLOY (1:10-1:18)

### Second-by-Second

- **1:10-1:12**: Camera zooms 130% on env selector. Cursor clicks. Dropdown opens. Clicks "Production". Amber dot morphs to green. Green ripple across header.
- **1:12-1:14**: Studio: user types "Deploy everything to production." Tool call: "struere deploy" running.
- **1:14-1:16**: Plan row with status dots: Agent ✓, Data ✓, Eval ✓, Trigger ✓. Deploy output: "✓ Deployed to production, 4 resources synced"
- **1:16-1:18**: Agents page in production mode. Notification toast: "Deployment complete: 4 resources synced"

### Components
- `EnvironmentSwitcher` — animated dropdown

---

## Scene 8B: WHATSAPP (1:18-1:24)

### Second-by-Second

- **1:18-1:19**: Dashboard dims (0.3 overlay). Phone mockup slides in from right.
- **1:19-1:21**: WhatsApp message bubble springs in: "Your appointment is confirmed for Thursday at 2:00 PM. Sydney Dental, 42 George St."
- **1:21-1:23**: Double blue checkmark fades in. Phone vibrates (2px shake, 3 frames).
- **1:23-1:24**: Phone + dashboard fade out together.

---

## Scene 8C: END CARD (1:24-1:30)

### Second-by-Second

- **1:24-1:26**: Stone cream bg + noise. "struere.dev" springs in (Fraunces 96px, ocean).
- **1:26-1:27**: Prismatic gradient bar appears below (400px, 4px, animated).
- **1:27-1:28**: Tagline slides up: "Build, deploy, and manage AI agents at scale." (DM Sans 32px, charcoal)
- **1:28-1:29**: Two CTA pills: "Start Building" (ocean fill) + "Read the Docs" (ghost).
- **1:29-1:30**: Hold static. Prismatic bar animates.

---

## Component Architecture

### New Components to Build (13)

| # | Component | Adapts From | Priority |
|---|---|---|---|
| 1 | `DashboardShell` | layout.tsx + header.tsx | P0 |
| 2 | `DashboardHeader` | header.tsx | P0 |
| 3 | `StudioPanelMock` | studio-panel.tsx + studio-config-bar.tsx | P0 |
| 4 | `StudioMessageFlow` | studio-message-list.tsx | P0 (hardest) |
| 5 | `AgentsPageMock` | agents/page.tsx | P1 |
| 6 | `EntityTableMock` | entity-table.tsx | P1 |
| 7 | `ConversationMock` | chat-interface.tsx + tool-bubbles.tsx | P1 |
| 8 | `EvalRunMock` | eval results components | P1 |
| 9 | `AutomationMock` | automations/page.tsx | P1 |
| 10 | `LandingHeroMock` | hero-section.tsx | P1 |
| 11 | `EnvironmentSwitcher` | header.tsx env selector | P2 |
| 12 | `CameraContainer` | New | P0 |
| 13 | `DashboardTheme` | tailwind.config.ts (dashboard) | P0 |

### Components to Update (2)

| Component | Changes |
|---|---|
| `WhatsAppNotification` | Add read receipts, watermark |
| `EndCard` | Add CTA buttons |

### Components to Delete (3)

| Component | Reason |
|---|---|
| `Terminal.tsx` | Replaced by StudioPanelMock |
| `ChatInterface.tsx` | Replaced by ConversationMock |
| `EvalResults.tsx` | Replaced by EvalRunMock |

---

## Animation Utilities to Add

```
springScale(frame, fps, config)
cameraZoom(frame, start, end, fromScale, toScale, fromX, fromY, toX, toY)
staggeredAppear(frame, index, staggerDelay, animDuration)
feedIn(frame, start)              — dashboard feed-in animation
highlightNew(frame, start)        — dashboard highlight-new glow
pulsingDot(frame)                 — status dot pulse
prismaticGlow(frame)              — gradient border animation
envSwitchRipple(frame, start)     — green ripple for env switch
```

---

## Dashboard Dark Mode Tokens

```typescript
const DASHBOARD_DARK = {
  backgroundChrome: "#0a0a0b",
  backgroundPrimary: "#0f0f10",
  backgroundSecondary: "#141416",
  backgroundTertiary: "#1c1c1f",
  foreground: "#fafafa",
  contentPrimary: "#f0f0f0",
  contentSecondary: "#a0a0a5",
  contentTertiary: "#5a5a60",
  border: "#2a2a2e",
  borderSelected: "#4a4a50",
  card: "#181819",
  primary: "#1B4F72",
  ocean: "#1B4F72",
  oceanLight: "#2C7DA0",
  amber: "#D4A853",
  amberLight: "#E8C468",
  success: "#22c55e",
  warning: "#eab308",
  destructive: "#ef4444",
}
```

---

## Data Requirements

All fake data for the video:

### Agent
```
name: "Dental Receptionist"
slug: "dental-receptionist"
model: { provider: "xai", name: "grok-4-1-fast" }
tools: ["entity.create", "entity.query", "entity.update", "calendar.freeBusy", "whatsapp.send"]
```

### Entity Type
```
name: "Appointment"
slug: "appointment"
schema: { patientName: string, service: string, date: datetime, status: string }
```

### Sample Entities
```
Sarah Chen | Dental Cleaning | Thu 2:00 PM | confirmed
James Wilson | Whitening | Fri 10:00 AM | scheduled
Emma Park | Emergency | Today 4:30 PM | active
```

### Chat Messages
```
User: "Hi, I need a cleaning on Thursday please."
Agent: "I'd be happy to help! I have availability at 2:00 PM on Thursday. Shall I book that for you?"
User: "That works perfectly."
Agent: [entity.create tool call] "Booked: Dental Cleaning, Thursday 2:00 PM..."
```

### Eval Suite
```
name: "Receptionist Edge Cases"
cases: 20 (standard booking, double booking, Australia Day, cancellation, after-hours, etc.)
first run: 19/20 (Australia Day fails)
second run: 20/20
```

### Trigger
```
name: "Appointment Confirmation"
on: appointment.created
action: whatsapp.send with "Your appointment is confirmed for {{entity.date}}..."
```

---

## Build Order

### Phase 1: Foundation
1. DashboardTheme (color tokens)
2. CameraContainer (zoom/pan wrapper)
3. Expand animations.ts
4. DashboardShell (chrome wrapper)
5. DashboardHeader

### Phase 2: Studio
6. StudioPanelMock (config bar + chat)
7. StudioMessageFlow (message orchestration engine)

### Phase 3: Page Mocks
8. AgentsPageMock
9. EntityTableMock
10. ConversationMock
11. EvalRunMock
12. AutomationMock

### Phase 4: Landing + Specials
13. LandingHeroMock
14. EnvironmentSwitcher
15. Update WhatsAppNotification
16. Update EndCard

### Phase 5: Assembly
17. Wire all scenes in DemoVideo.tsx
18. Add camera movements
19. Polish transitions
20. Timing adjustments

### Phase 6: Polish
21. Sound design markers
22. Final render test
23. Timing tweaks
