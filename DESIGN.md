---
name: Class List Builder
description: Balanced class lists for teachers, built offline and defensible on paper.
colors:
  paper: "#F7F6F2"
  surface: "#FFFFFF"
  surface-sunk: "#F0EFE9"
  border-hairline: "#E2E0D8"
  ink: "#1C1B18"
  ink-muted: "#57544E"
  ink-faint: "#6B6860"
  chalkboard-teal: "oklch(48% 0.13 168)"
  chalkboard-teal-wash: "oklch(93% 0.04 168)"
  alert-clay: "oklch(50% 0.14 22)"
  alert-clay-wash: "oklch(94% 0.04 22)"
  caution-amber: "oklch(62% 0.14 78)"
  caution-amber-wash: "oklch(94% 0.04 78)"
  roster-purple: "oklch(52% 0.14 295)"
  roster-purple-wash: "oklch(93% 0.04 295)"
  roster-blue: "oklch(52% 0.14 245)"
  roster-blue-wash: "oklch(93% 0.04 245)"
typography:
  display:
    fontFamily: "DM Mono, monospace"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: 1
  heading:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
  glyph:
    fontFamily: "inherit"
    fontSize: "28px"
    lineHeight: 1
  section:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  logo:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.3px"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  body-dense:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  table:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  eyebrow:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.6px"
  caption:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
  data:
    fontFamily: "DM Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
  data-sm:
    fontFamily: "DM Mono, monospace"
    fontSize: "10.5px"
    fontWeight: 400
  data-xs:
    fontFamily: "DM Mono, monospace"
    fontSize: "10px"
    fontWeight: 400
rounded:
  fill: "3px"
  badge: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  modal: "14px"
  pill: "20px"
spacing:
  hairline: "4px"
  tight: "6px"
  snug: "10px"
  base: "14px"
  roomy: "20px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.chalkboard-teal}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
  button-danger:
    backgroundColor: "{colors.alert-clay-wash}"
    textColor: "{colors.alert-clay}"
    rounded: "{rounded.sm}"
    padding: "7px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  badge-gender:
    backgroundColor: "{colors.roster-blue-wash}"
    textColor: "{colors.roster-blue}"
    rounded: "4px"
    padding: "1px 6px"
---

# Design System: Class List Builder

## Overview

**Creative North Star: "The Rostering Desk"**

This is a work surface, not a product page. The visual world is a well-lit desk
at the end of a term: warm paper underneath, a crisp white sheet on top, one
confident green ink for the things that matter, and everything else in a
measured grey hierarchy so that a hundred student names can be scanned without
fatigue. Nothing glows, nothing bounces, nothing celebrates. The interface is
quiet because the data is loud — a wall of names, scores, and flags is already at
the edge of what a person can hold in their head.

The one moment of visual emphasis is reserved for *decisions the teacher must
defend*: the balance score, the constraint verdict, the locked students. That is
deliberate scarcity. When teal appears, it means "this is the thing a principal
will ask you about."

The chrome is a two-step workflow — Setup, then Optimize — stated in the header
rather than hidden in navigation. There is no dashboard, no sidebar tree, no
settings labyrinth. The app has the shape of a form followed by a board.

**Key Characteristics:**

- Warm off-white ground (`#F7F6F2`), pure-white surfaces, ink-black text.
- One saturated accent (teal, `oklch(48% 0.13 168)`) used for state and
  selection, never for decoration.
- A three-value grey ramp carries all secondary information; four semantic
  hues (clay, amber, purple, blue) exist only as badge pairs.
- Monospace is reserved exclusively for numbers: scores, IDs, counts,
  percentages, version strings.
- Flat at rest. Depth is a hairline border, not a shadow.
- Density is the default; the layout tightens for print rather than loosening on
  screen.

## Colors

A warm paper-and-ink neutral ramp, one green accent, and four semantic hues kept
in wash/solid pairs so any badge has a legible tinted background.

The **print report is a separate palette** and is exempt from this section: it
forces fixed light values (`#1a7a5e` headings, `#555` secondary, `#333` body,
`#f8f9fa` / `#f5f5f0` table fills, `#ddd` / `#ccc` rules) because paper has no
theme, no dark mode, and no oklch support to rely on. Those hex values live in
`@media print` and are intentional, not drift. See Print Report under Components.

### Primary

