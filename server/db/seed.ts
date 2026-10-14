import bcrypt from 'bcryptjs';
import { db } from './database.ts';

export async function seedDatabase(): Promise<void> {
  const existingUsers = await db.query('SELECT COUNT(*) as count FROM users');
  if (parseInt(existingUsers.rows[0]?.count || '0', 10) > 0) {
    console.log('[Seed] Database already seeded. Skipping seed.');
    return;
  }

  console.log('[Seed] Seeding realistic data for small product and student teams...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const users = [
    { id: 'usr_rajiv', email: 'rajiv@motion.dev', name: 'Rajiv Sharma', title: 'Product Lead' },
    { id: 'usr_ansh', email: 'ansh@motion.dev', name: 'Ansh Patel', title: 'Frontend Engineer' },
    { id: 'usr_mitesh', email: 'mitesh@motion.dev', name: 'Mitesh Kumar', title: 'Backend Engineer' },
    { id: 'usr_elena', email: 'elena@motion.dev', name: 'Elena Rostova', title: 'Product Designer' },
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, email, password_hash, name, title, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [u.id, u.email, passwordHash, u.name, u.title]
    );
  }

  // 2. Workspaces
  // Workspace 1: Acme Studio (Product team)
  await db.query(
    `INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    ['ws_acme', 'Acme Studio', 'acme-studio', 'usr_rajiv']
  );

  // Members of Acme Studio
  await db.query(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
     VALUES
     ('wm_1', 'ws_acme', 'usr_rajiv', 'OWNER', NOW()),
     ('wm_2', 'ws_acme', 'usr_ansh', 'ADMIN', NOW()),
     ('wm_3', 'ws_acme', 'usr_mitesh', 'MEMBER', NOW()),
     ('wm_4', 'ws_acme', 'usr_elena', 'MEMBER', NOW())`
  );

  // Workspace 2: Campus Capstone (Student project)
  await db.query(
    `INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    ['ws_capstone', 'Campus Capstone', 'campus-capstone', 'usr_ansh']
  );

  await db.query(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
     VALUES
     ('wm_5', 'ws_capstone', 'usr_ansh', 'OWNER', NOW()),
     ('wm_6', 'ws_capstone', 'usr_rajiv', 'ADMIN', NOW()),
     ('wm_7', 'ws_capstone', 'usr_mitesh', 'MEMBER', NOW())`
  );

  // 3. Projects in Acme Studio
  // Project 1: Core Platform V2
  await db.query(
    `INSERT INTO projects (id, workspace_id, name, description, status, creator_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    ['prj_core', 'ws_acme', 'Core Platform V2', 'Rebuilding navigation, task persistence, and billing sync for small teams.', 'ACTIVE', 'usr_rajiv']
  );

  await db.query(
    `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
     VALUES
     ('pm_1', 'prj_core', 'usr_rajiv', 'ADMIN', NOW()),
     ('pm_2', 'prj_core', 'usr_ansh', 'MEMBER', NOW()),
     ('pm_3', 'prj_core', 'usr_mitesh', 'MEMBER', NOW()),
     ('pm_4', 'prj_core', 'usr_elena', 'MEMBER', NOW())`
  );

  // Project 2: Mobile Client
  await db.query(
    `INSERT INTO projects (id, workspace_id, name, description, status, creator_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    ['prj_mobile', 'ws_acme', 'Mobile Client', 'Responsive board adaptation and quick capture workflows for iOS and Android web.', 'ACTIVE', 'usr_ansh']
  );

  await db.query(
    `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
     VALUES
     ('pm_5', 'prj_mobile', 'usr_ansh', 'ADMIN', NOW()),
     ('pm_6', 'prj_mobile', 'usr_rajiv', 'MEMBER', NOW()),
     ('pm_7', 'prj_mobile', 'usr_elena', 'MEMBER', NOW())`
  );

  // 4. Default Columns for prj_core
  const columnsCore = [
    { id: 'col_c_todo', name: 'TO DO', position: 0 },
    { id: 'col_c_prog', name: 'IN PROGRESS', position: 1 },
    { id: 'col_c_rev', name: 'IN REVIEW', position: 2 },
    { id: 'col_c_done', name: 'DONE', position: 3 },
  ];

  for (const c of columnsCore) {
    await db.query(
      `INSERT INTO board_columns (id, project_id, name, position, is_default, created_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())`,
      [c.id, 'prj_core', c.name, c.position]
    );
  }

  // Columns for prj_mobile
  const columnsMobile = [
    { id: 'col_m_todo', name: 'TO DO', position: 0 },
    { id: 'col_m_prog', name: 'IN PROGRESS', position: 1 },
    { id: 'col_m_rev', name: 'IN REVIEW', position: 2 },
    { id: 'col_m_done', name: 'DONE', position: 3 },
  ];

  for (const c of columnsMobile) {
    await db.query(
      `INSERT INTO board_columns (id, project_id, name, position, is_default, created_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())`,
      [c.id, 'prj_mobile', c.name, c.position]
    );
  }

  // 5. Tasks in Core Platform V2
  // Task 1: Integrate Payment Gateway (Blocked)
  await db.query(
    `INSERT INTO tasks (id, project_id, column_id, title, description, priority, due_date, creator_id, position, is_blocked, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '3 days', $7, $8, TRUE, NOW() - INTERVAL '2 days', NOW())`,
    [
      'tsk_pay',
      'prj_core',
      'col_c_prog',
      'Integrate Payment Webhook Handlers',
      'Set up Stripe subscription webhook verification, customer portal session link generation, and seat count validation.',
      'HIGH',
      'usr_rajiv',
      0,
    ]
  );
  await db.query(
    `INSERT INTO task_assignees (id, task_id, user_id) VALUES ('ta_1', 'tsk_pay', 'usr_mitesh')`
  );

  // Blocker on Task 1
  await db.query(
    `INSERT INTO task_blockers (id, task_id, project_id, reason, waiting_on_user_id, created_by_id, is_resolved, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW() - INTERVAL '1 day')`,
    [
      'blk_1',
      'tsk_pay',
      'prj_core',
      'Waiting on production Stripe webhook secret and sandbox testing credentials from finance team.',
      'usr_rajiv',
      'usr_mitesh',
    ]
  );

  // Comments on Task 1
  await db.query(
    `INSERT INTO comments (id, task_id, author_id, body, created_at)
     VALUES
     ('cmt_1', 'tsk_pay', 'usr_mitesh', 'Endpoint scaffolding is complete with idempotent event receipt. Marked blocked until we get the API keys from Rajiv.', NOW() - INTERVAL '1 day'),
     ('cmt_2', 'tsk_pay', 'usr_rajiv', 'Finance is approving the test credentials today. Will unblock by 4 PM.', NOW() - INTERVAL '5 hours')`
  );

  // Decision on Task 1
  await db.query(
    `INSERT INTO task_decisions (id, task_id, project_id, title, summary, rationale, author_id, source_comment_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - INTERVAL '2 days')`,
    [
      'dec_1',
      'tsk_pay',
      'prj_core',
      'Handle seat increments via customer portal rather than custom UI',
      'Let customers manage payment method and tier upgrades directly in Stripe-hosted Customer Portal.',
      'Saves two weeks of PCI DSS scope and custom invoicing UI development.',
      'usr_rajiv',
      null,
    ]
  );

  // Task 2: Refine Keyboard Navigation on Kanban
  await db.query(
    `INSERT INTO tasks (id, project_id, column_id, title, description, priority, due_date, creator_id, position, is_blocked, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '2 days', $7, $8, FALSE, NOW() - INTERVAL '3 days', NOW())`,
    [
      'tsk_kbd',
      'prj_core',
      'col_c_prog',
      'Accessible Keyboard Navigation for Task Movement',
      'Provide Alt+Arrow / dedicated quick-move dropdown so users can move cards without relying on drag-and-drop.',
      'URGENT',
      'usr_rajiv',
      1,
    ]
  );
  await db.query(
    `INSERT INTO task_assignees (id, task_id, user_id) VALUES ('ta_2', 'tsk_kbd', 'usr_ansh')`
  );
  await db.query(
    `INSERT INTO comments (id, task_id, author_id, body, created_at)
     VALUES ('cmt_3', 'tsk_kbd', 'usr_ansh', 'Added quick-action dropdown menu to card actions so keyboard users can move cards directly to any column.', NOW() - INTERVAL '6 hours')`
  );

  // Task 3: Design Tokens and Neutral Color Palette
  await db.query(
    `INSERT INTO tasks (id, project_id, column_id, title, description, priority, due_date, creator_id, position, is_blocked, completed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 day', $7, $8, FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 days', NOW())`,
    [
      'tsk_tokens',
      'prj_core',
      'col_c_done',
      'Design Tokens and Neutral Color System',
      'Standardized warm stone neutrals, subtle border hierarchy, and semantic accent tokens for blockers and resolutions.',
      'MEDIUM',
      'usr_elena',
      0,
    ]
  );
  await db.query(
    `INSERT INTO task_assignees (id, task_id, user_id) VALUES ('ta_3', 'tsk_tokens', 'usr_elena')`
  );
  await db.query(
    `INSERT INTO task_decisions (id, task_id, project_id, title, summary, rationale, author_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '1 day')`,
    [
      'dec_2',
      'tsk_tokens',
      'prj_core',
      'Adopt stone neutral palette with high-contrast text',
      'Use stone-50 background with stone-900 primary typography and stone-200 borders.',
      'Eliminates glare, improves legibility for long working hours, and avoids generic blue SaaS saturation.',
      'usr_elena',
    ]
  );

  // Task 4: PostgreSQL Index Optimization
  await db.query(
    `INSERT INTO tasks (id, project_id, column_id, title, description, priority, due_date, creator_id, position, is_blocked, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '5 days', $7, $8, FALSE, NOW() - INTERVAL '1 day', NOW())`,
    [
      'tsk_idx',
      'prj_core',
      'col_c_todo',
      'Index Optimization for Task Filters & Blocker Radar',
      'Add composite indexes on (project_id, position) and (project_id, is_blocked) to ensure sub-millisecond query performance as task volume grows.',
      'LOW',
      'usr_mitesh',
      0,
    ]
  );
  await db.query(
    `INSERT INTO task_assignees (id, task_id, user_id) VALUES ('ta_4', 'tsk_idx', 'usr_mitesh')`
  );

  // Activity events
  await db.query(
    `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
     VALUES
     ('act_1', 'tsk_pay', 'prj_core', 'usr_rajiv', 'task_created', '{"title": "Integrate Payment Webhook Handlers"}', NOW() - INTERVAL '2 days'),
     ('act_2', 'tsk_pay', 'prj_core', 'usr_mitesh', 'task_blocked', '{"reason": "Waiting on production Stripe webhook secret"}', NOW() - INTERVAL '1 day'),
     ('act_3', 'tsk_pay', 'prj_core', 'usr_rajiv', 'decision_recorded', '{"title": "Handle seat increments via customer portal"}', NOW() - INTERVAL '2 days'),
     ('act_4', 'tsk_kbd', 'prj_core', 'usr_rajiv', 'task_created', '{"title": "Accessible Keyboard Navigation"}', NOW() - INTERVAL '3 days'),
     ('act_5', 'tsk_tokens', 'prj_core', 'usr_elena', 'status_changed', '{"from": "IN PROGRESS", "to": "DONE"}', NOW() - INTERVAL '1 day')`
  );

  // Notifications
  await db.query(
    `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, project_id, is_read, created_at)
     VALUES
     ('ntf_1', 'usr_rajiv', 'BLOCKER_ASSIGNED', 'Blocker on: Integrate Payment Webhook Handlers', 'Mitesh Kumar marked task blocked: Waiting on production Stripe webhook secret', 'TASK', 'tsk_pay', 'prj_core', FALSE, NOW() - INTERVAL '1 day'),
     ('ntf_2', 'usr_ansh', 'TASK_ASSIGNED', 'Assigned: Accessible Keyboard Navigation', 'Rajiv Sharma assigned you to this task', 'TASK', 'tsk_kbd', 'prj_core', TRUE, NOW() - INTERVAL '3 days')`
  );

  console.log('[Seed] Seeding completed successfully.');
}
