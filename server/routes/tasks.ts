import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { broadcastToProject, broadcastToUser } from '../realtime/socket.ts';

export const taskRouter = Router();

function stripEmojis(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PrioritySchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const upper = val.toUpperCase().trim();
    if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH') return upper;
    if (upper === 'URGENT') return 'HIGH';
    if (upper === 'NONE') return 'LOW';
  }
  return 'MEDIUM';
}, z.enum(['LOW', 'MEDIUM', 'HIGH']));

const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').transform(stripEmojis),
  description: z.string().optional().default('').transform(stripEmojis),
  columnId: z.string().min(1, 'Column is required'),
  priority: PrioritySchema.default('MEDIUM'),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  assigneeIds: z.array(z.string()).optional().default([]),
  dependsOnTaskIds: z.array(z.string()).optional().default([]),
});

// GET /api/projects/:projectId/tasks
taskRouter.get('/projects/:projectId/tasks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;

    // Check project authorization
    const access = await db.query(
      `SELECT p.id FROM projects p
       LEFT JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = $1
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
       WHERE p.id = $2`,
      [req.user!.id, projectId]
    );

    if (access.rows.length === 0) {
      res.status(403).json({ error: 'You do not have access to this project' });
      return;
    }

    // Query tasks
    const tasksRes = await db.query(
      `SELECT t.id, t.project_id, t.column_id, t.title, t.description, t.priority,
              t.due_date, t.creator_id, t.position, t.is_blocked, t.completed_at,
              t.estimated_hours, t.time_spent_hours,
              t.created_at, t.updated_at,
              u.name as creator_name
       FROM tasks t
       JOIN users u ON u.id = t.creator_id
       WHERE t.project_id = $1
       ORDER BY t.position ASC, t.created_at ASC`,
      [projectId]
    );

    const taskIds = tasksRes.rows.map((t) => t.id);

    // Fetch assignees for all tasks in project
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

    // Fetch active blocker details for blocked tasks
    let activeBlockerByTask: Record<string, any> = {};
    if (taskIds.length > 0) {
      const blockersRes = await db.query(
        `SELECT b.id, b.task_id, b.reason, b.created_at, b.waiting_on_user_id, b.waiting_on_team_text,
                u.name as waiting_on_name
         FROM task_blockers b
         LEFT JOIN users u ON u.id = b.waiting_on_user_id
         WHERE b.task_id = ANY($1) AND b.is_resolved = FALSE`,
        [taskIds]
      );
      for (const b of blockersRes.rows) {
        activeBlockerByTask[b.task_id] = b;
      }
    }

    // Counts for comments and decisions
    let commentCounts: Record<string, number> = {};
    let decisionCounts: Record<string, number> = {};
    if (taskIds.length > 0) {
      const commentsRes = await db.query(
        'SELECT task_id, COUNT(*) as count FROM comments WHERE task_id = ANY($1) GROUP BY task_id',
        [taskIds]
      );
      for (const c of commentsRes.rows) {
        commentCounts[c.task_id] = parseInt(c.count, 10);
      }

      const decisionsRes = await db.query(
        'SELECT task_id, COUNT(*) as count FROM task_decisions WHERE task_id = ANY($1) GROUP BY task_id',
        [taskIds]
      );
      for (const d of decisionsRes.rows) {
        decisionCounts[d.task_id] = parseInt(d.count, 10);
      }

      // Query dependencies for all tasks in project
      var dependenciesByTask: Record<string, any[]> = {};
      var blockingCountByTask: Record<string, number> = {};
      const depsRes = await db.query(
        `SELECT td.id, td.task_id, td.depends_on_task_id,
                dt.title as depends_on_title, dt.priority as depends_on_priority,
                dt.completed_at as depends_on_completed_at,
                c.name as depends_on_column_name,
                CASE WHEN dt.completed_at IS NOT NULL OR UPPER(c.name) = 'DONE' THEN TRUE ELSE FALSE END as is_completed
         FROM task_dependencies td
         JOIN tasks dt ON dt.id = td.depends_on_task_id
         JOIN board_columns c ON c.id = dt.column_id
         WHERE td.task_id = ANY($1)
         ORDER BY td.created_at ASC`,
        [taskIds]
      );
      for (const d of depsRes.rows) {
        if (!dependenciesByTask[d.task_id]) dependenciesByTask[d.task_id] = [];
        dependenciesByTask[d.task_id].push(d);
      }

      const blockingRes = await db.query(
        `SELECT td.depends_on_task_id, COUNT(*) as count
         FROM task_dependencies td
         WHERE td.depends_on_task_id = ANY($1)
         GROUP BY td.depends_on_task_id`,
        [taskIds]
      );
      for (const b of blockingRes.rows) {
        blockingCountByTask[b.depends_on_task_id] = parseInt(b.count, 10);
      }
    }

    const tasks = tasksRes.rows.map((t) => ({
      ...t,
      assignees: assigneesByTask[t.id] || [],
      activeBlocker: activeBlockerByTask[t.id] || null,
      dependencies: (dependenciesByTask && dependenciesByTask[t.id]) || [],
      blockingCount: (blockingCountByTask && blockingCountByTask[t.id]) || 0,
      commentCount: commentCounts[t.id] || 0,
      decisionCount: decisionCounts[t.id] || 0,
    }));

    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/tasks
taskRouter.post('/projects/:projectId/tasks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const { title, description, columnId, priority, dueDate, estimatedHours, assigneeIds, dependsOnTaskIds } = parsed.data;

    // Check project column belongs to project
    const colCheck = await db.query(
      'SELECT id FROM board_columns WHERE id = $1 AND project_id = $2',
      [columnId, projectId]
    );
    if (colCheck.rows.length === 0) {
      res.status(400).json({ error: 'Invalid column for this project' });
      return;
    }

    // Next position in column
    const posRes = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM tasks WHERE column_id = $1',
      [columnId]
    );
    const position = posRes.rows[0]?.next_pos ?? 0;

    const taskId = `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const parsedDueDate = dueDate ? new Date(dueDate).toISOString() : null;
    const estVal = estimatedHours !== undefined && estimatedHours !== null ? estimatedHours : null;

    await db.query(
      `INSERT INTO tasks (id, project_id, column_id, title, description, priority, due_date, estimated_hours, time_spent_hours, creator_id, position, is_blocked, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, FALSE, NOW(), NOW())`,
      [taskId, projectId, columnId, title.trim(), description.trim(), priority, parsedDueDate, estVal, req.user!.id, position]
    );

    // Assignees
    const assignedUsers: any[] = [];
    if (assigneeIds && assigneeIds.length > 0) {
      for (const uId of assigneeIds) {
        await db.query(
          `INSERT INTO task_assignees (id, task_id, user_id, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [`ta_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, taskId, uId]
        );

        // Fetch user info
        const uRes = await db.query('SELECT id as user_id, name, email, title, avatar_url FROM users WHERE id = $1', [uId]);
        if (uRes.rows[0]) assignedUsers.push(uRes.rows[0]);

        // Send notification to assignee (if not self)
        if (uId !== req.user!.id) {
          const notifId = `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
          await db.query(
            `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, project_id, is_read, created_at)
             VALUES ($1, $2, 'TASK_ASSIGNED', $3, $4, 'TASK', $5, $6, FALSE, NOW())`,
            [
              notifId,
              uId,
              `Assigned to: ${title.trim()}`,
              `${req.user!.name} assigned you to this task`,
              taskId,
              projectId,
            ]
          );

          broadcastToUser(uId, 'notification:created', {
            id: notifId,
            type: 'TASK_ASSIGNED',
            title: `Assigned to: ${title.trim()}`,
            body: `${req.user!.name} assigned you to this task`,
            entity_id: taskId,
            project_id: projectId,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // Insert dependencies if provided
    if (dependsOnTaskIds && dependsOnTaskIds.length > 0) {
      for (const depId of dependsOnTaskIds) {
        if (depId !== taskId) {
          await db.query(
            `INSERT INTO task_dependencies (id, task_id, depends_on_task_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (task_id, depends_on_task_id) DO NOTHING`,
            [`dep_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, taskId, depId]
          );
        }
      }
    }

    // Record activity
    await db.query(
      `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, 'task_created', $5, NOW())`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        taskId,
        projectId,
        req.user!.id,
        JSON.stringify({ title: title.trim() }),
      ]
    );

    const createdTask = {
      id: taskId,
      project_id: projectId,
      column_id: columnId,
      title: title.trim(),
      description: description.trim(),
      priority,
      due_date: parsedDueDate,
      creator_id: req.user!.id,
      creator_name: req.user!.name,
      position,
      is_blocked: false,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignees: assignedUsers,
      activeBlocker: null,
      commentCount: 0,
      decisionCount: 0,
    };

    // Broadcast in real-time to all teammates in project room!
    broadcastToProject(projectId, 'task:created', { task: createdTask });

    res.status(201).json({ task: createdTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id - Full details including comments, decisions, blockers, activity
taskRouter.get('/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const taskRes = await db.query(
      `SELECT t.*, u.name as creator_name, p.name as project_name, c.name as column_name
       FROM tasks t
       JOIN users u ON u.id = t.creator_id
       JOIN projects p ON p.id = t.project_id
       JOIN board_columns c ON c.id = t.column_id
       WHERE t.id = $1`,
      [id]
    );

    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = taskRes.rows[0];

    // Assignees
    const assigneesRes = await db.query(
      `SELECT u.id as user_id, u.name, u.email, u.title, u.avatar_url
       FROM task_assignees ta
       JOIN users u ON u.id = ta.user_id
       WHERE ta.task_id = $1`,
      [id]
    );

    // Active blocker
    const activeBlockerRes = await db.query(
      `SELECT b.*, u.name as waiting_on_name, c.name as creator_name
       FROM task_blockers b
       LEFT JOIN users u ON u.id = b.waiting_on_user_id
       LEFT JOIN users c ON c.id = b.created_by_id
       WHERE b.task_id = $1 AND b.is_resolved = FALSE
       ORDER BY b.created_at DESC LIMIT 1`,
      [id]
    );

    // Blocker history
    const allBlockersRes = await db.query(
      `SELECT b.*, u.name as waiting_on_name, c.name as creator_name, r.name as resolved_by_name
       FROM task_blockers b
       LEFT JOIN users u ON u.id = b.waiting_on_user_id
       LEFT JOIN users c ON c.id = b.created_by_id
       LEFT JOIN users r ON r.id = b.resolved_by_id
       WHERE b.task_id = $1
       ORDER BY b.created_at DESC`,
      [id]
    );

    // Decisions
    const decisionsRes = await db.query(
      `SELECT d.*, u.name as author_name
       FROM task_decisions d
       JOIN users u ON u.id = d.author_id
       WHERE d.task_id = $1
       ORDER BY d.created_at DESC`,
      [id]
    );

    // Comments
    const commentsRes = await db.query(
      `SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [id]
    );

    // Activity timeline
    const activityRes = await db.query(
      `SELECT a.*, u.name as user_name
       FROM task_activity a
       JOIN users u ON u.id = a.user_id
       WHERE a.task_id = $1
       ORDER BY a.created_at DESC LIMIT 50`,
      [id]
    );

    // Dependencies (Prerequisites this task depends on)
    const dependenciesRes = await db.query(
      `SELECT td.id, td.task_id, td.depends_on_task_id, td.created_at,
              dt.title as depends_on_title, dt.priority as depends_on_priority,
              dt.description as depends_on_description,
              dt.completed_at as depends_on_completed_at,
              c.name as depends_on_column_name,
              CASE WHEN dt.completed_at IS NOT NULL OR UPPER(c.name) = 'DONE' THEN TRUE ELSE FALSE END as is_completed
       FROM task_dependencies td
       JOIN tasks dt ON dt.id = td.depends_on_task_id
       JOIN board_columns c ON c.id = dt.column_id
       WHERE td.task_id = $1
       ORDER BY td.created_at ASC`,
      [id]
    );

    // Downstream tasks blocked by this task
    const blockingRes = await db.query(
      `SELECT td.id, td.task_id, td.depends_on_task_id, td.created_at,
              t.title as blocked_task_title, t.priority as blocked_task_priority,
              t.completed_at as blocked_task_completed_at,
              c.name as blocked_task_column_name,
              CASE WHEN t.completed_at IS NOT NULL OR UPPER(c.name) = 'DONE' THEN TRUE ELSE FALSE END as is_completed
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       JOIN board_columns c ON c.id = t.column_id
        WHERE td.depends_on_task_id = $1
        ORDER BY td.created_at ASC`,
      [id]
    );

    // Time Logs (Effort tracking)
    const timeLogsRes = await db.query(
      `SELECT l.id, l.task_id, l.user_id, l.hours, l.description, l.logged_at, l.created_at,
              u.name as user_name, u.avatar_url, u.title as user_title
       FROM task_time_logs l
       JOIN users u ON u.id = l.user_id
       WHERE l.task_id = $1
       ORDER BY l.logged_at DESC, l.created_at DESC`,
      [id]
    );

    res.json({
      task: {
        ...task,
        assignees: assigneesRes.rows,
        activeBlocker: activeBlockerRes.rows[0] || null,
        dependencies: dependenciesRes.rows,
        blocking: blockingRes.rows,
        blockers: allBlockersRes.rows,
        decisions: decisionsRes.rows,
        comments: commentsRes.rows,
        activity: activityRes.rows,
        timeLogs: timeLogsRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id
taskRouter.patch('/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, columnId, estimatedHours } = req.body;

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const currentTask = taskRes.rows[0];

    const newTitle = title !== undefined ? stripEmojis(title) : currentTask.title;
    const newDescription = description !== undefined ? stripEmojis(description) : currentTask.description;
    let newPriority = currentTask.priority;
    if (priority !== undefined) {
      const pUpper = String(priority).toUpperCase().trim();
      if (pUpper === 'LOW' || pUpper === 'MEDIUM' || pUpper === 'HIGH') {
        newPriority = pUpper;
      } else if (pUpper === 'URGENT') {
        newPriority = 'HIGH';
      } else if (pUpper === 'NONE') {
        newPriority = 'LOW';
      }
    }
    const newDueDate = dueDate !== undefined ? (dueDate ? new Date(dueDate).toISOString() : null) : currentTask.due_date;
    const newColumnId = columnId !== undefined ? columnId : currentTask.column_id;
    let newEstimatedHours = currentTask.estimated_hours;
    if (estimatedHours !== undefined) {
      if (estimatedHours === null || estimatedHours === '') {
        newEstimatedHours = null;
      } else {
        const parsed = parseFloat(estimatedHours);
        newEstimatedHours = isNaN(parsed) ? null : parsed;
      }
    }

    // Check if moving to DONE column
    let completedAt = currentTask.completed_at;
    if (columnId && columnId !== currentTask.column_id) {
      const colRes = await db.query('SELECT name FROM board_columns WHERE id = $1', [columnId]);
      if (colRes.rows[0]?.name?.toUpperCase() === 'DONE') {
        completedAt = new Date().toISOString();
      } else {
        completedAt = null;
      }
    }

    await db.query(
      `UPDATE tasks
       SET title = $1, description = $2, priority = $3, due_date = $4, column_id = $5,
           estimated_hours = $6, completed_at = $7, updated_at = NOW()
       WHERE id = $8`,
      [newTitle, newDescription, newPriority, newDueDate, newColumnId, newEstimatedHours, completedAt, id]
    );

    // Record activity if status changed
    if (columnId && columnId !== currentTask.column_id) {
      const oldColRes = await db.query('SELECT name FROM board_columns WHERE id = $1', [currentTask.column_id]);
      const newColRes = await db.query('SELECT name FROM board_columns WHERE id = $1', [columnId]);
      await db.query(
        `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
         VALUES ($1, $2, $3, $4, 'status_changed', $5, NOW())`,
        [
          `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          id,
          currentTask.project_id,
          req.user!.id,
          JSON.stringify({ from: oldColRes.rows[0]?.name, to: newColRes.rows[0]?.name }),
        ]
      );
    }

    const updatedRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const updatedTask = updatedRes.rows[0];

    broadcastToProject(currentTask.project_id, 'task:updated', { task: updatedTask, taskId: id });

    res.json({ task: updatedTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/tasks/reorder - Reorder tasks within column or across columns
taskRouter.post('/projects/:projectId/tasks/reorder', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const { targetColumnId, orderedTaskIds } = req.body;

    if (!targetColumnId || !Array.isArray(orderedTaskIds)) {
      res.status(400).json({ error: 'targetColumnId and orderedTaskIds are required' });
      return;
    }

    const colRes = await db.query('SELECT id, name FROM board_columns WHERE id = $1 AND project_id = $2', [
      targetColumnId,
      projectId,
    ]);
    if (colRes.rows.length === 0) {
      res.status(400).json({ error: 'Invalid column for this project' });
      return;
    }

    const isDone = colRes.rows[0].name.toUpperCase() === 'DONE';

    for (let i = 0; i < orderedTaskIds.length; i++) {
      const taskId = orderedTaskIds[i];
      const completedAt = isDone ? new Date().toISOString() : null;
      await db.query(
        `UPDATE tasks
         SET column_id = $1, position = $2, completed_at = $3, updated_at = NOW()
         WHERE id = $4 AND project_id = $5`,
        [targetColumnId, i, completedAt, taskId, projectId]
      );
    }

    broadcastToProject(projectId, 'task:moved', {
      projectId,
      columnId: targetColumnId,
      orderedTaskIds,
    });

    res.json({ success: true, columnId: targetColumnId, orderedTaskIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/move - Drag & drop or keyboard position movement
taskRouter.post('/tasks/:id/move', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { targetColumnId, newPosition } = req.body;

    if (!targetColumnId) {
      res.status(400).json({ error: 'targetColumnId is required' });
      return;
    }

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = taskRes.rows[0];

    // Verify target column belongs to the same project
    const colRes = await db.query('SELECT id, name FROM board_columns WHERE id = $1 AND project_id = $2', [
      targetColumnId,
      task.project_id,
    ]);
    if (colRes.rows.length === 0) {
      res.status(400).json({ error: 'Invalid destination column for this project' });
      return;
    }

    const destCol = colRes.rows[0];
    const isDone = destCol.name.toUpperCase() === 'DONE';
    const completedAt = isDone ? new Date().toISOString() : null;

    // Shift other tasks in target column if necessary
    const position = typeof newPosition === 'number' ? Math.max(0, newPosition) : 0;

    if (task.column_id === targetColumnId) {
      // Reordering within same column: re-sequence to avoid duplicate position indexes
      const colTasksRes = await db.query(
        'SELECT id FROM tasks WHERE column_id = $1 ORDER BY position ASC, created_at ASC',
        [targetColumnId]
      );
      const ids = colTasksRes.rows.map((r) => r.id).filter((tid) => tid !== id);
      ids.splice(Math.min(position, ids.length), 0, id);
      for (let i = 0; i < ids.length; i++) {
        await db.query('UPDATE tasks SET position = $1, updated_at = NOW() WHERE id = $2', [i, ids[i]]);
      }
    } else {
      // Moving across columns
      await db.query(
        `UPDATE tasks
         SET position = position + 1
         WHERE column_id = $1 AND position >= $2 AND id != $3`,
        [targetColumnId, position, id]
      );

      await db.query(
        `UPDATE tasks
         SET column_id = $1, position = $2, completed_at = $3, updated_at = NOW()
         WHERE id = $4`,
        [targetColumnId, position, completedAt, id]
      );

      // Record activity if column changed
      const oldColRes = await db.query('SELECT name FROM board_columns WHERE id = $1', [task.column_id]);
      await db.query(
        `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
         VALUES ($1, $2, $3, $4, 'status_changed', $5, NOW())`,
        [
          `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          id,
          task.project_id,
          req.user!.id,
          JSON.stringify({ from: oldColRes.rows[0]?.name, to: destCol.name }),
        ]
      );
    }

    // Broadcast move in real-time
    broadcastToProject(task.project_id, 'task:moved', {
      taskId: id,
      projectId: task.project_id,
      fromColumnId: task.column_id,
      toColumnId: targetColumnId,
      newPosition: position,
      completedAt,
    });

    res.json({ success: true, taskId: id, columnId: targetColumnId, position });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/assignees
taskRouter.post('/tasks/:id/assignees', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body; // array of user IDs

    if (!Array.isArray(userIds)) {
      res.status(400).json({ error: 'userIds array is required' });
      return;
    }

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    // Clear and set new assignees
    await db.query('DELETE FROM task_assignees WHERE task_id = $1', [id]);

    for (const uId of userIds) {
      await db.query(
        `INSERT INTO task_assignees (id, task_id, user_id, assigned_at)
         VALUES ($1, $2, $3, NOW())`,
        [`ta_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, id, uId]
      );

      // Notification if not self
      if (uId !== req.user!.id) {
        const notifId = `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        await db.query(
          `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, project_id, is_read, created_at)
           VALUES ($1, $2, 'TASK_ASSIGNED', $3, $4, 'TASK', $5, $6, FALSE, NOW())`,
          [notifId, uId, `Assigned: ${task.title}`, `${req.user!.name} assigned you to this task`, id, task.project_id]
        );
        broadcastToUser(uId, 'notification:created', {
          id: notifId,
          type: 'TASK_ASSIGNED',
          title: `Assigned: ${task.title}`,
          body: `${req.user!.name} assigned you to this task`,
          entity_id: id,
          project_id: task.project_id,
          created_at: new Date().toISOString(),
        });
      }
    }

    const assigneesRes = await db.query(
      `SELECT u.id as user_id, u.name, u.email, u.title, u.avatar_url
       FROM task_assignees ta
       JOIN users u ON u.id = ta.user_id
       WHERE ta.task_id = $1`,
      [id]
    );

    broadcastToProject(task.project_id, 'task:assignees_updated', {
      taskId: id,
      assignees: assigneesRes.rows,
    });

    res.json({ assignees: assigneesRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
taskRouter.delete('/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    await db.query('DELETE FROM tasks WHERE id = $1', [id]);

    broadcastToProject(task.project_id, 'task:deleted', { taskId: id, projectId: task.project_id });
    res.json({ success: true, taskId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/dependencies - Add task dependency
taskRouter.post('/tasks/:id/dependencies', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { dependsOnTaskId } = req.body;

    if (!dependsOnTaskId || typeof dependsOnTaskId !== 'string') {
      res.status(400).json({ error: 'dependsOnTaskId is required' });
      return;
    }

    if (id === dependsOnTaskId) {
      res.status(400).json({ error: 'A task cannot depend on itself' });
      return;
    }

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const depTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [dependsOnTaskId]);

    if (taskRes.rows.length === 0 || depTaskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task or prerequisite task not found' });
      return;
    }

    const task = taskRes.rows[0];
    const depTask = depTaskRes.rows[0];

    // Check for circular dependency
    const cycleRes = await db.query(
      `WITH RECURSIVE dep_chain AS (
         SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1
         UNION
         SELECT td.depends_on_task_id FROM task_dependencies td
         INNER JOIN dep_chain dc ON dc.depends_on_task_id = td.task_id
       )
       SELECT 1 FROM dep_chain WHERE depends_on_task_id = $2`,
      [dependsOnTaskId, id]
    );

    if (cycleRes.rows.length > 0) {
      res.status(400).json({ error: 'Circular dependency detected: that task already depends on this one' });
      return;
    }

    const depId = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.query(
      `INSERT INTO task_dependencies (id, task_id, depends_on_task_id, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (task_id, depends_on_task_id) DO NOTHING`,
      [depId, id, dependsOnTaskId]
    );

    // Record activity
    await db.query(
      `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, 'dependency_added', $5, NOW())`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        id,
        task.project_id,
        req.user!.id,
        JSON.stringify({ dependsOnTaskId, dependsOnTitle: depTask.title }),
      ]
    );

    broadcastToProject(task.project_id, 'task:updated', { taskId: id });
    broadcastToProject(task.project_id, 'task:updated', { taskId: dependsOnTaskId });

    res.json({ success: true, dependency: { id: depId, task_id: id, depends_on_task_id: dependsOnTaskId } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id/dependencies/:dependsOnTaskId - Remove task dependency
taskRouter.delete('/tasks/:id/dependencies/:dependsOnTaskId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, dependsOnTaskId } = req.params;

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    await db.query(
      'DELETE FROM task_dependencies WHERE task_id = $1 AND depends_on_task_id = $2',
      [id, dependsOnTaskId]
    );

    // Record activity
    await db.query(
      `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, 'dependency_removed', $5, NOW())`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        id,
        task.project_id,
        req.user!.id,
        JSON.stringify({ dependsOnTaskId }),
      ]
    );

    broadcastToProject(task.project_id, 'task:updated', { taskId: id });
    broadcastToProject(task.project_id, 'task:updated', { taskId: dependsOnTaskId });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/time-logs - Manual entry logger for time spent
taskRouter.post('/tasks/:id/time-logs', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { hours, description, loggedAt } = req.body;

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      res.status(400).json({ error: 'Hours must be a positive number greater than 0' });
      return;
    }

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanDesc = description ? stripEmojis(description).trim() : '';
    const logDate = loggedAt ? new Date(loggedAt).toISOString() : new Date().toISOString();

    await db.query(
      `INSERT INTO task_time_logs (id, task_id, user_id, hours, description, logged_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [logId, id, req.user!.id, parsedHours, cleanDesc, logDate]
    );

    // Recompute total time_spent_hours on task
    await db.query(
      `UPDATE tasks
       SET time_spent_hours = COALESCE((SELECT SUM(hours) FROM task_time_logs WHERE task_id = $1), 0),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Record activity
    await db.query(
      `INSERT INTO task_activity (id, task_id, project_id, user_id, action_type, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, 'time_logged', $5, NOW())`,
      [
        `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        id,
        task.project_id,
        req.user!.id,
        JSON.stringify({ hours: parsedHours, description: cleanDesc }),
      ]
    );

    // Fetch user info for the new log
    const userRes = await db.query('SELECT name, avatar_url, title FROM users WHERE id = $1', [req.user!.id]);
    const user = userRes.rows[0];

    const timeLog = {
      id: logId,
      task_id: id,
      user_id: req.user!.id,
      user_name: user?.name || req.user!.name,
      user_title: user?.title || '',
      avatar_url: user?.avatar_url,
      hours: parsedHours,
      description: cleanDesc,
      logged_at: logDate,
      created_at: new Date().toISOString(),
    };

    // Get updated task row
    const updatedTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const updatedTask = updatedTaskRes.rows[0];

    broadcastToProject(task.project_id, 'task:updated', { task: updatedTask, taskId: id });

    res.json({ success: true, timeLog, task: updatedTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id/time-logs/:logId - Delete a time log entry
taskRouter.delete('/tasks/:id/time-logs/:logId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, logId } = req.params;

    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const task = taskRes.rows[0];

    await db.query('DELETE FROM task_time_logs WHERE id = $1 AND task_id = $2', [logId, id]);

    // Recompute total time_spent_hours on task
    await db.query(
      `UPDATE tasks
       SET time_spent_hours = COALESCE((SELECT SUM(hours) FROM task_time_logs WHERE task_id = $1), 0),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    const updatedTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const updatedTask = updatedTaskRes.rows[0];

    broadcastToProject(task.project_id, 'task:updated', { task: updatedTask, taskId: id });

    res.json({ success: true, task: updatedTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