- **Chalkboard Teal** (`oklch(48% 0.13 168)`): the accent. Active step pill,
  primary button fill, locked-student marker, satisfied-constraint check,
  progress bars, focus rings. In dark mode it lifts to `oklch(68% 0.13 168)` and
  its wash inverts to `oklch(28% 0.05 168)`.
- **Chalkboard Teal Wash** (`oklch(93% 0.04 168)`): the tinted background paired
  with the solid accent — active pill background, class-number circle, print
  report headings.

### Neutral

- **Paper** (`#F7F6F2`): the app ground. Warm, not white, so the white surfaces
  above it read as sheets on a desk.
- **Surface** (`#FFFFFF`): cards, columns, toolbars, modal bodies.
- **Surface Sunk** (`#F0EFE9`): inset regions and striping — table headers,
  stat-bar tracks, chips, disabled badges, code blocks.
- **Border Hairline** (`#E2E0D8`): the only divider weight. Cards use 1px,
  interactive controls 1.5px.
- **Ink** (`#1C1B18`): body text and headings.
- **Ink Muted** (`#57544E`): labels, secondary prose, column headers. 6.5:1 on
  surface, 4.8:1 at worst on surface-sunk.
- **Ink Faint** (`#6B6860`): metadata, IDs, placeholder-adjacent text. Deliberately
  set to clear WCAG AA (4.8:1 worst case) rather than the usual decorative grey;
  it appears at 10–12px where thin greys fail.

### Semantic pairs

Each is a solid + wash pair, used only for badges and inline warnings:

- **Alert Clay** (`oklch(50% 0.14 22)`) / wash — destructuring actions,
  constraint violations, error text.
- **Caution Amber** (`oklch(62% 0.14 78)`) / wash — warnings, and the
  mid-range balance score.
- **Roster Purple** (`oklch(52% 0.14 295)`) / wash — the `F` gender badge.
- **Roster Blue** (`oklch(52% 0.14 245)`) / wash — the `M` gender badge.

Flag criteria get their own 12-slot hue palette generated at runtime from a fixed
anchor list (`FLAG_HUE_PALETTE` in `src/defaults.js`) so adjacent flag badges are
always visibly different. Those values are computed, not tokens.

### Named Rules

**The One Voice Rule.** The accent appears on ≤10% of any screen. Its rarity is
what makes "satisfied", "locked", and "selected" readable at a glance. If teal
starts appearing on decorative elements, the signal is gone.

**The Semantic Pair Rule.** A semantic hue is only ever used as a solid on its own
wash, or as text on a neutral surface. Never a solid fill behind white text at
small sizes, and never two solids touching.

## Typography

**Display / Data Font:** DM Mono (fallback `monospace`)
**Body Font:** DM Sans (fallback `sans-serif`)

**Character:** A humanist sans carries every word, and a monospace carries every
number. The pairing is a deliberate division of labor: the sans is warm and
neutral enough to read a hundred rows without fatigue, and the mono gives digits
fixed width so score columns align and a balance score reads as data rather than
prose. Both come from the same family lineage, so they share proportions and
never clash.

### Hierarchy

- **Balance Figure** (DM Mono 500, 56px, line-height 1): the single number in the
  assessment modal, set inline rather than in CSS. It is the largest thing in the
  product by a wide margin because it is the only number a teacher will be asked
  about.
- **Page Heading** (DM Sans 700, 28–32px): first-run welcome modal headings only.
  The 28px step also sizes a decorative emoji glyph in empty states — that is an
  icon size, not a text size.
- **Modal Title** (DM Sans 600, 16px, 1.3): dialog headings.
- **App Logo** (DM Sans 600, 15px, letter-spacing -0.3px): the wordmark; the last
  word is set in accent teal.
- **Section Heading** (DM Sans 600, 20px): headings inside long-form modals
  (help sections, assessment verdicts).
- **Panel Title / Eyebrow** (DM Sans 600, 13px, uppercase, letter-spacing 0.6px,
  ink-muted): section headings inside cards ("Students", "Teachers / Classes").
  Uppercase is load-bearing — it distinguishes structure from content.
- **Body** (DM Sans 400, 13–14px, 1.5): prose, help text, form labels. 14px is
  the body default; 13px is the dense variant used inside cards.
- **Table / Card Text** (DM Sans 400–500, 12–12.5px): roster rows and student
  cards. Student names are 500 weight so a name outranks its ID.
- **Data** (DM Mono 400, 10–12px): scores, IDs, counts, stat-bar values, version
  strings, the CSV textarea.

