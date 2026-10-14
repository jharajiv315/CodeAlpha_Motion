# MOTION — Move work forward

A calm, collaborative work platform for small teams who need clarity about tasks, ownership, blockers, and decisions.

MOTION solves the core problems small teams face in day-to-day collaboration:
- **"What is preventing progress?"** Solved by **USP 1: Blocker Radar**.
- **"What did we agree on, and why?"** Solved by **USP 2: Decision Notes**.

---

## Flagship Differentiators

### 1. Blocker Radar
Blocked is an operational condition, not merely a Kanban column. When work stalls on missing credentials, design approvals, or third-party dependencies, team members mark the task as blocked:
- Records the precise obstacle reason.
- Designates who can help unblock it (with instant high-priority notification).
- Calculates blocker age ("2d active") to prevent silent stagnation.
- Preserves the task's original workflow column.
- Features a project-wide **Blocker Radar** view to track active obstacles and record resolution notes when unblocked.

### 2. Decision Notes
Teams frequently make vital agreements inside task comment threads that get lost over time. Decision Notes allow members to record explicit agreements:
- Authoritative title, summary, and rationale.
- 1-click **"Convert to Decision"** from any discussion comment.
- Project-wide Decision Register for clear audit trails without relying on unpredictable AI summarization.

---

## Technical Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, `@dnd-kit` accessible drag-and-drop.
- **Backend**: Node.js, Express, Socket.IO for real-time bi-directional synchronization.
- **Database**: PostgreSQL (relational schema with foreign keys, constraints, indexes, triggers, and automated migrations). Runs seamlessly on embedded PostgreSQL (`@electric-sql/pglite`) or external PostgreSQL (`DATABASE_URL`).
- **Authentication**: Salted `bcryptjs` password hashing, JSON Web Tokens (JWT), HttpOnly cookie with Bearer authorization fallback.
- **Real-time Engine**: Socket.IO rooms partitioned by `project:${projectId}` and `user:${userId}` with presence tracking and reconnection reconciliation.

---

## Getting Started

### Prerequisites
- Node.js 20+

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key variables:
- `PORT`: Server port (default `3000`).
- `DATABASE_URL`: (Optional) External PostgreSQL connection string. If omitted, MOTION automatically uses embedded PostgreSQL with persistent disk storage in `./data/postgres_db`.
- `JWT_SECRET`: Secret key for session signing.

### Startup
Install dependencies and run the full-stack development server:
```bash
npm install
npm run dev
```
The server will automatically:
1. Apply PostgreSQL schema migrations (`server/db/schema.sql`).
2. Seed realistic small team workspaces (`Acme Studio` and `Campus Capstone`) with active tasks, blockers, and decision notes.
3. Start the Express API and Socket.IO server on port 3000.
4. Mount Vite frontend middleware.

---

## Quick Multi-User Collaboration Testing

MOTION includes 4 pre-configured seed accounts for immediate 2-user collaboration testing:
1. **Rajiv Sharma** (`rajiv@motion.dev` / `password123`) — Product Lead
2. **Ansh Patel** (`ansh@motion.dev` / `password123`) — Frontend Engineer
3. **Mitesh Kumar** (`mitesh@motion.dev` / `password123`) — Backend Engineer
4. **Elena Rostova** (`elena@motion.dev` / `password123`) — Product Designer

Use the **"Switch User"** menu in the top bar to test real-time updates between different team member perspectives in seconds!
