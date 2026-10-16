---
name: Rehearse.io
description: Enterprise async interview platform — recruiter console and candidate rounds, built as an airport wayfinding sign system
colors:
  wayfinding-yellow: "#f7c600"
  sign-black: "#111111"
  sign-white: "#ffffff"
  surface-grey: "#9a9a9a"
  work-area: "#e6e6e4"
  muted-surface: "#f4f4f2"
  secondary-plate: "#dedddb"
  rule-grey: "#8f8f8c"
  ink-muted: "#58585a"
  prohibition-red: "#c8102e"
  exit-green: "#0f7a3d"
  information-blue: "#1f4e9c"
  caution-amber: "#8a5a00"
  recess: "#262626"
typography:
  monument:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "set by the caller, 18px–100px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.025em"
  band:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.005em"
  sign-label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.04em"
  score:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "27px"
    fontWeight: 830
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums lining-nums"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tnum 1, lnum 1"
rounded:
  sm: "0px"
  md: "2px"
spacing:
  "2.5": "10px"
  "3.5": "14px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.wayfinding-yellow}"
    textColor: "{colors.sign-black}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.wayfinding-yellow}"
  button-primary-active:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.wayfinding-yellow}"
  button-outline:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.sign-black}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-outline-hover:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-white}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.sign-black}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-destructive:
    backgroundColor: "{colors.prohibition-red}"
    textColor: "{colors.sign-white}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-pill:
    backgroundColor: "{colors.wayfinding-yellow}"
    textColor: "{colors.sign-black}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 32px"
  input:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.sign-black}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.sign-black}"
    rounded: "{rounded.md}"
    padding: "24px"
  sign-band:
    backgroundColor: "{colors.wayfinding-yellow}"
    textColor: "{colors.sign-black}"
    padding: "8px 16px"
  register-table:
    backgroundColor: "{colors.sign-white}"
    textColor: "{colors.sign-black}"
    rounded: "{rounded.md}"
  state-mark:
    backgroundColor: "{colors.sign-black}"
    textColor: "{colors.sign-white}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  score-cell:
    textColor: "{colors.sign-black}"
    typography: "{typography.score}"
---

# Design System: Rehearse.io

## Overview

**Creative North Star: "The Terminal Sign System"**

This is an international airport's wayfinding system, not a dashboard's. The world is
international terminal signage — saturated yellow bands, sign black, sign white, a
single humanist grotesque set in sentence case, pictograms on inset squares, and a
split-flap that settles when a destination changes. The reference is concrete and it is
material: the yellow of a Schiphol band, the ruled edge of a panel, the monumental
destination identifier that tells you which way is next. The application is a route, and
the interface states the route.

The move that makes it fit is that a multi-round interview genuinely *is* a signed route
with waypoints: a candidate moves behavioral → DSA → done, and a recruiter's real question
is always "which round is live, where does each candidate sit on it, and what is next". A
sign system answers exactly that question. It also answers the incumbent world's failure:
the category-default admin grid of loose score chips leaves process state as decoration
and gives every number equal weight. Here the route is monumental, the next decision is
banded beneath it in plain language with a remaining count, and the register below reads
as a tabulated body of record.

It is a **light world with a black chrome layer**, not a dark app and not a paper
document. The physical scene is a recruiter at a desk in a bright office, an hour into a
register, with other tabs and a call open — so the work area is a light reading surface
(`#e6e6e4`) and the saturated sign material is reserved for the chrome: the top bar, the
bands, the plates. Depth is tonal, never shaded: there are **no shadows anywhere in the
build**. Form is square — signs are square, controls break the edge by two pixels, panels
at all.

It is a replacement world, not a refinement. The incumbent Verge reproduction (Anton
display type, Space Grotesk/Space Mono, a dark-only `#131313` ground, mint `#3cffd0`) is
discarded and is an anti-reference, as is the category default: a neutral admin grid of
blue-accented score chips.

**Accessibility is part of the contract, not a polish pass.** The target is **WCAG AA**, because this is an employment tool: contrast, screen-reader support and keyboard operation are the substance of equitable candidate evaluation, not a later audit. The focus treatment is single and global — `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }`, inverted to `#ffffff` inside `.on-sign` so one treatment is legible on both grounds — and the Colour-Removed Rule exists so no state depends on hue. Two known gaps remain open and must not be quietly closed: the DSA round's code editor (keyboard-only candidates) and the behavioral round's audio capture (candidates with no working microphone, undecided at product level).