### Named Rules

**The Numbers Are Mono Rule.** Any value a user might compare down a column is
DM Mono. Any word is DM Sans. There are no exceptions in the codebase, and
breaking this makes columns stop aligning.

**The Tight Ramp Rule.** Working UI lives in a 10–16px band, in half-pixel steps.
Three sizes sit above it and are each single-purpose: 20px section headings, 28–32px
welcome headings, and the 56px balance figure. A fourth large size would flatten
that hierarchy — reach for weight or colour instead.

## Layout

A sticky 56px header carries the two-step workflow (`1 · Setup` / `2 · Optimize`
pills) plus the global actions. Content sits beneath it in one of two shapes:

- **Setup** is a two-column grid, `220px 1fr`: a narrow teachers panel and a wide
  student roster card. The roster scrolls independently, with a sticky table
  header.
- **Optimize** is a fixed-height board below a wrapping toolbar. Class columns are
  laid out horizontally at a fixed `340px` width and the row scrolls
  horizontally, because comparing four classes side by side is the entire point
  of the view and a masonry or stacked layout would destroy it.

Spacing runs on a short, mostly ad-hoc scale — 4, 6, 10, 14, 20, 24px — reading
as tight rather than airy. Card padding is 20px; intra-card gaps are 6–14px. The
rhythm is deliberately dense because the screen content is tabular.

Responsive behavior is a two-breakpoint system:

- **≤900px:** class columns become `min(340px, 84vw)`; the setup grid collapses
  to a single column; toolbar and header padding contract.
- **≤640px:** the wordmark hides, touch targets grow (buttons to 8px/12px
  padding, cards to a 44px minimum height), class columns become
  `min(340px, 92vw)`.

The print report is a separate spatial world: `@page`-friendly pagination with a
forced light palette, its own pt-based type scale (5.5–24pt), and density tiers
that step type and padding down when a class is large.

## Elevation & Depth

Flat at rest, with two exceptions. Depth is communicated by the surface ramp
(paper → surface → surface-sunk) and by border weight, not by shadow. Shadows
exist only for things that genuinely float above the page:

- The two-step elevation vocabulary is `--shadow-sm` (1px/3px, 6% black) for
  small raised elements and `--shadow` (4px/12px, 8% black) for modals and
  dropdown menus.
- The modal overlay adds `backdrop-filter: blur(2px)` over a 35% scrim, which is
  the only place the app deliberately defocuses content.
- A modal carries an additional `0 0 0 1px` border ring so it reads as an edge on
  low-DPI displays where the shadow alone is invisible.

In dark mode both shadows deepen to 30–50% black, because a shadow on a dark
ground reads as a hole rather than a lift.

### Named Rules

**The Flat-By-Default Rule.** A surface is flat unless it floats. Cards, columns,
and panels never take a shadow — they take a hairline border. `--shadow` on a
card is a bug.

**The Locked-Shadow Rule.** State markers are inset, not structural: a locked
student card uses `box-shadow: inset 2px 0 0 var(--accent)` so the marker does
not change the card's box and shift its contents. Any state that adds an inset
marker must use an inset shadow for the same reason.

## Shapes

Gently curved, never pill-shaped, with two formal levels plus a modal exception:

- **3px** — inner fills inside a track: stat bars and scrollbar thumbs.
- **4px** — badges, tags, and small inline chips.
- **6px** (`--radius-sm`) — buttons, inputs, selects, student cards, small chips.
- **8px** (`--radius-md`) — inline callout panels.
- **10px** (`--radius`) — cards and class columns.
- **14px** — modal sheets only; the one place the system goes softer, to read as
  a lifted sheet rather than an inline block.
- **20px pill** — the workflow step pills and the class-count chip. Pills are
  reserved for *navigation and counts*, never for actions.

Borders are hairlines. Interactive controls use 1.5px (input, button, card,
column), static dividers use 1px. There is no double border and no border-plus-
shadow on the same element except the modal's deliberate edge ring.

## Components

### Buttons

Quiet, compact, and text-led. Icons are emoji or a bare glyph, never an icon
library.

- **Shape:** 6px radius, 1.5px border (transparent for ghost/danger), 7px/14px
  padding at 13px/500. The `btn-sm` variant drops to 4px/10px at 12px.
- **Primary:** solid teal with white text (dark mode: dark ink on light teal).
  Hover brightens via `filter: brightness(1.08)` rather than a second color.
