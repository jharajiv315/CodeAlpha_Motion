import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const notificationRouter = Router();

// GET /api/notifications
notificationRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await db.query(
      `SELECT n.*, p.name as project_name
       FROM notifications n
       LEFT JOIN projects p ON p.id = n.project_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC LIMIT 50`,
      [req.user!.id]
    );

    const unreadCount = result.rows.filter((n) => !n.is_read).length;
    res.json({ notifications: result.rows, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
notificationRouter.patch('/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
notificationRouter.post('/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user!.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/my-work - Focused personal work view
notificationRouter.get('/my-work', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // 1. Tasks where user is an assignee
    const assignedRes = await db.query(
      `SELECT t.*, p.name as project_name, c.name as column_name,
              u_creator.name as creator_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN board_columns c ON c.id = t.column_id
       JOIN users u_creator ON u_creator.id = t.creator_id
       JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
       ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
      [userId]
    );

    // 2. Tasks where user is marked as the blocker contact (waiting_on_user_id)
    const blockingMeRes = await db.query(
      `SELECT t.*, p.name as project_name, c.name as column_name,
              b.reason as blocker_reason, b.created_at as blocker_created_at,
              u_by.name as blocked_by_name
       FROM task_blockers b
       JOIN tasks t ON t.id = b.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN board_columns c ON c.id = t.column_id
       JOIN users u_by ON u_by.id = b.created_by_id
       WHERE b.waiting_on_user_id = $1 AND b.is_resolved = FALSE
       ORDER BY b.created_at ASC`,
      [userId]
    );

    // Fetch assignees for all fetched tasks
    const allTaskIds = Array.from(
      new Set([...assignedRes.rows.map((t) => t.id), ...blockingMeRes.rows.map((t) => t.id)])
    );

    let assigneesByTask: Record<string, any[]> = {};
    if (allTaskIds.length > 0) {
      const aRes = await db.query(
        `SELECT ta.task_id, u.id as user_id, u.name, u.email, u.title, u.avatar_url
         FROM task_assignees ta
         JOIN users u ON u.id = ta.user_id
         WHERE ta.task_id = ANY($1)`,
        [allTaskIds]
      );
      for (const a of aRes.rows) {
        if (!assigneesByTask[a.task_id]) assigneesByTask[a.task_id] = [];
        assigneesByTask[a.task_id].push(a);
      }
    }

    const assignedTasks = assignedRes.rows.map((t) => ({
      ...t,
      assignees: assigneesByTask[t.id] || [],
    }));

    const blockingMeTasks = blockingMeRes.rows.map((t) => ({
      ...t,
      assignees: assigneesByTask[t.id] || [],
    }));

    res.json({
      assignedTasks,
      blockingMeTasks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
