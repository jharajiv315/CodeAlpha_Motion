import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { broadcastToProject, broadcastToUser } from '../realtime/socket.ts';

export const blockerRouter = Router();

const MarkBlockedSchema = z.object({
  reason: z.string().min(3, 'Please describe what is preventing progress'),
  waitingOnUserId: z.string().nullable().optional(),
  waitingOnTeamText: z.string().nullable().optional(),
});

const ResolveBlockerSchema = z.object({
  resolutionNote: z.string().min(2, 'Please provide a brief resolution note'),
});

// GET /api/projects/:projectId/blockers - Flagship USP: Blocker Radar feed
blockerRouter.get('/projects/:projectId/blockers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const { status = 'active' } = req.query; // 'active', 'resolved', 'all'

    let whereClause = 'b.project_id = $1';
    if (status === 'active') {
      whereClause += ' AND b.is_resolved = FALSE';
    } else if (status === 'resolved') {
      whereClause += ' AND b.is_resolved = TRUE';
    }

    const blockersRes = await db.query(
      `SELECT b.*,
              t.title as task_title, t.priority as task_priority, t.due_date as task_due_date,
              c.name as column_name,
              u_wait.name as waiting_on_name, u_wait.email as waiting_on_email,
              u_by.name as created_by_name,
              u_res.name as resolved_by_name
       FROM task_blockers b
       JOIN tasks t ON t.id = b.task_id
       JOIN board_columns c ON c.id = t.column_id
       LEFT JOIN users u_wait ON u_wait.id = b.waiting_on_user_id
       LEFT JOIN users u_by ON u_by.id = b.created_by_id
       LEFT JOIN users u_res ON u_res.id = b.resolved_by_id
       WHERE ${whereClause}
       ORDER BY b.is_resolved ASC, b.created_at DESC`,
      [projectId]
    );

    // Fetch assignees for each task in blocker radar
    const taskIds = Array.from(new Set(blockersRes.rows.map((b) => b.task_id)));
    let assigneesByTask: Record<string, any[]> = {};
    if (taskIds.length > 0) {
      const assigneesRes = await db.query(
        `SELECT ta.task_id, u.id as user_id, u.name, u.email, u.title, u.avatar_url
         FROM task_assignees ta
         JOIN users u ON u.id = ta.user_id
         WHERE ta.task_id = ANY($1)`,
        [taskIds]
      );
      for (const a of assigneesRes.rows) {
        if (!assigneesByTask[a.task_id]) assigneesByTask[a.task_id] = [];
        assigneesByTask[a.task_id].push(a);
      }
    }

    const blockers = blockersRes.rows.map((b) => ({
      ...b,
      taskAssignees: assigneesByTask[b.task_id] || [],
    }));

    res.json({ blockers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/block - Flagship USP: Mark as Blocked
blockerRouter.post('/tasks/:id/block', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = MarkBlockedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const { reason, waitingOnUserId, waitingOnTeamText } = parsed.data;

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    // Mark task as blocked (retaining current column!)
    await db.query('UPDATE tasks SET is_blocked = TRUE, updated_at = NOW() WHERE id = $1', [id]);

    const blockerId = `blk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO task_blockers (id, task_id, project_id, reason, waiting_on_user_id, waiting_on_team_text, created_by_id, is_resolved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())`,
      [blockerId, id, task.project_id, reason.trim(), waitingOnUserId || null, waitingOnTeamText || null, req.user!.id]
    );

    // Record activity
    await db.query(
      `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, 'task_blocked', $5, NOW())`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        id,
        task.project_id,
        req.user!.id,
        JSON.stringify({ reason: reason.trim(), waitingOnUserId }),
      ]
    );

    // Send notification to waitingOnUserId if specified
    if (waitingOnUserId && waitingOnUserId !== req.user!.id) {
      const notifId = `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      await db.query(
        `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, project_id, is_read, created_at)
         VALUES ($1, $2, 'BLOCKER_ASSIGNED', $3, $4, 'TASK', $5, $6, FALSE, NOW())`,
        [
          notifId,
          waitingOnUserId,
          `Action Needed: Blocker on ${task.title}`,
          `${req.user!.name} is waiting on you: "${reason.trim()}"`,
          id,
          task.project_id,
        ]
      );

      broadcastToUser(waitingOnUserId, 'notification:created', {
        id: notifId,
        type: 'BLOCKER_ASSIGNED',
        title: `Action Needed: Blocker on ${task.title}`,
        body: `${req.user!.name} is waiting on you: "${reason.trim()}"`,
        entity_id: id,
        project_id: task.project_id,
        created_at: new Date().toISOString(),
      });
    }

    const blockerDetail = await db.query(
      `SELECT b.*, u.name as waiting_on_name, c.name as created_by_name
       FROM task_blockers b
       LEFT JOIN users u ON u.id = b.waiting_on_user_id
       LEFT JOIN users c ON c.id = b.created_by_id
       WHERE b.id = $1`,
      [blockerId]
    );

    // Real-time broadcast to the project room
    broadcastToProject(task.project_id, 'blocker:created', {
      taskId: id,
      projectId: task.project_id,
      blocker: blockerDetail.rows[0],
    });

    res.status(201).json({ blocker: blockerDetail.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/unblock - Flagship USP: Resolve Blocker
blockerRouter.post('/tasks/:id/unblock', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = ResolveBlockerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const { resolutionNote } = parsed.data;

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    // Find active blocker
    const activeBlockerRes = await db.query(
      'SELECT id, created_by_id FROM task_blockers WHERE task_id = $1 AND is_resolved = FALSE ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    if (activeBlockerRes.rows.length === 0) {
      res.status(400).json({ error: 'No active blocker found for this task' });
      return;
    }

    const activeBlocker = activeBlockerRes.rows[0];

    // Mark blocker resolved
    await db.query(
      `UPDATE task_blockers
       SET is_resolved = TRUE, resolved_by_id = $1, resolution_note = $2, resolved_at = NOW()
       WHERE id = $3`,
      [req.user!.id, resolutionNote.trim(), activeBlocker.id]
    );

    // Unmark task is_blocked
    await db.query('UPDATE tasks SET is_blocked = FALSE, updated_at = NOW() WHERE id = $1', [id]);

    // Record activity
    await db.query(
      `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, 'blocker_resolved', $5, NOW())`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        id,
        task.project_id,
        req.user!.id,
        JSON.stringify({ note: resolutionNote.trim() }),
      ]
    );

    // Notify original blocker creator if someone else resolved it
    if (activeBlocker.created_by_id !== req.user!.id) {
      const notifId = `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      await db.query(
        `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, project_id, is_read, created_at)
         VALUES ($1, $2, 'BLOCKER_RESOLVED', $3, $4, 'TASK', $5, $6, FALSE, NOW())`,
        [
          notifId,
          activeBlocker.created_by_id,
          `Blocker Resolved: ${task.title}`,
          `${req.user!.name} resolved the blocker: "${resolutionNote.trim()}"`,
          id,
          task.project_id,
        ]
      );

      broadcastToUser(activeBlocker.created_by_id, 'notification:created', {
        id: notifId,
        type: 'BLOCKER_RESOLVED',
        title: `Blocker Resolved: ${task.title}`,
        body: `${req.user!.name} resolved the blocker: "${resolutionNote.trim()}"`,
        entity_id: id,
        project_id: task.project_id,
        created_at: new Date().toISOString(),
      });
    }

    // Broadcast resolution to project
    broadcastToProject(task.project_id, 'blocker:resolved', {
      taskId: id,
      projectId: task.project_id,
      blockerId: activeBlocker.id,
      resolvedByName: req.user!.name,
      resolutionNote: resolutionNote.trim(),
    });

    res.json({ success: true, taskId: id, blockerId: activeBlocker.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