**Key Characteristics:**
- One family (Hanken Grotesk, variable `wght@300..900`), sentence case, tabular figures.
- Yellow is **reserved** — primary action and monumental identifier only, never the ground, never a state.
- Bands are the component language: a yellow destination band over a black distance band, over a ruled register.
- Four states, each carried by **glyph + word + plate**, so the register survives colour removal.
- Magnitude is carried by **size and weight first**; the `.score` ramp reads as a profile down a column.
- Zero shadows. Depth is a lighter plate on a darker one, plus rules.
- Radii are `0` or `2px`. Bands, tables and plates are ruled, not hairlined.

## Colors

A four-material sign palette — one reserved yellow, sign black and white, and a mid grey
— with a small set of ink-only state colours that are never asked to do the wayfinding.

### Primary
- **Wayfinding Yellow** (`#f7c600`): the reserved accent, and the only saturated field in the system. It appears in exactly three jobs: the **primary action** (`bg-primary`, the default button plate), the **monumental identifier** (the hero's route band, the register's destination band, and monument type set over sign black), and the **mark** on a black plate (the pictogram squares, the round- and role-picker icons, the small role chips, the recording circle's mic, the code caret). It is never a background for a reading surface and never a state signal. The primary action is the one place a hover carries yellow: it inverts to the black plate and its label becomes that plate's mark (job three), which is why that hover is licensed and no other is.

**This is enforced, not aspirational.** The three jobs above are the *only* places `bg-primary`, `text-sign-yellow` or `caret-primary` appear in `src/`. Everything else that once was yellow now uses the system's own mark ink instead: a progress fill, a recording pulse, a speaking toggle, a mobile active destination, a **completed-step circle** and an **avatar plate** are black plates; an **avatar ring**, a **quote's left rule** and a **text-selection highlight** are black rules; a checked box's accent and the navbar's own hover are black too. The wordmark is set in one ink rather than two. Each of those was a violation that shipped and has been removed, because the reservation only works while it is total: the moment a second thing is yellow, the primary action stops being findable at a glance.

### Secondary
The state inks. These are subordinate: they annotate a state that is *already* carried by a glyph, a word and a rule, so they can be removed without information loss.
- **Prohibition Red** (`#c8102e`): destructive actions, invalid fields, error text and the recording indicator. The reddest thing in the system, and it never fills a large area.
- **Exit Green** (`#0f7a3d`): the "go / passed" ink (`text-success`) beside a state mark.
- **Caution Amber** (`#8a5a00`): the caution ink. **This is deliberately an ink amber, not the wayfinding yellow** — it is darker and desaturated so it can never be mistaken for an action, and it is roughly half the lightness of `#f7c600` so it reads as text on a light ground.
- **Information Blue** (`#1f4e9c`): declared as the information ink. Defined as `--info` and mapped as `--color-info`, but not yet consumed by any surface in the build.

### Neutral
Two grounds and their inks. **The light inks do not survive on the black layer** — see the rules below.
- **Sign Black** (`#111111`): the chrome ground (`bg-sign-black`), `--foreground` on the light work area, `--ring`, and the mark plates. One value, two jobs: it is both the darkest ink on a light ground and the ground itself.
- **Sign White** (`#ffffff`): the card and popover ground (`--card`, `--surface`), and the ink on sign black (`text-sign-white`).
- **Work Area** (`#e6e6e4`): the page ground (`--background`) and the recessed plate (`--surface-active`, `--accent`). This is also the sign frame material (`--color-sign-frame`), declared as a separate token with the same value.
- **Muted Surface** (`#f4f4f2`): the shallow recess — table row striping, transcript wells, hover background (`--surface-hover`, `--muted`).
- **Secondary Plate** (`#dedddb`): the mid recess — the recessed button and the progress track.
- **Rule Grey** (`#8f8f8c`): the ruling colour (`--border`, `--input`). A mid grey that reads as a drawn rule, not a faint hairline.
- **Ink Muted** (`#58585a`): the second-level text ink (`text-muted-foreground`) — emails, descriptions, column headers, qualifiers. **A light-ground ink: on `bg-sign-black` it is invisible.**
- **Surface Grey** (`#9a9a9a`): the sign surface grey. Declared as `--color-sign-grey`; not consumed by any surface in the build.
- **Recess** (`#262626`): the sidebar recess token (`--sidebar-accent`). The black left rail it was built for was dropped; the token remains.

### Named Rules
**The Yellow Reservation Rule.** Yellow belongs to the primary action and the monumental identifier, and to nothing else. It is never the page ground, never a surface fill, never a state colour, never a chart accent merely because there is one available. Its rarity is the whole mechanism: the moment a second thing is yellow, the primary action stops being findable at a glance.

**The Ink Inheritance Rule (dark plate).** Any element painted `bg-sign-black` must carry an explicit ink — `text-sign-white` or `text-sign-yellow`. A child with no colour class inherits the body's `#111111` and vanishes into the plate. This is not hypothetical: it shipped in `pages/InterviewSetup.tsx`, where the interview-format picker's selected branch painted the plate black and left the label to inherit, so the chosen format's name and description disappeared while the icon (which had its own colour) survived. The fix is the shape to copy: the plate carries `border-sign-black bg-sign-black text-sign-white`, and its icon carries `text-sign-yellow`.

**The Light-Ground Reset Rule.** The `.on-sign` modifier sets `background-color:#111111` **and** `color:#ffffff`. Any light ground nested inside it must therefore reset the ink as well as the background — `bg-background text-foreground`, not `bg-background` alone — or the inherited white leaks onto the light plate and the text goes invisible. This was a real defect in `HeroSection.tsx` (the product-preview section nested a `bg-background` plate inside the `.on-sign` hero section and inherited white text); the shipped form pairs every nested light plate with `text-foreground`.

**The Colour-Removed Rule.** No state may be carried by hue alone. Every state carries a glyph (`✓ ▸ ○ ▲`), a word ("Complete", "In progress", "Not started", "Not scored"), and a plate or rule. The design test: convert the register to greyscale and every state must still be distinguishable, in order, without the reader knowing the palette.

## Typography

**Display Font:** Hanken Grotesk (variable, `wght@300..900`; fallbacks `ui-sans-serif, system-ui, -apple-system`)
**Body Font:** Hanken Grotesk — the same family
**Label Font:** Hanken Grotesk, `sign-label` register
**Mono Font:** the system stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace`) — code and machine values only

**Character:** One family, as signage uses one. Hanken Grotesk is a humanist grotesk, Frutiger-adjacent: the lineage of the type on an airport sign, not a fashion grotesk and not a serif of record. It is set in **sentence case**, because the world does not shout in caps. The only drama in the type is the monumental identifier — set very bold at very large size, tight-leading and negatively tracked (`-0.025em` as the ladder default, `-0.05em` at monumental scale) — against 13px body text. The scale ratio is deliberately wide; there is no middle.

### Hierarchy
- **Monument** (`.type-monument`: weight `800`, line-height `0.92`, tracking `-0.025em`, size set by the caller): the destination. Hero at `lg:text-[6.25rem]`, the round band's live round at `54px` (`40px` small), a page title at `text-3xl`, the wordmark at `text-lg`. Sized by the caller because a sign sizes its band to its content. At monumental scale the caller adds `.type-monument-tight` (`-0.05em`), which is what the comp sets the identifier to — optical tracking tightens as type grows, and the identifier is the one place the system tracks that hard.
- **Band** (`.type-band`: weight `600`, `13px`/`1.35`, tracking `0.005em`): the sign's copy line — the sentence that states a route or a qualifier. Defined in the token layer; currently the shipping components state these lines with the equivalent inline `text-[13px] font-semibold` instead, so the class stands available but unused.
- **Sign label** (`.type-sign-label`: weight `600`, `12px`/`1.3`, tracking `0.04em`, colour `--muted-foreground`): the field label and section label of a plate — "Behavioral evaluation", "Written feedback", "Correctness", "Submission". Sentence case. 12 instances.
- **Score** (`.type-score`: weight `500`, tracking `-0.01em`, tabular figures, with a `[data-mag]` ramp): a single magnitude read on its own — used where a score is not in a register column (the hero's `8`, the cohort figures). `[data-mag="high"]` → `800`, `[data-mag="mid"]` → `600`, `[data-mag="low"]` → `400` and `--muted-foreground`.
- **Body** (weight `400`, `13px` is the workhorse, `1.6`-ish leading): descriptions, feedback, policy prose. `11.5px`–`12.5px` for second-level detail (emails, qualifiers, metadata) in `--muted-foreground`.
- **Mono** (`12px`-ish, tabular): code submissions, language names, complexity readouts, time-spent. Machine output only — never prose.

The `body` element carries `font-feature-settings: "tnum" 1, "lnum" 1`, and `table, .num` carry `font-variant-numeric: tabular-nums lining-nums`. Figures line up column to column, always.

### Named Rules
**The Sentence-Case Rule.** Labels, band copy, headings and monuments are sentence case. The world does not shout in caps.

**The Display-Name Rule.** Sentence case reaches the data too. The API stores its enums lowercase (`dsa`, `active`, `completed`), so no raw value may reach the screen: `src/lib/labels.ts` maps each one to its display name, falling back to a capitalised first letter. CSS `capitalize` is not a substitute — it renders `dsa` as `Dsa`. The register and the session list name the same state the same way because both read this one map.

**The Tabular Rule.** Any column of figures is tabular and lining — every table, every score column, every counted figure block. Proportional numerals are a defect in this system because the register is read down the column.

**The Ramp-Before-Colour Rule.** A magnitude difference is expressed as a size-and-weight difference first. Colour is the last thing added and the first thing removable.

## Layout

A **single-column, full-width sign stack**: a fixed 56px sign-black top bar (`h-14`, `fixed top-0 z-50`) over a scrolling body, with no sidebar. The content column is centred at `max-w-[1400px]` for the register and `max-w-3xl`/`max-w-4xl`/`max-w-5xl` for reading surfaces, inside the shared `container mx-auto px-4 sm:px-6 lg:px-8` gutter. Every routed surface clears the fixed bar with `mt-14` or `pt-20`.

The stack is always the same shape, top to bottom: **breadcrumb and actions → title block → cohort figures → the band → the toolbar → the register.** Bands are full-width within the column and butt against each other with no gaps, separated by `border-2 border-sign-black` rather than by space, because a sign is one continuous panel.

Density is high and deliberate: table cells at `px-3.5 py-2.5` (14px / 10px), card interiors at `p-4`/`p-5`/`p-6`/`p-8`, band interiors at `px-4 py-2.5`, column gaps between figure blocks at `gap-x-10`. Vertical rhythm between the stack's blocks is `space-y-5`/`space-y-6`. There is no decorative whitespace: air appears only as the padding a plate needs to be read, and a "receiving" block (a cohort figure) keeps its label on the same baseline as its number (`items-baseline gap-2`).

Responsive behaviour is Tailwind's default ladder (`sm 640 / md 768 / lg 1024 / xl 1280`): the nav collapses to a hamburger below `md`; the DSA result metric grid goes `grid-cols-2` → `sm:grid-cols-4`; the product preview panel stacks below `md`; the register scrolls horizontally (`overflow-x-auto`, `min-w-[720px]`) rather than reflowing, because a table of record does not restack.

## Elevation & Depth

**There are no shadows in this system.** No `box-shadow` appears in the token layer or in any component; the build contains zero shadow utilities. Depth is entirely **tonal and rule-based**, which is correct for a sign: a sign has a front face and a ground, not a drop shadow.

Three devices carry depth:
1. **Plate on ground.** A white plate (`bg-card #ffffff`) on the work area (`bg-background #e6e6e4`), stepping down through `--surface-hover #f4f4f2` and `--surface-active #e6e6e4` for recess. Tone is the elevation scale.
2. **The black layer.** `on-sign` / `bg-sign-black` is a distinctly *nearer* surface than the work area — the chrome, the bands, the code well — and it inverts the ink with it.
3. **The left rule.** An expanded register row is marked by a 2px sign-black rule (`border-l-2`) and a `bg-muted/40` recess, not by a lifted panel. Detail arrives in place; the reader never loses their row.

### Named Rules
**The No-Shadow Rule.** Nothing in this system casts a shadow. If a surface needs to read as nearer, lighten the plate or invert the ink — do not add depth. (The one permitted exception in the world's own vocabulary, a hard offset shadow, belongs to a neobrutalist world, not this one, and is absent here.)

**The Rule-Not-Gap Rule.** Adjacent regions of a panel are separated by a black rule (`border-r-2` / `divide-x-2` in `border-sign-black`), not by a gutter. A sign is one panel divided by its rulings. It governs the register's round strip, the band, and the landing page's legend — the three properties a visitor reads are three cells of **one bordered panel**, not three gapped cards.

## Shapes

**Square, then broken by two pixels.** `--radius-sm: 0px` and every other radius step — `md`, `lg`, `xl`, `2xl`, `3xl`, and the bare `--radius` — is `2px`. The form language is: signs are square; controls break the edge by exactly 2px; panels do not break it at all.

- **`rounded-md` (2px)** — the default for buttons, inputs, cards, nav plates, bands and table wrappers. 144 uses.
- **`rounded-sm` (0px)** — the true square: progress track and indicator, state marks, score/question chips, inner metric tiles. 15 uses.
- **`rounded-full`** — reserved for **marks, not panels**: avatars and initials, the circular mic button, small indicator dots, the record state ring. 33 uses.

Borders are **ruled, not hairlined**. The ruling colour is `--border: #8f8f8c`, a mid grey that reads as a drawn line; the structural rule is `border-2 border-sign-black` (the band frame, the table header's bottom rule, the expanded row's bottom rule, the outlined button's edge). Dashed rules mark absence: `border-dashed` for a "not started" state and for the empty register.

Specific silhouettes worth keeping: the **pictogram square** — a `rounded-sm` box with a `border-2 border-sign-black` edge and a 9-unit icon inside; the **band** — a full-width plate with a black top or bottom rule; the **chip** — a `rounded-sm` box with `border-2` carrying a glyph and a word.

## Components

### Buttons
Signage plates: a filled plate that inverts when activated, and an outlined plate with a rule edge. All are `rounded-md` (2px), `text-sm font-semibold`, `gap-2`, `transition-colors duration-150 ease-out`, with disabled at `opacity-45`.

- **Primary** (`default`): the yellow plate — `bg-primary text-primary-foreground` (`#f7c600` on `#111111`). **Activates by inverting to the sign's black**: `hover:bg-sign-black hover:text-sign-yellow`, same on `:active`. This is the system's central gesture — the action lights up yellow, and confirms by going black.
- **Outline**: `bg-card text-foreground border-2 border-foreground` — the sign's ruled edge. Inverts to `hover:bg-foreground hover:text-card`. On the black layer, callers restate it: `bg-transparent text-sign-white border-sign-white hover:bg-sign-white hover:text-sign-black`.
- **Secondary**: the recessed plate — `bg-secondary border border-border hover:bg-surface-active`.
- **Destructive**: `bg-destructive text-destructive-foreground`, inverting to `hover:bg-sign-black hover:text-sign-white`.
- **Ghost**: bare text, `hover:bg-surface-active`.
- **Link**: `text-foreground underline-offset-4 hover:underline`.

**Sizes:** `sm h-8 px-3` · `default h-9 px-4` · `lg h-11 px-7` · **`pill h-12 px-8 text-base`** (the monumental call to action — the landing primary and nav CTA) · `icon size-9`.

**Focus:** handled globally, not per-button — `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }`, with the outline inverted to `#ffffff` inside `.on-sign`. One focus treatment for the whole product, legible on both grounds.

### Inputs
- **Style:** `bg-card` (white) on the work area, `border border-input` (`#8f8f8c`), `rounded-md` (2px), `h-9`, `px-3`, `text-base md:text-sm`. Placeholder is `--muted-foreground`; selection is the yellow plate (`selection:bg-primary selection:text-primary-foreground`).
- **Focus:** the border darkens to sign black (`focus-visible:border-foreground`); the outline ring comes from the global rule.
- **Invalid:** `aria-invalid:border-destructive` — the rule goes prohibition red, honouring the state without changing the layout.
- Native `input` and `select` are used directly in the register toolbar, styled to match: `h-9 rounded-md border border-input bg-card text-[13px] focus-visible:border-foreground`.

### Progress (defined, not consumed)
The `Progress` primitive is `h-4 w-full rounded-sm bg-secondary` (the square track) with its indicator `bg-sign-black` — a **black rule advancing across a grey track**, no colour and no gradient. It is defined in `components/ui/progress.tsx` and imported by nothing: no surface in the build renders one. Recorded here so the file is not mistaken for a live pattern; if a progress readout is ever added, this is its form, and it must never become a countdown (the product bars manufactured pressure). The three hand-rolled inline bars that *do* ship (behavioral round, DSA round, onboarding step bar) were yellow fills until they were corrected to this same black-rule-on-grey-track form, so the primitive now describes what the build actually does.

### Plates / Containers
There is no container component in use. Every plate in the shipped build is a hand-rolled `<div>` carrying `bg-card` and a rule — `bg-card` appears 55 times as a class, and the `Card` primitive is imported by nothing.
- **Corner Style:** `rounded-md` (2px).
- **Background:** `bg-card` (`#ffffff`) on `bg-background` (`#e6e6e4`); `bg-popover` for overlays; `bg-surface-hover` for a recessed panel inside a plate (the hero's evaluation panel).
- **Border:** `border border-border` (`#8f8f8c`, 1px) for an interior card; `border-2 border-sign-black` for a plate that is structurally part of the sign (the band, the product preview, the cookie notice, the error plate). An empty state uses `border-2 border-dashed border-border`.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Internal Padding:** `p-4` for inner records, `p-5`/`p-6` for a panel, `p-8 sm:p-10` for a legal page.
- **Vestigial:** the `Card` primitive (`components/ui/card.tsx`) is dead code from the discarded world — never imported, still documenting "Verge radius", and still exposing a `cardRadius?: 20 | 24 | 30` prop whose three branches are byte-identical (`rounded-md`). It has no visual effect and is not an instruction.

### Navigation
The top bar **is a sign**: `<nav class="on-sign fixed top-0 w-full z-50 bg-sign-black h-14">`. Sign black ground, sign white ink, 56px tall, ruled off the page with a black bottom edge.

- **Wordmark:** there is no logo — `Rehearse.io` set in `.type-monument` at `text-lg`, in **one ink**. It is not part-yellow, and hover is a `bg-white/10` plate rather than a colour change: the bar's only yellow is the primary action at its right edge.
- **Links:** `text-[13px] font-semibold`, sentence case, no underline. Inactive is `text-sign-white/75 hover:text-sign-white`. **Active is the lit plate**: `bg-card text-foreground` — one destination reads as illuminated among dark ones. (The mobile menu restates the same idea in an inverted ground: `bg-sign-black text-sign-white`.)
- **Avatar:** a `rounded-full` mark that inverts against whatever ground it sits on and is never yellow — `bg-card text-foreground` at `h-7 w-7` in the black bar, `bg-sign-black text-sign-white` at `h-9 w-9` in the light mobile sheet.
- **Dropdown / mobile sheet:** a light plate on the black bar — `bg-popover text-foreground`, `rounded-md border border-border`, entering with `animate-in fade-in slide-in-from-top-1 duration-150`. Any light plate inside the bar carries its own `text-foreground`, per the Light-Ground Reset Rule.
- **Mobile:** the nav column collapses to a hamburger below `md`; the sheet is a full-width bordered panel below the bar.

### The Sign Band (signature)
The world's core composition, built from three stacked full-width plates with no gaps between them:

1. **Route strip** — a `bg-muted` label cell ("Round order") then one cell per round, divided by `border-r-2 border-sign-black`, each carrying a glyph and the round's name: **past** `text-muted-foreground` with `✓`, **current** `bg-sign-black text-sign-white font-bold` with `▸` (and `aria-current="step"`), **future** `bg-muted/60 text-muted-foreground` with `○`.
2. **Destination band** — `bg-sign-yellow text-sign-black`, carrying the live round as a `.type-monument .type-monument-tight` at `text-[40px] sm:text-[54px]`, with its qualifiers beside it on the baseline: "Round 2 of 3 · Behavioral". How many candidates have started is not restated here; that is the cohort row's job.
3. **Distance band** — `.on-sign`, `text-[13px]`, stating the **next decision** in plain language and nothing else: "Some answers could not be scored automatically. Open a candidate to review." It carries no counts and no expiry, because the cohort figure row above it already holds the counts and the title block already holds the expiry. Before that was fixed the register stated the same three facts three times.

The composition itself is the argument: route, destination, distance, in that order, in one panel. Every one of these lines is computed from the candidate list, so the bands are a reading of the cohort, not decoration.

### The Split-Flap (signature interaction)
The destination band's identifier settles like a split-flap when the live round changes:

```css
@keyframes flap-settle {
  from { transform: translateY(-1.1em); opacity: 0; }
  to   { transform: translateY(0);      opacity: 1; }
}
.flap { display: inline-block; animation: flap-settle 420ms steps(7, end) both; }
```

`steps(7, end)` is the whole point — the motion is **discrete**, seven frames like a mechanical flap, not a slide. It is driven by a React `key={activeRound}` so the element re-mounts and replays on state change, which makes a state change legible as movement in one place instead of a page reload. Reduced motion is handled globally in the token layer: under `prefers-reduced-motion: reduce`, every animation and transition duration collapses to `0.01ms` (`animation-duration`, `transition-duration`) with `animation-iteration-count: 1` and `scroll-behavior: auto` — so the band lands instantly and in full.

### The Register (signature)
The recruiter's table of record, and the most complete expression of the system.

- **Frame:** a white plate, `rounded-md border border-border`, `overflow-x-auto`, holding a `border-collapse` table at `min-w-[720px]`.
- **Header:** `text-[11.5px] font-bold text-muted-foreground`, ruled by `border-b-2 border-sign-black`. Numeric columns are `text-right` with the sort affordance `flex-row-reverse` so the arrow sits on the outside edge. Each header is a button carrying `aria-sort` and an arrow mark: `↑` ascending, `↓` descending, `⇅` unsorted.
- **Rows:** `px-3.5 py-2.5`, divided by a 1px `border-border` rule. A "not started" row is recessed to `bg-muted/50`. Name at `text-[14px] font-semibold` over email at `text-[11.5px] text-muted-foreground`; the name is a button with `aria-expanded` only when there is something to expand, and it underlines on hover.
- **Expansion:** one row at a time, in place — a `border-l-2 border-sign-black` rule on a `bg-muted/40` recess, closing with `border-b-2 border-sign-black`. Detail records sit inside as white `rounded-md border border-border` cards; the question number is a small numbered bold mark; the answer's score is a `border-2 border-sign-black rounded-sm px-2 py-0.5 text-[12px] font-bold` chip reading `8/10`.
- **Unscored:** a completed round with no score is its own state and gets a dedicated notice — `border-2 border-warning` on `bg-card`, headed by a `state-hatch` chip reading "▲ Evaluator unavailable", stating plainly that no score and no feedback were recorded and that the round is left unscored rather than estimated. The model's judgement is never implied to be more than it is.
- **Empty:** a `border-2 border-dashed border-border` panel with a glyph, a heading and one line of instruction — never a bare "No data".

### The Score Ramp (signature)
One star rating, drawn as a ramp so the register reads with colour removed. `.score` is `inline-block`, `line-height: 1`, tabular, weight `600` at base, and the caller sets `data-s` to the rounded score (`1`–`10`) or `"none"`:

| `data-s` | size | weight | colour |
|---|---|---|---|
| `10`, `9` | 27px | 830 | ink |
| `8` | 25px | 790 | ink |
| `7` | 23px | 740 | ink |
| `6` | 21px | 690 | ink |
| `5` | 19px | 640 | `--muted-foreground` |
| `4`–`1` | 18px | 600 | `--muted-foreground` |
| `none` | 18px | 400 | `--muted-foreground` |

Read down a column, the column becomes a **profile** — a strong candidate's scores form a wide, heavy stack; a weak candidate's fade to light grey. Size and weight move first; the greying at `5` and below is the only colour event, and it is redundancy, not the signal. Formatting follows: whole numbers print whole (`8`, not `8.0`); an unscored cell prints `—`.

### State Marks
Four states, each a `rounded-sm border-2` chip carrying a glyph **and** a word, ~`text-[12.5px] font-semibold px-2.5 py-1`:

- **Complete** — `✓` on `bg-sign-black text-sign-white border-sign-black`.
- **In progress** — `▸` on `bg-card text-foreground border-sign-black`.
- **Not started** — `○` on `border-dashed border-muted-foreground text-muted-foreground`.
- **Not scored (caution)** — `▲` on `.state-hatch border-warning text-warning`.

`.state-hatch` is `repeating-linear-gradient(135deg, var(--hatch-a) 0 6px, var(--hatch-b) 6px 12px)` — two steps of the caution amber, declared as tokens (`--hatch-a`/`--hatch-b`) rather than inlined — a caution drawn as **hatching, not as a fill colour**, so it survives colour removal and reads as caution in greyscale. It is the only textured surface in the system and it appears only on the caution state.

### The Selection Language
One language, product-wide: **the black plate with a yellow mark.** A chosen option is `border-sign-black bg-sign-black text-sign-white` with its icon in `text-sign-yellow`; an unchosen option is `border-border bg-background` on hover `hover:border-sign-black`. Used for the interview-format picker in `InterviewSetup.tsx`, the language picker in `SignUp.tsx`, and the round-type picker in `RehearsalRoom`/`DsaPractice`. A black plate always means "this one is chosen", "this is a mark" (the pictogram squares, the role chips, the recording circle), or "this is the sign layer". It is never a general-purpose dark surface.

### Code Editor
A dark well, consistent with the sign layer: `bg-sign-black` with `border border-border`, `rounded-md`. A toolbar ruled off by `border-b border-border` carries `Editor` in `.type-sign-label` at `text-sign-white/60` and the language name in `.type-sign-label text-sign-white/70`; the body is `font-mono text-[12px] leading-5 text-sign-white` over a `text-sign-white/40` line-number gutter, with `caret-primary` (a yellow caret) and tab insertion of four spaces. The language `select` is a black plate with a `border-white/25` edge and a `focus:border-sign-white` focus rule. The code well is the only place a large black area is a *surface* rather than chrome.

### The Storage Notice
The cookie banner states only what the site stores and asks for nothing it cannot honour: a white `border-2 border-sign-black` notice at `max-w-3xl`, led by a `w-9 h-9 bg-sign-black text-sign-yellow rounded-md` pictogram square, a `text-[13px] font-bold` heading, `text-[12.5px] text-muted-foreground` body, and one `size="sm"` primary button. No accept/reject theatre, because there is nothing to reject.

## Do's and Don'ts

### Do:
- **Do** reserve yellow (`#f7c600`) for the primary action and the monumental identifier, and keep the yellow mark as the *only* colour on a black plate. (The Yellow Reservation Rule.)
- **Do** give a `bg-sign-black` plate an explicit ink (`text-sign-white` / `text-sign-yellow`), and reset the ink on any light plate nested inside `.on-sign` (`bg-background text-foreground`). (The Ink Inheritance Rule; the Light-Ground Reset Rule.)
- **Do** carry every state three ways — glyph, word, plate — and test it by greyscaling the screen. (The Colour-Removed Rule.)
- **Do** set magnitude with size and weight first via `data-s` / `data-mag`, so a register column reads as a profile before it reads as colour.
- **Do** keep `2px` the maximum radius outside circles, and reserve `rounded-full` for marks (avatars, the mic button, indicator dots) rather than panels.
- **Do** rule regions apart with `border-2 border-sign-black` rather than separating them with gaps — a band is one panel.
- **Do** use tabular lining figures in every table, score column and counted figure block.
- **Do** state the route, the live round and the next decision in the band, in that order, in plain language. The counts live in the cohort figure row and the expiry in the title block, so the band states the decision rather than a third copy of the figures.
- **Do** route every API enum through `src/lib/labels.ts` before it reaches the screen, so the register and the session list name the same state the same way. (The Display-Name Rule.)
- **Do** set type in sentence case, and size a band to its content.
- **Do** keep `--warning` (`#8a5a00`) as an ink amber and `#f7c600` as the action yellow; they are never interchangeable.
- **Do** route the score's formatting through the same rule as the ramp: whole numbers print whole (`8`), an unscored cell prints `—`.

### Don't:
- **Don't** paint the page ground or any reading surface yellow; the ground is `#e6e6e4` and the yellow is a plate. (The Yellow Reservation Rule.)
- **Don't** use yellow, or any hue, to carry state — state is ink, glyph and rule. That includes a progress fill, a recording pulse, a speaking toggle, a mobile active destination, an avatar plate and a focus ring. (The Colour-Removed Rule; The Yellow Reservation Rule.)
- **Don't** place `text-muted-foreground` (`#58585a`) or `text-foreground` (`#111111`) on `bg-sign-black`; both are light-ground inks and disappear. (The Ink Inheritance Rule.)
- **Don't** nest a light ground in `.on-sign` without `text-foreground`; the inherited white goes invisible on white. (The Light-Ground Reset Rule.)
- **Don't** add a shadow. No surface in this system casts one. (The No-Shadow Rule.)
- **Don't** use hairlines or faint borders: the ruling colour is `--border: #8f8f8c`, and structure is `border-2 border-sign-black`.
- **Don't** introduce a radius above `2px` for a panel or control.
- **Don't** set labels, headers, bands or monuments in all-caps; the ladder is sentence case. (The Sentence-Case Rule.)
- **Don't** use proportional figures in a column, or format a score with a redundant decimal (`8.0`).
- **Don't** use the code well's black or the editor as a general-purpose dark surface — `bg-sign-black` is otherwise the sign layer or the selection plate.
- **Don't** imply execution or test-case validation in any code-related surface: code is statically reviewed, and the copy must say so.
- **Don't** carry the discarded world's shapes forward — the `Card` primitive's `cardRadius` prop and the `--sidebar-*` tokens are inert leftovers, not instructions.
