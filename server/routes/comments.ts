import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { broadcastToProject, broadcastToUser } from '../realtime/socket.ts';

export const commentRouter = Router();

const AddCommentSchema = z.object({
  body: z.string().min(1, 'Comment body cannot be empty'),
});

// POST /api/tasks/:id/comments
commentRouter.post('/tasks/:id/comments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = AddCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const { body } = parsed.data;

    const taskRes = await db.query(
      'SELECT t.project_id, t.title, t.creator_id FROM tasks t WHERE t.id = $1',
      [id]
    );
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    const commentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO comments (id, task_id, author_id, body, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [commentId, id, req.user!.id, body.trim()]
    );

    const commentRes = await db.query(
      `SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.id = $1`,
      [commentId]
    );

    const comment = commentRes.rows[0];

    // Notify task creator and assignees (if not author)
    const assignees = await db.query('SELECT user_id FROM task_assignees WHERE task_id = $1', [id]);
    const recipients = new Set<string>();
    if (task.creator_id !== req.user!.id) recipients.add(task.creator_id);
    for (const a of assignees.rows) {
      if (a.user_id !== req.user!.id) recipients.add(a.user_id);
    }

    for (const recipientId of recipients) {
      const notifId = `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      await db.query(
        `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, project_id, is_read, created_at)
         VALUES ($1, $2, 'TASK_COMMENT', $3, $4, 'TASK', $5, $6, FALSE, NOW())`,
        [
          notifId,
          recipientId,
          `Comment on: ${task.title}`,
          `${req.user!.name}: "${body.trim().substring(0, 80)}${body.trim().length > 80 ? '...' : ''}"`,
          id,
          task.project_id,
        ]
      );

      broadcastToUser(recipientId, 'notification:created', {
        id: notifId,
        type: 'TASK_COMMENT',
        title: `Comment on: ${task.title}`,
        body: `${req.user!.name}: "${body.trim().substring(0, 80)}${body.trim().length > 80 ? '...' : ''}"`,
        entity_id: id,
        project_id: task.project_id,
        created_at: new Date().toISOString(),
      });
    }

    // Broadcast comment to project
    broadcastToProject(task.project_id, 'comment:created', {
      taskId: id,
      projectId: task.project_id,
      comment,
    });

    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/comments/:id
commentRouter.delete('/comments/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const commentRes = await db.query(
      `SELECT c.*, t.project_id
       FROM comments c
       JOIN tasks t ON t.id = c.task_id
       WHERE c.id = $1`,
      [id]
    );

    if (commentRes.rows.length === 0) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    const comment = commentRes.rows[0];

    if (comment.author_id !== req.user!.id) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    await db.query('DELETE FROM comments WHERE id = $1', [id]);

    broadcastToProject(comment.project_id, 'comment:deleted', {
      taskId: comment.task_id,
      projectId: comment.project_id,
      commentId: id,
    });

    res.json({ success: true, commentId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
