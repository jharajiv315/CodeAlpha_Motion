import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { isUserOnline } from '../realtime/socket.ts';

export const workspaceRouter = Router();

// GET /api/workspaces
workspaceRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await db.query(
      `SELECT w.id, w.name, w.slug, w.owner_id, wm.role, w.created_at,
              (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count,
              (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id AND status = 'ACTIVE') as project_count
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.created_at ASC`,
      [req.user!.id]
    );

    res.json({ workspaces: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces
workspaceRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Workspace name must be at least 2 characters' });
      return;
    }

    const wsId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'team';
    const slug = `${slugBase}-${Math.random().toString(36).substring(2, 6)}`;

    await db.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [wsId, name.trim(), slug, req.user!.id]
    );

    await db.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'OWNER', NOW())`,
      [`wm_${Date.now()}`, wsId, req.user!.id]
    );

    // Create default project
    const projId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO projects (id, workspace_id, name, description, status, creator_id, created_at, updated_at)
       VALUES ($1, $2, 'Main Project', 'Central board for team tasks', 'ACTIVE', $3, NOW(), NOW())`,
      [projId, wsId, req.user!.id]
    );

    await db.query(
      `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'ADMIN', NOW())`,
      [`pm_${Date.now()}`, projId, req.user!.id]
    );

    const cols = ['TO DO', 'IN PROGRESS', 'IN REVIEW', 'DONE'];
    for (let i = 0; i < cols.length; i++) {
      await db.query(
        `INSERT INTO board_columns (id, project_id, name, position, is_default, created_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())`,
        [`col_${projId}_${i}`, projId, cols[i], i]
      );
    }

    res.status(201).json({
      workspace: { id: wsId, name: name.trim(), slug, owner_id: req.user!.id, role: 'OWNER' },
      defaultProjectId: projId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:id/members
workspaceRouter.get('/:id/members', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.params.id;

    // Verify membership
    const check = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [wsId, req.user!.id]
    );
    if (check.rows.length === 0) {
      res.status(403).json({ error: 'You are not a member of this workspace' });
      return;
    }

    const membersRes = await db.query(
      `SELECT wm.id, wm.role, wm.joined_at, u.id as user_id, u.name, u.email, u.title, u.avatar_url
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY wm.role DESC, wm.joined_at ASC`,
      [wsId]
    );

    res.json({ members: membersRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:id/invites - generate cryptographic invitation link
workspaceRouter.post('/:id/invites', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.params.id;
    const { role = 'MEMBER' } = req.body;

    const check = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [wsId, req.user!.id]
    );

    if (check.rows.length === 0 || check.rows[0].role === 'MEMBER') {
      res.status(403).json({ error: 'Only workspace Owners and Admins can create invite links' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Expiry: 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO workspace_invites (id, workspace_id, inviter_id, token, role, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [inviteId, wsId, req.user!.id, token, role, expiresAt.toISOString()]
    );

    res.status(201).json({
      invite: {
        id: inviteId,
        token,
        workspaceId: wsId,
        role,
        expiresAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/invites/:token - inspect invite details
workspaceRouter.get('/invites/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await db.query(
      `SELECT wi.id, wi.workspace_id, wi.role, wi.expires_at, wi.used_at,
              w.name as workspace_name, u.name as inviter_name
       FROM workspace_invites wi
       JOIN workspaces w ON w.id = wi.workspace_id
       JOIN users u ON u.id = wi.inviter_id
       WHERE wi.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invalid or non-existent invite link' });
      return;
    }

    const invite = result.rows[0];
    const isExpired = new Date(invite.expires_at).getTime() < Date.now();

    res.json({
      invite: {
        id: invite.id,
        workspaceId: invite.workspace_id,
        workspaceName: invite.workspace_name,
        inviterName: invite.inviter_name,
        role: invite.role,
        isExpired,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/invites/:token/accept - accept invite
workspaceRouter.post('/invites/:token/accept', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const result = await db.query(
      `SELECT wi.id, wi.workspace_id, wi.role, wi.expires_at
       FROM workspace_invites wi
       WHERE wi.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invalid or non-existent invite link' });
      return;
    }

    const invite = result.rows[0];
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'This invitation link has expired. Ask an admin for a new link.' });
      return;
    }

    // Check if already a member
    const existing = await db.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [invite.workspace_id, req.user!.id]
    );

    if (existing.rows.length > 0) {
      res.json({ message: 'You are already a member of this workspace', workspaceId: invite.workspace_id });
      return;
    }

    // Add to workspace
    await db.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [`wm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, invite.workspace_id, req.user!.id, invite.role]
    );

    // Also add to active projects in the workspace so they can view boards immediately
    const projects = await db.query(
      'SELECT id FROM projects WHERE workspace_id = $1 AND status = $2',
      [invite.workspace_id, 'ACTIVE']
    );

    for (const p of projects.rows) {
      await db.query(
        `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, 'MEMBER', NOW())
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [`pm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, p.id, req.user!.id]
      );
    }

    res.json({ success: true, workspaceId: invite.workspace_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:id/team-pulse - Shows who is currently active and their current focus area based on their assigned tasks
workspaceRouter.get('/:id/team-pulse', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.params.id;

    // Verify membership
    const check = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [wsId, req.user!.id]
    );
    if (check.rows.length === 0) {
      res.status(403).json({ error: 'You are not a member of this workspace' });
      return;
    }

    // Get all workspace members
    const membersRes = await db.query(
      `SELECT u.id, u.name, u.email, u.title, u.avatar_url, wm.role, wm.joined_at
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY wm.joined_at ASC`,
      [wsId]
    );

    const members = membersRes.rows;
    const teamPulse = [];

    for (const member of members) {
      const isOnline = member.id === req.user!.id || isUserOnline(member.id);

      // Query active assigned tasks in this workspace
      const assignedTasksRes = await db.query(
        `SELECT t.id, t.title, t.priority, t.due_date, t.is_blocked, t.created_at, t.updated_at,
                p.id as project_id, p.name as project_name,
                c.id as column_id, c.name as column_name,
                tb.reason as blocker_reason, tb.waiting_on_user_id,
                wu.name as waiting_on_name
         FROM tasks t
         JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
         JOIN projects p ON p.id = t.project_id
         JOIN board_columns c ON c.id = t.column_id
         LEFT JOIN task_blockers tb ON tb.task_id = t.id AND tb.is_resolved = FALSE
         LEFT JOIN users wu ON wu.id = tb.waiting_on_user_id
         WHERE p.workspace_id = $2
           AND t.completed_at IS NULL
           AND UPPER(c.name) != 'DONE'
         ORDER BY
           -- Priority 1: In Progress tasks first
           CASE WHEN UPPER(c.name) = 'IN PROGRESS' THEN 1
                WHEN UPPER(c.name) = 'IN REVIEW' THEN 2
                WHEN UPPER(c.name) = 'TO DO' THEN 3
                ELSE 4 END ASC,
           -- Priority 2: Higher priority tasks first
           CASE WHEN UPPER(t.priority) = 'URGENT' THEN 1
                WHEN UPPER(t.priority) = 'HIGH' THEN 2
                WHEN UPPER(t.priority) = 'MEDIUM' THEN 3
                ELSE 4 END ASC,
           t.updated_at DESC`,
        [member.id, wsId]
      );

      const assignedTasks = assignedTasksRes.rows;
      const primaryTask = assignedTasks[0] || null;

      // Determine focus summary
      let focusSummary = 'Available / Open for tasks';
      let focusStatus: 'working' | 'reviewing' | 'blocked' | 'available' | 'completed' = 'available';

      if (primaryTask) {
        if (primaryTask.is_blocked) {
          focusStatus = 'blocked';
          focusSummary = `Blocked: ${primaryTask.blocker_reason || 'Waiting on dependency'}`;
        } else if (primaryTask.column_name.toUpperCase() === 'IN PROGRESS') {
          focusStatus = 'working';
          focusSummary = `Working on: ${primaryTask.title}`;
        } else if (primaryTask.column_name.toUpperCase() === 'IN REVIEW') {
          focusStatus = 'reviewing';
          focusSummary = `Reviewing: ${primaryTask.title}`;
        } else {
          focusStatus = 'working';
          focusSummary = `Focused on: ${primaryTask.title}`;
        }
      } else {
        // Check if completed a task recently
        const lastCompletedRes = await db.query(
          `SELECT t.title, p.name as project_name, t.completed_at
           FROM tasks t
           JOIN task_assignees ta ON ta.task_id = t.id AND ta.user_id = $1
           JOIN projects p ON p.id = t.project_id
           WHERE p.workspace_id = $2 AND t.completed_at IS NOT NULL
           ORDER BY t.completed_at DESC LIMIT 1`,
          [member.id, wsId]
        );
        if (lastCompletedRes.rows.length > 0) {
          focusStatus = 'completed';
          focusSummary = `Completed: ${lastCompletedRes.rows[0].title}`;
        }
      }

      teamPulse.push({
        user_id: member.id,
        name: member.name,
        email: member.email,
        title: member.title || 'Team Member',
        avatar_url: member.avatar_url,
        role: member.role,
        is_online: isOnline,
        is_current_user: member.id === req.user!.id,
        focus_status: focusStatus,
        focus_summary: focusSummary,
        primary_task: primaryTask ? {
          id: primaryTask.id,
          title: primaryTask.title,
          project_id: primaryTask.project_id,
          project_name: primaryTask.project_name,
          column_name: primaryTask.column_name,
          priority: primaryTask.priority,
          due_date: primaryTask.due_date,
          is_blocked: primaryTask.is_blocked,
          blocker_reason: primaryTask.blocker_reason,
          waiting_on_name: primaryTask.waiting_on_name,
        } : null,
        active_task_count: assignedTasks.length,
        in_progress_count: assignedTasks.filter((t: any) => t.column_name.toUpperCase() === 'IN PROGRESS').length,
        blocked_count: assignedTasks.filter((t: any) => t.is_blocked).length,
        other_tasks: assignedTasks.slice(1, 4).map((t: any) => ({
          id: t.id,
          title: t.title,
          column_name: t.column_name,
          priority: t.priority,
          project_name: t.project_name,
        })),
      });
    }

    res.json({
      success: true,
      workspaceId: wsId,
      activeCount: teamPulse.filter((m) => m.is_online).length,
      totalCount: teamPulse.length,
      teamPulse,
    });
  } catch (err: any) {
    console.error('Failed to get team pulse:', err);
    res.status(500).json({ error: err.message });
  }
});