- **Secondary:** white fill, hairline border, ink text. Hover fills with
  surface-sunk.
- **Ghost:** transparent, ink-muted text; used for icon-only toolbar controls.
  Icon-only buttons carry `aria-label` and a `title`.
- **Danger:** clay text on clay wash; hover inverts to solid clay with white text.
- **Disabled:** 45% opacity with `not-allowed`. Disabled buttons keep their
  layout; nothing is removed from the bar.

### Chips, Tags, and Badges

- **Badges** are 4px radius, 10.5px/600, 1px/6px padding, no border. Gender badges
  use the blue/purple pair; flag badges use the generated hue palette.
- **Tags** are 4px radius with a hairline border and surface-sunk fill, 11px
  ink-muted — used for counts next to panel titles.
- **Step pills** are 20px radius, 12px/500, with a 1.5px border that turns teal
  when active. The active state is the only place a pill gets a fill *and* a
  border *and* accent text.

### Cards and Class Columns

- **Corner style:** 10px radius.
- **Grid items carry `min-width: 0`.** The roster table is wider than its
  column; without this the card stretches the `setup-layout` grid past the
  viewport and clips the action row and the last columns. The roster action row
  wraps (`flex-wrap`) rather than spilling for the same reason.
- **Background:** white surface on paper ground.
- **Border:** 1px hairline for cards; 1.5px for class columns, which strengthens
  to teal during drag-over.
- **Shadow:** none at rest (see Elevation).
- **Internal padding:** 20px for cards, 6px for the class-column card list so
  student cards nest tightly.
- **Scroll:** class columns scroll their card list independently with a fixed
  header (class number, editable name, count) and a fixed footer (gender counts,
  stat bars, flag badges, total flags).

### Student Cards

The dense unit of the whole product.

- 6px radius, 1.5px hairline border, 5px/8px padding, single row.
- Contents in strict order: gender badge, mono ID, name (500, ellipsized), one dot
  per active flag, a link glyph if constrained, then the lock button.
- Hover strengthens the border to a desaturated teal; dragging drops opacity to
  40%.
- Locked state adds the inset teal marker described in Shapes.
- The card is a `role="button"`, focusable, and Enter/Space opens the detail
  dialog — drag-and-drop is never the only path.

### Inputs and Fields

- **Style:** white fill, 1.5px hairline border, 6px radius, 8px/10px padding,
  13px type. Border color transitions in 150ms. Inputs carry a visible label
  (`htmlFor`/`id` or `aria-label`); a placeholder is never the only name.
- **Inline name fields** (class names, teacher names) are borderless until focus,
  then reveal a 1.5px bottom rule in accent — they read as editable text, not as
  form fields.
- **Focus:** the border turns teal, and the global `:focus-visible` ring
  (`2px solid` accent, `2px` offset) appears for keyboard users. There is no
  `outline: none` without a replacement.
- **Inline name inputs** (class names, teacher names) are borderless until hover,
  then reveal a bottom rule — they read as editable text, not as forms.
- **Number/select fields** use the same shell as text inputs; there is no
  separate stepper style.

### Dialogs

- Rendered in a portal at `document.body`, above a blurred scrim.
- 14px radius, 90% width with a size ladder: 400 / 480 / 560 / 700 / 780px.
- Fixed header with title and a ghost ✕, scrolling body, optional footer with
  right-aligned actions.
- Focus is trapped, restored on close, and Escape closes — except where a
  destructive confirmation is pending, where dismissal is gated.

### Guided Tour

A numbered, non-blocking walkthrough over the app, not a modal. Each step is a
callout **attached to the control it describes** — an arrow touches the target
and the ring wraps it, so the copy and the thing it refers to read as one
object. A callout parked in a corner that only *describes* the target is not
this component.

- **Anchors, not a script.** A step names a target (`data-tour="…"`); one
  lookup helper (`targetEl`) returns the rendered control, and both the ring and
  the positioning use it, so they can never disagree. A step whose target is
  not on screen docks to the bottom left and does not break, so the step list is
  a stable map of the app rather than a fragile recording.
- **Conditional controls get a fallback anchor.** The same `data-tour` value may
  appear on more than one control; the lookup takes the first with client rects.
  Save Project only exists once students do, so Load Project carries `save` too
  — otherwise a first-time user on an empty roster gets the docked corner
  instead of a callout on the header. (`getClientRects()`, not `offsetParent`,
  which is null for `position: fixed` and would silently break this.)
