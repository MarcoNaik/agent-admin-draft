# Struere Design Philosophy

## The Vision

Struere begins with **stillness at altitude** — the feeling of standing on the edge of a cliff, high above the ocean, where the air is cold, clean, and clarifying. Not dramatic, not loud. Expansive and quiet. Light is the protagonist. Sunlight cuts through atmosphere, refracts into subtle rainbows, symbolizing clarity emerging from complexity. The landscape represents grounded reality — nature, stone, wind — while the floating water cubes introduce something slightly impossible, slightly magical. Together they create tension between stability and fluidity, between what is solid and what is becoming.

At its core: **building without heaviness**. The cubes are building blocks made of water — transparent, adaptive, alive. They shift, refract, and respond to light. Creation should feel fluid, intelligent, effortless. You bring an idea, and something luminous begins to form. The experience isn't industrial or mechanical — it's calm, elegant, almost natural, as if systems assemble themselves the way light refracts through crystal.

The brand stands for: **clarity, fluid construction, quiet power, and the magic of turning thought into structure.**

## The Ignition Point

The prompt textbox is not just UI — it's the ignition point where intention turns into structure. Inspired by the immediacy of modern creation tools, the moment you type a single sentence and something tangible begins to materialize. The prompt box becomes a threshold.

It sits calm, centered, almost sacred within the landscape — like placing a thought into open air and watching it refract into form. The floating cubes echo what happens after you press enter: structured intelligence emerging from fluid input.

Building agents isn't a technical grind — it's a natural extension of thinking. You speak, and the system begins to build with you.

---

## Design Principles

### 1. Stillness Over Spectacle

Every element should feel settled, not performed. The hero background is a vast, quiet landscape — not a particle explosion or a spinning globe. Motion exists to reveal, not to impress. Parallax scrolls at 8% — just enough depth to breathe, never enough to distract. Entrance animations use long, smooth cubic-bezier curves (`0.16, 1, 0.3, 1`) that feel like objects settling into place rather than flying in.

### 2. Light as the Protagonist

The entire palette descends from light interacting with natural materials. Stone backgrounds (`#F8F6F2`, `#F1EDE7`, `#EEEBE5`) simulate warm, sunlit rock. The prismatic gradient — ocean blues through amber golds — is literal refracted light. Glassmorphism on interactive elements mimics how light bends through water and crystal. Hover states glow rather than darken. The whole page should feel like it's being lit, not painted.

### 3. Warmth, Not Coldness

Tech products default to cold blues and dark voids. Struere rejects this. The stone palette is warm and inviting — closer to paper, sandstone, and morning light than to steel and screens. Charcoal (`#2D2A26`) replaces pure black. Text uses opacity layering (`white/70`, `white/80`) to create hierarchy through transparency rather than through harsh contrast shifts.

### 4. Building Blocks Made of Water

Rigidity is the enemy. Cards, buttons, and containers use glassmorphism — transparent, with soft borders (`rgba(255,255,255,0.3)`) and backdrop filters that let the world behind them show through. The `.liquid-glass` class uses SVG displacement noise to simulate the visual distortion of looking through water. Nothing feels opaque or heavy. Interactive elements should feel like they could be rearranged, like they're floating just above the surface.

### 5. The Serif Anchor

Fraunces is the display font — a variable serif that carries weight without heaviness. It grounds the brand in craft and intentionality while staying contemporary. Headlines in Fraunces say: this was made with care. Body text in DM Sans (clean, geometric sans-serif) says: this is clear and readable. IBM Plex Mono in input fields says: this is where you write code, prompts, commands. Three fonts, three registers, one voice.

### 6. Prismatic Accents, Used Sparingly

The 9-color prismatic gradient (ocean → cyan → amber → back) represents the refraction metaphor — complexity resolved into a spectrum of clarity. It appears only at key moments: focus states, dividers, card hover borders, shimmer animations. It never fills a background or dominates a section. Like a rainbow, it's most powerful when it's fleeting and unexpected.

### 7. Staggered Revelation

Content doesn't appear all at once. Elements enter in sequence — headlines first, then taglines, then interactive elements, then secondary actions. Each delay (`500ms`, `900ms`, `2200ms`) creates a narrative: the page tells its story one beat at a time. IntersectionObserver triggers ensure below-fold content waits for the reader. This mirrors the core product metaphor: you provide a prompt, and structure assembles itself step by step.

### 8. Immediacy at the Threshold

The prompt input is the most important element on the page. It uses cycling placeholder text (typed character-by-character at variable speed with a blinking cursor) to show what's possible before the user types anything. The monospace font (IBM Plex Mono) signals that this is a place for precise input. The glass card container elevates it above the landscape — it's the altar where thought becomes structure.

### 9. Generous Negative Space

