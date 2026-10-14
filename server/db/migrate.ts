import fs from 'node:fs';
import path from 'node:path';
import { db } from './database.ts';

export async function runMigrations(): Promise<void> {
  console.log('[Migrations] Running PostgreSQL migrations...');
  await db.init();
  const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  // Execute schema
  await db.exec(sql);

  // Seed sample task dependencies if table is empty and tasks exist
  try {
    const depsCheck = await db.query('SELECT COUNT(*) as count FROM task_dependencies');
    if (parseInt(depsCheck.rows[0]?.count || '0', 10) === 0) {
      await db.query(`
        INSERT INTO task_dependencies (id, task_id, depends_on_task_id, created_at)
        SELECT 'dep_1', 'tsk_idx', 'tsk_pay', NOW() - INTERVAL '1 day'
        WHERE EXISTS (SELECT 1 FROM tasks WHERE id = 'tsk_idx')
          AND EXISTS (SELECT 1 FROM tasks WHERE id = 'tsk_pay')
        ON CONFLICT DO NOTHING;
      `);
      await db.query(`
        INSERT INTO task_dependencies (id, task_id, depends_on_task_id, created_at)
        SELECT 'dep_2', 'tsk_kbd', 'tsk_tokens', NOW() - INTERVAL '2 days'
        WHERE EXISTS (SELECT 1 FROM tasks WHERE id = 'tsk_kbd')
          AND EXISTS (SELECT 1 FROM tasks WHERE id = 'tsk_tokens')
        ON CONFLICT DO NOTHING;
      `);
    }

    // Seed default daily digest settings for existing workspaces
    await db.query(`
      INSERT INTO daily_digest_settings (id, workspace_id, is_enabled, scheduled_hour, scheduled_minute, include_blockers, days_ahead, recipient_email_override, created_at, updated_at)
      SELECT 'set_' || id, id, TRUE, 8, 0, TRUE, 7, 'jharajiv315@gmail.com', NOW(), NOW()
      FROM workspaces
      ON CONFLICT (id) DO NOTHING;
    `).catch(() => {});

    // Ensure Rajiv's email matches the user email
    await db.query(`
      UPDATE users
      SET email = 'jharajiv315@gmail.com'
      WHERE id = 'usr_rajiv' AND (email = 'rajiv@motion.dev' OR email IS NULL)
    `).catch(() => {});

    // Time tracking columns migration for existing database
    await db.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6, 2) DEFAULT NULL;
    `).catch(() => {});
    await db.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_spent_hours NUMERIC(6, 2) DEFAULT 0;
    `).catch(() => {});

    // Create task_time_logs if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS task_time_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hours NUMERIC(6, 2) NOT NULL CHECK (hours > 0),
        description TEXT DEFAULT '',
        logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_time_logs_task ON task_time_logs(task_id, logged_at DESC);
      CREATE INDEX IF NOT EXISTS idx_time_logs_user ON task_time_logs(user_id);
    `).catch(() => {});

    // Seed realistic estimated vs actual effort for existing tasks if no time logs exist
    const logsCheck = await db.query('SELECT COUNT(*) as count FROM task_time_logs');
    if (parseInt(logsCheck.rows[0]?.count || '0', 10) === 0) {
      // 1. Set realistic estimates
      await db.query(`
        UPDATE tasks SET estimated_hours = 8.0 WHERE id = 'tsk_pay' AND estimated_hours IS NULL;
        UPDATE tasks SET estimated_hours = 4.0 WHERE id = 'tsk_kbd' AND estimated_hours IS NULL;
        UPDATE tasks SET estimated_hours = 10.0 WHERE id = 'tsk_tokens' AND estimated_hours IS NULL;
        UPDATE tasks SET estimated_hours = 6.0 WHERE id = 'tsk_idx' AND estimated_hours IS NULL;
      `).catch(() => {});

      // 2. Insert sample work logs
      await db.query(`
        INSERT INTO task_time_logs (id, task_id, user_id, hours, description, logged_at, created_at)
        VALUES
        ('log_1', 'tsk_pay', 'usr_mitesh', 2.5, 'Webhook signature verification logic and replay attack mitigation', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
        ('log_2', 'tsk_pay', 'usr_rajiv', 2.0, 'Stripe developer portal configuration and webhook test endpoints', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '18 hours'),
        ('log_3', 'tsk_kbd', 'usr_ansh', 3.0, 'Keyboard shortcut listeners, ARIA attributes and focus trapping', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
        ('log_4', 'tsk_kbd', 'usr_ansh', 2.0, 'Fix focus restoration bug when dropdown closes via Escape key', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),
        ('log_5', 'tsk_tokens', 'usr_elena', 6.0, 'Color tokens extraction, semantic mapping, and WCAG AA audit', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
        ('log_6', 'tsk_tokens', 'usr_elena', 3.5, 'CSS variable integration and theme verification across cards', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
        ('log_7', 'tsk_idx', 'usr_mitesh', 2.0, 'Postgres EXPLAIN ANALYZE on foreign key joins and task lookups', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours')
        ON CONFLICT (id) DO NOTHING;
      `).catch(() => {});

      // 3. Update tasks time_spent_hours totals to match
      await db.query(`
        UPDATE tasks t
        SET time_spent_hours = COALESCE((
          SELECT SUM(hours) FROM task_time_logs WHERE task_id = t.id
        ), 0);
      `).catch(() => {});
    }
  } catch (err) {
    console.warn('[Migrations] Note on task dependencies/time tracking seed:', err);
  }

  console.log('[Migrations] Schema applied successfully.');
}
