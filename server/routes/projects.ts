import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, requireProjectMember, type AuthenticatedRequest } from '../middleware/auth.ts';
import { broadcastToProject } from '../realtime/socket.ts';

export const projectRouter = Router();

// GET /api/projects?workspaceId=...
projectRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId query parameter is required' });
      return;
    }

    // Verify workspace membership
    const wsMember = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user!.id]
    );

    if (wsMember.rows.length === 0) {
      res.status(403).json({ error: 'You do not have access to this workspace' });
      return;
    }

    const projectsRes = await db.query(
      `SELECT p.id, p.workspace_id, p.name, p.description, p.status, p.created_at, p.updated_at,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
              (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND is_blocked = TRUE) as blocked_count,
              (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
       FROM projects p
       WHERE p.workspace_id = $1 AND p.status != 'ARCHIVED'
       ORDER BY p.created_at ASC`,
      [workspaceId]
    );

    res.json({ projects: projectsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
projectRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { workspaceId, name, description } = req.body;
    if (!workspaceId || !name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Project name must be at least 2 characters' });
      return;
    }

    // Verify workspace role
    const wsMember = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user!.id]
    );

    if (wsMember.rows.length === 0) {
      res.status(403).json({ error: 'You are not a member of this workspace' });
      return;
    }

    const projId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO projects (id, workspace_id, name, description, status, creator_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NOW(), NOW())`,
      [projId, workspaceId, name.trim(), (description || '').trim(), req.user!.id]
    );

    // Add creator as ADMIN
    await db.query(
      `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'ADMIN', NOW())`,
      [`pm_${Date.now()}`, projId, req.user!.id]
    );

    // Add other workspace members as project members
    const otherMembers = await db.query(
      'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id != $2',
      [workspaceId, req.user!.id]
    );

    for (const m of otherMembers.rows) {
      await db.query(
        `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, 'MEMBER', NOW())
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [`pm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, projId, m.user_id]
      );
    }

    // Create default Kanban columns
    const columns = ['TO DO', 'IN PROGRESS', 'IN REVIEW', 'DONE'];
    for (let i = 0; i < columns.length; i++) {
      await db.query(
        `INSERT INTO board_columns (id, project_id, name, position, is_default, created_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())`,
        [`col_${projId}_${i}`, projId, columns[i], i]
      );
    }

    res.status(201).json({
      project: {
        id: projId,
        workspace_id: workspaceId,
        name: name.trim(),
        description: (description || '').trim(),
        status: 'ACTIVE',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
projectRouter.get('/:id', requireAuth, requireProjectMember, async (req: AuthenticatedRequest, res) => {
  try {
    const projId = req.params.id;
    const projectRes = await db.query(
      `SELECT p.id, p.workspace_id, p.name, p.description, p.status, p.created_at, p.updated_at,
              w.name as workspace_name
       FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE p.id = $1`,
      [projId]
    );

    if (projectRes.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Fetch members
    const membersRes = await db.query(
      `SELECT pm.id, pm.role, u.id as user_id, u.name, u.email, u.title, u.avatar_url
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.role DESC, u.name ASC`,
      [projId]
    );

    // Fetch columns
    const colsRes = await db.query(
      'SELECT id, name, position, is_default FROM board_columns WHERE project_id = $1 ORDER BY position ASC',
      [projId]
    );

    res.json({
      project: projectRes.rows[0],
      members: membersRes.rows,
      columns: colsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/columns
projectRouter.get('/:id/columns', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const projId = req.params.id;
    const colsRes = await db.query(
      'SELECT id, name, position, is_default FROM board_columns WHERE project_id = $1 ORDER BY position ASC',
      [projId]
    );
    res.json({ columns: colsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/columns
projectRouter.post('/:id/columns', requireAuth, requireProjectMember, async (req: AuthenticatedRequest, res) => {
  try {
    const projId = req.params.id;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Column name is required' });
      return;
    }

    const posRes = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM board_columns WHERE project_id = $1',
      [projId]
    );
    const nextPos = posRes.rows[0]?.next_pos ?? 0;
    const colId = `col_${projId}_${Date.now()}`;

    await db.query(
      `INSERT INTO board_columns (id, project_id, name, position, is_default, created_at)
       VALUES ($1, $2, $3, $4, FALSE, NOW())`,
      [colId, projId, name.trim(), nextPos]
    );

    const newCol = { id: colId, project_id: projId, name: name.trim(), position: nextPos, is_default: false };
    broadcastToProject(projId, 'column:created', { column: newCol });

    res.status(201).json({ column: newCol });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