Sections breathe with `80px-112px` vertical padding. Elements are never cramped. This isn't minimalism for aesthetic purity — it's the visual equivalent of the cliff-edge feeling: open air, clear sight lines, room to think. The whitespace IS the design. It communicates confidence and calm.

### 10. Motion That Respects

All animations honor `prefers-reduced-motion`. No motion is purely decorative — each serves a purpose: guiding attention (staggered reveals), communicating depth (parallax), indicating interactivity (hover states), or demonstrating the product (demo section phases). Transitions are never shorter than 200ms and typically run 500-700ms. Nothing snaps. Everything eases.

---

## Color System

### Philosophy

The palette is derived from a single moment: sunlight hitting stone and water at altitude. Three material families, each with a role.

### Stone (Backgrounds & Surfaces)

| Token | Hex | Role |
|-------|-----|------|
| `stone-base` | `#F8F6F2` | Primary background — sunlit sandstone |
| `stone-deep` | `#F1EDE7` | Alternating sections — shadow on stone |
| `stone-card` | `#EEEBE5` | Card surfaces, footer — deeper shadow |

Stone is never white. White is sterile. Stone is warm, tactile, and grounded.

### Ocean (Primary Actions & Identity)

| Token | Hex | Role |
|-------|-----|------|
| `ocean` | `#1B4F72` | Primary actions, links, brand identity — deep water |
| `ocean-light` | `#2C7DA0` | Hover states, secondary emphasis — shallow water |

Ocean blue carries authority without coldness. It's the color of depth and clarity — you can see through it, but it has substance.

### Amber (Warmth & Accent)

| Token | Hex | Role |
|-------|-----|------|
| `amber` | `#D4A853` | Warm highlights — sunlight on water |
| `amber-light` | `#E8C468` | Softer accents — reflected light |

Amber is sunlight captured. It appears in the prismatic gradient and in moments that need warmth: pricing highlights, integration badges, active states.

### Charcoal (Text & Structure)

| Token | Hex | Role |
|-------|-----|------|
| `charcoal` | `#2D2A26` | Body text — ink on warm paper |
| `charcoal-heading` | `#1A1815` | Headlines — deeper, more present |

Never pure black. Charcoal has brown undertones that harmonize with the stone palette.

### White Opacity Scale (Hero & Glass)

On dark backgrounds (hero image), hierarchy is created through transparency:
- `white/90` — Primary text, active elements
- `white/80` — Placeholder text, secondary labels
- `white/70` — Button text, tertiary elements
- `white/60` — Borders, subtle separators
- `white/30` — Glass borders, faintest structure

---

## Typography

### Philosophy

Three fonts represent three modes of interaction: expression (Fraunces), comprehension (DM Sans), and creation (IBM Plex Mono). JetBrains Mono serves code display. Each font has one job and stays in its lane.

### Fraunces — Display & Headlines

The serif that anchors the brand. Variable weight, optical sizing. Used for the main headline ("Think. Write. Build."), section headings, and pricing numbers. Communicates craft, intentionality, and quiet confidence. Weight: Semibold (600) for headlines, Medium (500) for section headings.

### DM Sans — Body & Interface

Clean geometric sans-serif for everything that needs to be read easily: body copy, navigation, labels, descriptions. Weight: Regular (400) for body, Medium (500) for labels and small uppercase text.

### IBM Plex Mono — Input & Prompts

The monospace font for user input: the hero prompt box, CTA input fields, placeholder cycling text. Signals precision and intentionality — this is where you type commands that become structure.

### JetBrains Mono — Code Display

Reserved for code snippets and technical content within the demo section and documentation references.

### Sizing Scale

| Level | Size | Font | Weight | Context |
|-------|------|------|--------|---------|
| Display | `7xl` (80px) | Fraunces | 600 | Hero headline |
| H1 | `4xl-5xl` (36-48px) | Fraunces | 500 | Section headings |
| H2 | `2xl-3xl` (24-30px) | Fraunces | 500 | Sub-section headings |
| Body Large | `lg` (18px) | DM Sans | 400 | Section introductions |
| Body | `base` (16px) | DM Sans | 400 | Standard body copy |
| Small | `sm` (14px) | DM Sans | 400 | Secondary text |
| Label | `xs` (12px) | DM Sans | 500 | Uppercase labels, tracking `0.25em` |
| Input | `base` (16px) | IBM Plex Mono | 400 | Form inputs |

---

## Motion Design

### Philosophy

Motion in Struere is environmental, not decorative. It mimics natural phenomena: light shifting, water settling, objects finding their resting position. Every animation answers the question: "What would this look like if it existed in the physical world of the hero image?"

### Entrance Timing

The hero section tells a story through staggered entrances:

1. **Background** — Immediate, slow zoom (10s, scale 1.0 → 1.03) like adjusting focus
2. **Headline** — 0ms delay, 900ms fade-in — the first word spoken
3. **Tagline** — 500ms delay, 700ms — context follows the statement
4. **Prompt card** — 900ms delay, 2000ms ease — the instrument appears
5. **Action buttons** — 2200ms+ base, 250ms stagger — options materialize one by one