- **Placement.** Measured from the target's real rect: centred under it, flipped
  above when the viewport is short there, clamped to the window, and re-measured
  on resize and scroll. Preferred side is underneath, `14px` clear of the
  control.
- **The arrow** is a 3-point SVG polyline, not a rotated square — only the two
  outer edges are stroked, so it points instead of reading as a diamond. Its
  fill overlaps the panel border by 1px to hide the seam.
- **The ring** is two-tone — a 3px gap in `--surface` (the surface the control
  sits on) then a 5px `--accent` — so it reads on filled, ghost, and bordered
  controls alike. It is **static and `transition: none`**: `.btn`'s
  `transition: all` would otherwise interpolate the ring up from a transparent
  0-spread shadow, leaving it momentarily invisible.
- **Focus scrim.** The app is shaded behind the step so the spotlighted
  control is the only crisp thing on screen. The hole is the control's own
  rect inflated by `8px`, with `radius` corners, painted as
  `box-shadow: 0 0 0 100vmax var(--modal-scrim)` on a transparent element —
  not a four-panel overlay, and not `clip-path`, which cannot round corners.
  A step with no visible target still shades, just without a hole.
- **The scrim is never modal.** `pointer-events: none`, and it renders below
  the callout. The tour must not block the control it points at; a click
  guard here would break the thing it is teaching.
- **Panel:** 300px anchored (320px docked), `--surface`, `--accent` border,
  `--shadow`, `radius` 10px. Step counter in the uppercase 11px/600 label
  style, title at 15px/600, body at 13px `--text2`. A dot row doubles as the
  step index and a jump control; the active dot is `--accent`.
- **Copy is short by contract.** The callout must not cover the control it
  points at, so each step earns two lines, not a paragraph.
- **Exit** is explicit and always available: Skip, ✕, Escape, or the last
  step's button. Starting the tour never modifies data — the Demo button's own
  sample load does.

### Inline Tints

A handful of callout panels use a 5–10% `rgba()` tint of the semantic hue
instead of a wash token (`LoadProjectModal` warning/error/focus panels,
`SaveProjectModal` success panel, `StudentMultiselect` selected row). These are
pre-existing and are a known inconsistency: prefer the wash token
(`--amber-light`, `--danger-light`, `--accent-light`) when touching one, and do
not add a new literal tint.

### Print Report

The print surface is its own system and is deliberately excluded from the token
conventions above. It forces a light palette inside `#print-report`, uses a
pt-based scale (5.5–24pt) with three density tiers, and hard-codes neutral greys
and a green heading colour so the output does not depend on the active theme.
Treat `@media print` as a separate contract; do not "fix" its values into
tokens.

### Stat Bars

- A 5px track in surface-sunk with a teal fill, 6px label in ink-faint, and a
  mono value in ink-muted.
- The fill animates via `transform: scaleX()` from a left origin, never by
  animating `width`.

## Do's and Don'ts

### Do:

- **Do** keep the accent scarce. Teal marks state, selection, and the single most
  important number — nothing else.
- **Do** set every number in DM Mono and every word in DM Sans.
- **Do** use the surface ramp for depth (paper → surface → surface-sunk) and
  reserve shadows for genuinely floating layers.
- **Do** express state markers as inset shadows so locked/selected cards don't
  shift their contents.
- **Do** keep ink-faint at or above 4.5:1 against surface-sunk, especially at
  10–12px.
- **Do** give every icon-only control an `aria-label` and a `title`.
- **Do** announce async status (optimizing, violations, balance score) in the live
  region.
- **Do** preserve the print report's forced light palette — it is intentional.

### Don't:

- **Don't** add a shadow to a static card, panel, or class column.
- **Don't** add a working-UI type size outside the 10–16px band, or a heading
  size beyond the three sanctioned above.
- **Don't** use pill radius for actions. Pills are for steps and counts.
- **Don't** render a dialog inside the aria-hidden app root.
- **Don't** animate `width`, `height`, `top`, or `left`. Transform and opacity
  only.
- **Don't** use a semantic hue as a solid behind white text at small sizes —
  always solid-on-wash.
- **Don't** add a hex value or an icon library. The palette lives in CSS custom
  properties and the iconography is text glyphs.
- **Don't** define a design token name and reference a different one; an undefined
  `var()` resolves to nothing and silently paints transparent.
