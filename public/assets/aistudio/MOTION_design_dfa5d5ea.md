# MOTION — Design System & Product UX Specification

**Version:** 1.0  
**Artifact:** `design.md`  
**Status:** Implementation-ready visual direction  
**Scope:** MOTION — collaborative project management application (CodeAlpha Task 3)

## 1. Design intent and source

**Visual reference:** [Pickolab Studio — Project Management Dashboard: Project Page](https://dribbble.com/shots/26819530-Project-Management-Dashboard-Project-Page).

The reference's defining characteristics are: a restrained navigation frame; an information-rich project heading (title, project state, short description, assignees, dates and milestone progress); compact actions; a view switcher; and a four-column Kanban board with small task metadata, restrained cards, progress bars and assignee avatars. The layout prioritizes *a working project board*, not charts or marketing panels.

**Adaptation rule:** Use this source as a layout and hierarchy reference—not a pixel-for-pixel copy. Build MOTION's own visual identity with a warm cream palette, typographic sophistication and deliberately quieter controls. Preserve working MOTION functionality and the two distinct features, **Blocker Radar** and **Decision Notes**, without letting either overwhelm core project work.

**North-star experience:** “A calm, tactile, credible workspace that makes the next action obvious.”

### Non-negotiables

- Light-only, warm, cream-based aesthetic. **No dark mode in this design pass**, dark navigation rails, black hero slabs or vibrant/neon colors.
- No glassmorphism, glowing shadows, gradients, oversized pill stacks, inflated metric cards or decorative dashboard clutter.
- Do not change authentication, API contracts, database, Socket.IO, permissions or task behaviors to accomplish styling.
- Do not imply that a UI control works unless it has a real handler and appropriate state.
- The design should accommodate both empty and genuinely populated workspaces; never fake social presence or task statistics.

## 2. Product hierarchy

**Global:** Workspace switcher, My Work, Inbox/Notifications, Projects, Profile/Settings.

**Inside a project:** Overview / Board / List (if implemented) / Blockers / Activity / Members. **Decision Notes** live primarily in task detail; a project-level decision index is optional only if already functional.

**Project page flow:** Breadcrumb → project identity and context → team / timeline / milestone summary → contextual project actions → board tabs / filters / search → Kanban surface.

Blocker Radar is a project operational view, not a marketing feature. Remove “USP” badges, feature explanations in normal application chrome, and global navigation that duplicates project tabs.

## 3. Visual design tokens

### 3.1 Warm cream palette

All swatches below are **MOTION-authored recommendations**, not colors extracted from the Dribbble source.

| Token | Hex | Application |
|---|---|---|
| `--canvas` | `#F7F4EC` | Warm ivory app background |
| `--sidebar` | `#F1EBDD` | Oatmeal sidebar/navigation surface |
| `--surface` | `#FFFCF6` | Primary panels and task cards |
| `--surface-raised` | `#FFFDF9` | Modal/dialog surface |
| `--surface-muted` | `#F3EFE5` | Kanban column wash, subtle grouped controls |
| `--surface-hover` | `#EDE7DA` | Quiet hover treatment |
| `--border` | `#DED8CB` | Soft structural borders |
| `--border-subtle` | `#EAE4D8` | Task/row dividers |
| `--text-primary` | `#33382F` | Warm deep olive-charcoal for legible content |
| `--text-secondary` | `#5D655A` | Secondary copy |
| `--text-muted` | `#70786D` | Muted but still readable supporting copy |
| `--accent` | `#596D56` | Muted sage primary controls and focus |
| `--accent-hover` | `#465A44` | Sage hover |
| `--accent-soft` | `#E3EBDD` | Selected navigation, soft status chip |
| `--clay` | `#A46F5C` | Warm terracotta for measured attention states |
| `--clay-soft` | `#F3E7DD` | Soft blocked / warning backgrounds |
| `--sand` | `#E7D6B2` | Soft wheat highlights |
| `--success-soft` | `#E6EEE4` | Completed state |
| `--review-soft` | `#ECE8F0` | Subtle muted-lilac in-review indicator |
| `--danger` | `#985C51` | Accessible destructive / critical action text |

**Important:** “No dark color combinations” means no dark sections, surfaces or dramatic black/navy blocks. Readable dark *text* remains necessary for accessibility. Do not render long body copy in beige-on-cream.

### 3.2 Palette proportions

- 70% warm ivory, light oatmeal, off-white and cream.
- 20% subtle structural neutrals, borders and typography.
- 10% or less muted sage, clay and semantic highlights.
- Status colors are small, functional accents—not column-wide saturated backgrounds.

### 3.3 Semantic Kanban indicators

| Workflow | Marker | Suggested soft surface |
|---|---|---|
| To Do | warm sand dot `#B9A27C` | `#F1E9DB` |
| In Progress | muted sage dot `#78906F` | `#E9EFE4` |
| In Review | muted mauve dot `#95839D` | `#F0EBF1` |
| Done | sage-green dot `#62866B` | `#E7F0E5` |
| Blocked | clay `#A46F5C` | `#F3E7DD` |

Status must always include a **text label**, not color alone. If contrast measurements fail in implementation, darken foreground text and/or make the accent less subtle; do not sacrifice legibility to preserve an exact hex.

### 3.4 CSS tokens

```css
:root {
  color-scheme: light;
  --canvas: #F7F4EC;
  --sidebar: #F1EBDD;
  --surface: #FFFCF6;
  --surface-raised: #FFFDF9;
  --surface-muted: #F3EFE5;
  --surface-hover: #EDE7DA;
  --border: #DED8CB;
  --border-subtle: #EAE4D8;
  --text-primary: #33382F;
  --text-secondary: #5D655A;
  --text-muted: #70786D;
  --accent: #596D56;
  --accent-hover: #465A44;
  --accent-soft: #E3EBDD;
  --clay: #A46F5C;
  --clay-soft: #F3E7DD;
  --sand: #E7D6B2;
  --success-soft: #E6EEE4;
  --review-soft: #ECE8F0;
  --danger: #985C51;
  --radius-sm: 6px;
  --radius-md: 9px;
  --radius-lg: 12px;
  --shadow-popover: 0 8px 30px rgba(66, 62, 48, 0.08);
}
```

## 4. Typography, spacing and elevation

**Typeface:** Inter or Manrope (use one family), with system sans-serif fallback. No decorative serif or monospace for routine UI.

| Role | Desktop style |
|---|---|
| Main project title | 28–30px, 650–700 weight, 1.2 line height |
| Page title | 24px, 650 weight |
| Section title | 16–18px, 600 weight |
| Card title | 13.5–14px, 600 weight, 1.4 line height |
| Body | 13.5–14px, 400–500 weight, 1.5 line height |
| Controls | 12.5–13px, 500–600 weight |
| Metadata | 11.5–12px, 400–500 weight |

**Spacing scale:** `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48` px. Use 24–32px around main content, 16–20px for card/panel internals, 8–12px for related control clusters.

**Radii:** 6px chips/input subcontrols; 9px buttons/task cards; 12px larger panels and dialogs. No huge pill-shaped cards or 24px rounding everywhere.

**Borders:** 1px soft border only for functional grouping. **Shadows:** near-zero on regular tasks; a soft shadow only on overlays, floating menus and dragging cards.

**Icons:** one consistent 18–20px line-icon family; avoid icon + badge + border combinations for routine labels.

## 5. Application shell

### 5.1 Desktop structure

- Global header: **58–64px** tall; light warm-white surface with bottom divider.
- Sidebar: **218–232px**, `--sidebar`, collapsible to an icon rail if supported.
- Main canvas: `--canvas`, fills remaining width; avoid a massive full-width blank white panel.
- Project content: content edge padding 28–36px; Kanban surface allowed to scroll horizontally, not the entire app.
- Header left: MOTION mark + workspace context. Header right: compact search, invite/members, notifications, avatar.
- Use one visible primary action for context (e.g. Add task), not competing `Create project`, `Add member`, `Invite`, `Share`, and `Edit` buttons in a row.

### 5.2 Sidebar

**Workspace** switcher at top with small chevron and appropriate loading/empty state.

Navigation grouping:

```
MY SPACE
  My Work
  Inbox

PROJECTS
  Atlas Dashboard
  Website Redesign
  + New Project

[account / workspace settings]
```

- Active link: muted sage text, `--accent-soft` wash or 2px sage inline indicator. **Never** a large saturated orange block.
- Icons should be secondary to readable labels.
- Sidebar project items may show a discreet colored dot only when this conveys meaning.
- Avoid static “USP” labels or nonfunctional team presence indicators.

### 5.3 Project context header (reference-inspired)

Top line: `Projects / Atlas Dashboard` breadcrumb on the canvas.

Below: left-aligned title and small status label; adjacent compact menu for more actions. One restrained button (e.g. `Invite`) on the far right.

Next: 1–2-line useful project description, visually secondary.

Metadata row in a **clear compact grid**, not nested large cards:

- **Members:** small overlapping avatar stack, names accessible on hover/focus.
- **Timeline:** start/end dates, when real.
- **Milestones:** slim progress track and actual completed/total number, when milestones exist.

Never fabricate client names, milestone counts, or participant avatars. Suppress absent fields gracefully; don't fill them with mock metrics.

## 6. Project page and Kanban board

### 6.1 Information order

1. Breadcrumb
2. Project title, status, brief description
3. Actual team, timeline and milestone context
4. Fine divider / breathing room
5. View switcher (`Board`, `List` if implemented, `Activity`, `Blockers`)
6. Local task search, filter, sort, `Add task`
7. Main Kanban work surface

### 6.2 Board geometry

- Four default columns: **To Do / In Progress / In Review / Done**.
- Column width: **280–312px**; space between 14–18px.
- Column background: `--surface-muted`, subtle and consistent.
- Column head: status dot, title, task count, `+` icon button; no saturated bars.
- Task gap: 10–12px.
- Board should scroll horizontally within its own frame when required.
- Avoid a fixed viewport height that clips cards or comments; consider independent vertical scrolling thoughtfully.

### 6.3 Task card anatomy

```
[Due date, if known]                         [···]

Refine checkout validation
Short, useful context (optional, max 2 lines)

[assignee avatar]                 [comments] [priority]
[small progress bar ONLY if backed by real subtasks]
```

- Background: `--surface`.
- Border: 1px `--border-subtle` or subtle contrast, not both heavy border and shadow.
- Task title: clear, medium-bold, wrap up to 2–3 lines.
- Metadata: visually quiet; use labels/tooltips for icon-only controls.
- Blocked state: concise clay indicator plus text (“Blocked · Awaiting API keys”).
- Priority: one muted label or icon; do not stack brightly colored chips.
- A progress bar appears **only if real subtask/checklist completion exists**. Otherwise omit; the reference's progress bars are a visual pattern, not a requirement to invent percentages.
- Whole card opens task details; overflow menu handles secondary actions.

### 6.4 Drag/drop and task actions

- On hover: small border strengthening, not scale or bounce.
- Drag: subtle 1–2px lift and `--shadow-popover`, no rotation.
- Drop zone: sage dashed/filled hint with clear shape.
- Server-authoritative final position; rollback and toast on failure.
- Keyboard-accessible move-to-column menu required as fallback.
- No fake instantaneous success if the API fails.

## 7. Blocker Radar and Decision Notes

### 7.1 Blocker Radar

Use the same design language as the project page, not a separate feature-showcase dashboard.

Title: `Blockers`  
Optional concise subtitle: `Tasks waiting on a decision, dependency, or resource.`

Active / Resolved as simple tabs with counts from real data.

When populated: compact rows with task, project, reason, owner/waiting on, blocked age and action.

When empty: **no giant boxed empty state**. Use a modest illustration-free inline region, 1–2 sentences:

> No active blockers. Tasks marked blocked will appear here.

Blocker alerts use a small clay line/marker, not large orange banners.

### 7.2 Decision Notes

Mainly within task details as an editorial record: decision title, rationale, author, date, source comment when available.

Display decisions as stacked clean records with hairline separators, rather than deeply nested cards. A global/project index is acceptable only if already functionally implemented.

## 8. Task details and collaboration

Desktop: right-hand drawer **min(600px, 48vw)** or centered dialog according to established application behavior. Mobile: full-screen details panel.

Structure:

- Header: task title, close control, menu
- Context metadata: status, assignee, due date, priority
- Description
- Active blocker callout, only if blocked
- Decisions section, only when applicable
- Comments/activity composer and timeline

Keep discussion legible. Differentiate authored comments from system events by typography and spacing, not a full background color per item.

Use subtle status indicators and real user avatars/initials. No fake simultaneous-editing indicators.

## 9. Login, signup and invitation UX

The first impression should match the product's warm visual quality.

**Desktop layout:** left modest product-story column (40–45%) in oatmeal/ivory, right form column (55–60%) on `--surface`. No giant mock “analytics” graphics. A simplified, honest board illustration using known UI components is acceptable if it does not imply actual account data.

**Login form:** width 380–420px, vertically centered, spacious but not empty. MOTION logomark, “Welcome back”, one-line subheading, email, password, real forgot-password flow if implemented, primary muted-sage button, signup link. No gradient background.

**Signup:** name, email, password. Do not ask for company size, phone or job title just to fill the form. Clearly show errors, pending state, disabled duplicate submissions and password visibility control.

**Invitations:** display workspace name, inviting member where authentic, join/decline action and expired invitation handling.

**Mobile:** single-column form; trim decorative product column; inputs at least 44px high; responsive safe areas; preserve correct autofill behavior.

## 10. Component specifications

| Component | Recommended treatment |
|---|---|
| Primary button | Sage `--accent` fill, warm-white text, 9px radius, 38–42px height |
| Secondary button | Transparent/cream with light border, deep olive text |
| Tertiary button | Text/icon-only with quiet hover wash |
| Input | `--surface`, 1px border, 40–44px height, visible sage focus ring |
| Tabs | Text with thin underline or restrained active wash; no huge pills |
| Status chips | Small labels with pale semantic background, always textual |
| Modal | Warm off-white, 12px radius, subtle shadow, short clear title |
| Toast | Compact, quiet, actionable; no repeated success spam |
| Dropdown | Warm surface, 8–10px radius, shadow only for elevation |
| Empty state | Small type-led explanation, one useful action, not a giant box |
| Avatar | 24–30px in cards, 30–36px in header, initials fallback |
| Divider | `--border-subtle`, used sparingly |

### Focus, hover and disabled

- Focus-visible: ~2px sage outline with offset; never remove keyboard focus.
- Hover: minor surface/border treatment, no scale.
- Disabled: visible disabled state, no misleading clickable affordance.
- Touch controls: accessible hit areas; not all icons must be visually 44px wide if hit areas are.

## 11. Responsive behavior

| Width | Layout decision |
|---|---|
| ≥1440px | Sidebar + full board + contextual task drawer |
| 1024–1439px | Narrower sidebar and horizontal board scrolling as necessary |
| 768–1023px | Collapsible sidebar, compact header, board remains swipe/scrollable |
| ≤767px | Mobile navigation/drawer, single-column project summary, board columns scroll horizontally or have selected-column switcher, full-screen task details |

Test explicitly at 375, 390, 430, 768, 1024, 1280 and 1440px. Prevent accidental **document-level** horizontal overflow. Board-contained scrolling is intentional.

## 12. Motion and accessibility

- Motion: 120–180ms subtle ease-out for dropdowns/dialogs/hover; drag behavior may respond directly to pointer.
- `prefers-reduced-motion`: disable nonessential transitions and animation.
- Text contrast: aim WCAG 2.2 AA (4.5:1 normal, 3:1 large). Non-text UI/focus distinctions: 3:1 where applicable.
- Semantic labels for controls and accessible tab, dialog, menu and drag alternatives.
- Ensure status conveys meaning via text, not only soft colors.
- Do not load external font/animation resources that materially slow first render.

## 13. Implementation guidance

1. **Inspect** existing MOTION components, CSS tokens, layout structure, routes, auth, state, API, Socket.IO and project/task models.
2. **Preserve** backend contracts, data, authorization, task board behavior and operational features.
3. **Create the token layer first** (`styles/tokens.css` or Tailwind theme variables); avoid scattering hardcoded hex colors across components.
4. Update application shell (header/sidebar/project routing) and project header before redesigning task cards.
5. Apply consistent component variants and Kanban geometry.
6. Refine Blocker Radar, Decision Notes and task details using the same system.
7. Redesign login/signup to match MOTION, while preserving real authentication/validation.
8. Run real browser inspection on populated and empty states; do not decide quality from code alone.
9. Verify keyboard, responsive, drag/drop, invite, member permissions, comments, decisions and Socket.IO behavior.
10. Run real lint/typecheck/build/tests supported by the repository and report results; do not invent passes.

### Architecture safeguards

- No new frontend framework purely for styling.
- No backend rewrite.
- No replacing real product data with static fixtures.
- No extra dependencies for decorative UI.
- No dead buttons, fake notification counts, placeholder links or fabricated milestones.
- If a reference UI element lacks a corresponding implemented feature (e.g. `Timeline`, `4/8 milestones`, attachment counters), **omit it**, rather than displaying a fake value.

## 14. Visual QA and acceptance criteria

**Reject the redesign if:**

- Most of the screen is still plain white with no warm layering.
- Any major navigation surface is black, navy, deep purple or saturated orange.
- The page has oversized hero/empty-state cards.
- All controls are pills or every panel has a heavy border.
- Project information is split into unnecessary metric cards.
- Task cards contain more chrome than task content.
- Feature badges say “USP”, “Demo”, “Premium”, etc.
- The Board is buried below a tall header.
- Project management workflows are altered or mocked for visual parity.
- Status can only be inferred from color.

**Accept when:**

- Visual hierarchy follows the reference: compact project context → clean view controls → substantive Kanban surface.
- MOTION feels warm and premium, with cream, oatmeal, sage and soft clay rather than stark white or dark blocks.
- Task cards are practical, readable and concise.
- UI displays only actual member, timeline, milestone and task data.
- Core features remain fully working.
- Login/signup feel like part of the same product.
- Desktop, tablet and mobile show thoughtful responsive behavior.
- Accessibility and build checks are actually executed.

## 15. Handoff prompt for the coding agent

> Read `design.md` as the **authoritative MOTION visual and UX specification**. Inspect the current app before changes. Use the Dribbble reference for its compact project-summary + Kanban composition, but implement the MOTION-owned warm cream/oatmeal/sage visual system defined here. Apply the tokens across the application shell, project view, board, task cards, task drawer, Blocker Radar, Decision Notes and authentication screens. Remove generic dashboard patterns and oversized empty states. Preserve real authentication, PostgreSQL data, backend APIs, permissions, notifications and Socket.IO. Do not invent task fields, progress percentages or features to resemble the reference. Inspect screenshots of the running app at desktop and mobile widths, fix inconsistencies, then execute available lint, typecheck, build and workflow tests. Report precise files changed and verified results; do not merely describe design intentions.

---

**Source attribution:** Inspired by the information architecture and Kanban layout of Pickolab Studio's *Project Management Dashboard — Project Page* on Dribbble. This document supplies an original MOTION brand system, implementation guidance and functional constraints; it is not a reproduction of the source's assets or brand treatment.
