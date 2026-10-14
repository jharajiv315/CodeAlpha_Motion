import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { generateToken, requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const authRouter = Router();

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  workspaceName: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// GET /api/auth/demo-users - for easy multi-user switching during review
authRouter.get('/demo-users', async (_req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, title, avatar_url FROM users ORDER BY created_at ASC LIMIT 10'
    );
    res.json({ users: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const { name, email, password, workspaceName } = parsed.data;

    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await db.query(
      `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [userId, email.toLowerCase().trim(), passwordHash, name.trim()]
    );

    // Create an initial workspace for the user
    const wsName = workspaceName?.trim() || `${name.trim()}'s Team`;
    const wsId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `team-${Date.now()}`;

    await db.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [wsId, wsName, `${slug}-${Math.random().toString(36).substring(2, 5)}`, userId]
    );

    await db.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'OWNER', NOW())`,
      [`wm_${Date.now()}`, wsId, userId]
    );

    // Create default project
    const projId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO projects (id, workspace_id, name, description, status, creator_id, created_at, updated_at)
       VALUES ($1, $2, 'General Project', 'Welcome to your first collaborative project workspace.', 'ACTIVE', $3, NOW(), NOW())`,
      [projId, wsId, userId]
    );

    await db.query(
      `INSERT INTO project_members (id, project_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'ADMIN', NOW())`,
      [`pm_${Date.now()}`, projId, userId]
    );

    // Create default columns
    const columns = ['TO DO', 'IN PROGRESS', 'IN REVIEW', 'DONE'];
    for (let i = 0; i < columns.length; i++) {
      await db.query(
        `INSERT INTO board_columns (id, project_id, name, position, is_default, created_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())`,
        [`col_${projId}_${i}`, projId, columns[i], i]
      );
    }

    const token = generateToken({ id: userId, email: email.toLowerCase().trim(), name: name.trim() });
    res.cookie('motion_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: { id: userId, email: email.toLowerCase().trim(), name: name.trim() },
      token,
      defaultWorkspaceId: wsId,
      defaultProjectId: projId,
    });
  } catch (err: any) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const { email, password } = parsed.data;
    const userRes = await db.query(
      'SELECT id, email, password_hash, name, title, avatar_url FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = userRes.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name });
    res.cookie('motion_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: user.title,
        avatar_url: user.avatar_url,
      },
      token,
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Failed to sign in. Please try again.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  res.clearCookie('motion_token');
  res.json({ success: true });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRes = await db.query(
      'SELECT id, email, name, title, avatar_url, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: userRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/profile
authRouter.patch('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, title } = req.body;
    await db.query(
      'UPDATE users SET name = COALESCE($1, name), title = COALESCE($2, title), updated_at = NOW() WHERE id = $3',
      [name, title, req.user!.id]
    );

    const userRes = await db.query(
      'SELECT id, email, name, title, avatar_url FROM users WHERE id = $1',
      [req.user!.id]
    );

    res.json({ user: userRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