### Easing

One curve dominates: `cubic-bezier(0.16, 1, 0.3, 1)`. This is an aggressive ease-out — fast departure, long deceleration. Objects enter quickly and settle slowly, like a stone dropped into still water. The visual effect: things arrive with purpose and come to rest with grace.

### Scroll Behavior

- Parallax at `0.08` multiplier — perceived depth without vertigo
- Section reveals trigger at `0.1-0.2` intersection threshold — elements appear just as they enter the viewport, not before
- Navigation transitions smoothly between transparent (on hero) and glass (on scroll)

### Interactive States

- Hover: 200-300ms transitions, opacity changes, subtle scale (1.01-1.04x)
- Focus: Prismatic border glow appears over 500ms
- Active: Immediate color shift to confirm interaction
- No bounce, no overshoot, no spring physics — everything is damped

---

## Glass Morphism

### Philosophy

The `.liquid-glass` effect is the visual signature of Struere's "water cube" metaphor. It's glass made of water — transparent, refractive, alive with subtle distortion. Applied only to interactive containers: the prompt card, suggestion pills, navigation overlay.

### Implementation

- **Border**: `1px solid rgba(255,255,255,0.3)` — visible structure, not a hard edge
- **Background**: Multi-stop gradient at very low opacity (0.20 → 0.08 → 0.03) — more transparent at the bottom
- **Backdrop Filter**: SVG `feTurbulence` (fractal noise) + `feDisplacementMap` — creates organic distortion, not geometric blur
- **Shadow**: Inset glow + outer shadow — suggests volume, not flatness
- **Border Radius**: `rounded-2xl` (16px) — soft corners, never sharp

### When to Use Glass

- Hero prompt container
- Navigation bar (when scrolled)
- Suggestion pills
- Mobile menu overlay

### When NOT to Use Glass

- Section backgrounds (use stone palette)
- Cards in content sections (use `bg-white/50` with simple border)
- Text containers (glass competes with readability)

---

## Component Patterns

### Cards

Two card styles exist, each derived from a different material in the metaphor:

**Stone Cards** (content sections): `bg-white/50 backdrop-blur-sm border-charcoal/5` — translucent paper on stone. Hover adds prismatic border and slight elevation.

**Glass Cards** (interactive/hero): `.liquid-glass` class — water cubes. Used only where the user interacts directly.

### Buttons

**Primary**: Ocean blue fill, white text — the deep water you dive into. Full-width on mobile.

**Ghost**: Transparent with white/opacity text and border — part of the glass surface. Hover reveals gradient warmth.

**Pills**: Rounded-full, glass morphism — floating suggestions, like bubbles on water.

### Dividers

Never a solid line. Either:
- `h-[1px] prismatic-border` — a thin line of refracted light
- `border-charcoal/5` — barely visible, structural only

### Icons & Imagery

- Emoji for use-case icons (`text-3xl`) — warm, human, not corporate
- No stock photos beyond the hero background
- SVG for social icons and structural elements

---

## Responsive Philosophy

The experience scales like looking at the same landscape from different distances:

- **Mobile** (`<768px`): You're close to the stone. Elements stack vertically. The hero headline shrinks to `4xl` (36px) but remains Fraunces semibold. Padding compresses to `px-6`. The prompt card is full-width. One column for everything.

- **Tablet** (`768px-1024px`): You step back. Two-column grids appear. Headline reaches `6xl` (60px). Navigation shows text links. Padding opens to `px-12`.

- **Desktop** (`>1024px`): The full vista. Three-column grids, `7xl` headline (80px), maximum breathing room. The hero composition reaches its intended panoramic scale.

No element changes its fundamental character between breakpoints — only its scale and arrangement.

---

## Accessibility

Accessibility is not a layer added on top. It's inherent to the design philosophy:

- **All motion respects `prefers-reduced-motion: reduce`** — animations are disabled, not simplified
- **Color contrast meets WCAG AA** — charcoal on stone, white on hero image
- **Semantic HTML** — proper heading hierarchy, form labels, landmark regions
- **Focus visible** — prismatic border glow on keyboard navigation (not hidden for aesthetic reasons)
- **Language support** — ES/EN i18n with proper switching

---

## The Feeling

When someone lands on Struere, they should feel:

1. **Altitude** — they're somewhere high, clear, and open
2. **Calm** — nothing demands their attention aggressively
3. **Possibility** — the prompt box invites them to begin
4. **Magic** — the glass, the light, the refraction suggest something just beyond ordinary
5. **Trust** — the craft in typography, spacing, and motion says this was built with care

The page doesn't sell. It invites. It says: *stand here, look out at this view, and when you're ready, type what you want to build.*
