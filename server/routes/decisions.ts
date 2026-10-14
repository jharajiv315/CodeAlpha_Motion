import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { broadcastToProject } from '../realtime/socket.ts';

export const decisionRouter = Router();

const DecisionSchema = z.object({
  title: z.string().min(2, 'Decision title is required'),
  summary: z.string().min(3, 'Decision summary is required'),
  rationale: z.string().optional().default(''),
  sourceCommentId: z.string().nullable().optional(),
});

// GET /api/projects/:projectId/decisions - Project-wide decisions audit trail
decisionRouter.get('/projects/:projectId/decisions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const decisionsRes = await db.query(
      `SELECT d.*, u.name as author_name, u.avatar_url as author_avatar,
              t.title as task_title, t.is_blocked
       FROM task_decisions d
       JOIN tasks t ON t.id = d.task_id
       JOIN users u ON u.id = d.author_id
       WHERE d.project_id = $1
       ORDER BY d.created_at DESC`,
      [projectId]
    );

    res.json({ decisions: decisionsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/decisions - Record decision
decisionRouter.post('/tasks/:id/decisions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = DecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const { title, summary, rationale, sourceCommentId } = parsed.data;

    const taskRes = await db.query('SELECT project_id, title FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    const decisionId = `dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO task_decisions (id, task_id, project_id, title, summary, rationale, author_id, source_comment_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        decisionId,
        id,
        task.project_id,
        title.trim(),
        summary.trim(),
        rationale ? rationale.trim() : null,
        req.user!.id,
        sourceCommentId || null,
      ]
    );

    // Record activity
    await db.query(
      `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, 'decision_recorded', $5, NOW())`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        id,
        task.project_id,
        req.user!.id,
        JSON.stringify({ title: title.trim() }),
      ]
    );

    const created = await db.query(
      `SELECT d.*, u.name as author_name, u.avatar_url as author_avatar
       FROM task_decisions d
       JOIN users u ON u.id = d.author_id
       WHERE d.id = $1`,
      [decisionId]
    );

    // Real-time broadcast
    broadcastToProject(task.project_id, 'decision:created', {
      taskId: id,
      projectId: task.project_id,
      decision: created.rows[0],
    });

    res.status(201).json({ decision: created.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/decisions/:id
decisionRouter.delete('/decisions/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const decRes = await db.query('SELECT * FROM task_decisions WHERE id = $1', [id]);
    if (decRes.rows.length === 0) {
      res.status(404).json({ error: 'Decision not found' });
      return;
    }
    const dec = decRes.rows[0];

    // Only author or project admin can delete
    if (dec.author_id !== req.user!.id) {
      res.status(403).json({ error: 'You do not have permission to delete this decision' });
      return;
    }

    await db.query('DELETE FROM task_decisions WHERE id = $1', [id]);

    broadcastToProject(dec.project_id, 'decision:deleted', {
      taskId: dec.task_id,
      projectId: dec.project_id,
      decisionId: id,
    });

    res.json({ success: true, decisionId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
