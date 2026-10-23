# Implementation Plan: Premium Frosted Slate & Luminous Glass Redesign

Transform the application into a system-designer grade, eye-catching work operating platform featuring **Frosted Slate with Luminous Ice Blue and Indigo glass**, custom geometric prism branding, curated professional iconography, and tactile frosted glassmorphism across all task views, timelines, blocker radars, and navigation.

---

## User Preferences & Design System Core
- **Atmosphere & Palette**: Frosted Slate canvas with ambient luminous mesh glows in Ice Blue (`#38bdf8` / `#0ea5e9`) and Indigo (`#6366f1` / `#4f46e5`), grounded with cool slate neutrals (`#f1f5f9`, `#e2e8f0`, `#0f172a`).
- **Glassmorphic Language**: Balanced frosted glass panels (`backdrop-blur-xl bg-white/75 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]`), soft specular edge highlights, and subtle optical depth.
- **Branding**: Bespoke Geometric Prism vector emblem with faceted refractive gradients, replacing any generic icons or standard placeholders.
- **Iconography & Micro-UI**: Curated professional emojis, subtle status pills, tabular metrics, and crisp Lucide icons.

---

## Proposed Changes

### 1. Global Theme, Ambient Glows & Glass Tokens
#### `src/index.css` & `index.html`
- Add ambient frosted mesh background layers in `index.html` and `src/index.css` with radial gradient glows that illuminate backdrop filters naturally.
- Introduce reusable glass classes (`.glass-panel`, `.glass-card`, `.glass-input`, `.glass-pill`, `.prism-gradient-text`, `.glow-subtle`).
- Fine-tune font rendering and smooth scrolling.

---

### 2. Branding Component
#### `src/components/ui/PrismLogo.tsx` (New)
- Create a modern SVG faceted geometric prism logo with multi-stop linear gradients (Ice Blue into Deep Indigo with internal refractive facet lines).
- Provide sizes (`sm`, `md`, `lg`) and variants with glowing ambient drop-shadow.

---

### 3. Layout, Navigation & Header Polish
#### `src/components/layout/AppLayout.tsx`
- Refactor the sidebar into a frosted glass panel (`backdrop-blur-xl bg-slate-50/80 border-r border-slate-200/60`).
- Embed the new `PrismLogo` and refined brand header with clean workspace selector.
- Style navigation items with luminous ice-blue/indigo active pills and subtle hover transitions.
- Polish header action bar: frosted search input, quick create button with luminous gradient accents, team presence indicators, and user menu.
- Integrate smooth tabs for Board, Blocker Radar, Decisions, and My Tasks.

#### `src/components/layout/HeaderSearchBar.tsx`
- Upgrade to frosted glass container with keyboard shortcut badges (`⌘K`), subtle focus rings, and clear search triggers.

---

### 4. Kanban Board, Swimlanes & Task Cards
#### `src/components/board/KanbanBoard.tsx`
- Restyle board canvas with subtle luminous frosted column headers, task counter badges, and view controls.
- Enhance horizontal swimlanes (grouped by assignee or milestone) with frosted collapsible header strips and progress indicators.
- Refine Archive Drawer trigger and archive restore workflow with clean frosted slide-over panels.

#### `src/components/board/KanbanColumn.tsx`
- Transform columns into frosted glass containers with crisp header typography, quick task entry buttons, and drag-and-drop highlight states.

#### `src/components/board/TaskCard.tsx`
- Elevate task cards into frosted glass cards with soft shadows, subtle borders (`border-white/80 hover:border-sky-300/60`), and smooth hover lift.
- Upgrade the **Time Spent** manual entry tracker and progress bar (actual vs estimated) with ice-blue glowing indicator.
- Redesign **Blocker alert banners** with luminous warning glass and time-in-blocker ticker.
- Render clean priority badges, tag pills, and assignee avatars with status rings.

---

### 5. Blocker Radar & Timeline/Gantt Visualizations
#### `src/components/blockers/BlockerRadarView.tsx`
- Overhaul the Blocker Radar dashboard with concentric radar rings, glass metric cards (Active Blockers, Critical Paths, Avg Resolution Time), and dependency flow connections.
- Add frosted filter chips and smooth blocker resolution modal styling.

#### `src/components/ui/PriorityBadge.tsx`
- Upgrade priority badges (`Urgent`, `High`, `Medium`, `Low`) with frosted glass pills, refined typography, and distinct non-vibrant color coding.

---

### 6. Modals & Interactive Overlays
#### `src/components/task/TaskDetailModal.tsx` & `CreateTaskModal.tsx`
- Polish modals with frosted backdrop blur (`backdrop-blur-md bg-slate-900/30`), crisp glass modal windows with top-edge specular highlights, and organized tabs (Overview, Time Log, Dependencies, History).

---

## User Review Required
> No breaking architectural changes or new heavy external packages are required. All enhancements will use Tailwind CSS, Lucide icons, and modern CSS glassmorphism.

---

## Verification Plan
1. **Compilation Check**: Run `compile_applet` to ensure zero TypeScript errors or missing imports.
2. **Visual & UI Verification**:
   - Inspect sidebar navigation, workspace switcher, and the new Prism geometric logo.
   - Verify Kanban board columns, swimlanes, and task card glassmorphism in both standard and collapsed swimlane views.
   - Verify Time Spent logging, progress bars, and Blocker badges on task cards.
   - Check Blocker Radar dashboard metrics and dependency cards.
   - Open Task Detail and Create Task modals to verify glass backdrop and dialog elevation.
