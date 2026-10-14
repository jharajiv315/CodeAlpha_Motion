import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'motion-dev-jwt-secret-key-32chars-min!!';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  workspaceRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  projectRole?: 'ADMIN' | 'MEMBER';
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.motion_token) {
    token = req.cookies.motion_token;
  }

  if (!token) {
    next();
    return;
  }

  const user = verifyToken(token);
  if (user) {
    req.user = user;
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

export async function requireWorkspaceMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }

  const memberRes = await db.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, req.user.id]
  );

  if (memberRes.rows.length === 0) {
    res.status(403).json({ error: 'You do not have access to this workspace' });
    return;
  }

  req.workspaceRole = memberRes.rows[0].role;
  next();
}

export async function requireProjectMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const projectId = req.params.projectId || req.params.id || req.body.projectId || req.query.projectId;
  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return;
  }

  // Check if project exists and user is either project member or workspace member
  const projectRes = await db.query(
    `SELECT p.id, p.workspace_id, wm.role as ws_role, pm.role as proj_role
     FROM projects p
     LEFT JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = $1
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     WHERE p.id = $2`,
    [req.user.id, projectId]
  );

  if (projectRes.rows.length === 0) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const record = projectRes.rows[0];
  if (!record.ws_role && !record.proj_role) {
    res.status(403).json({ error: 'You do not have access to this project' });
    return;
  }

  req.projectRole = (record.proj_role || (record.ws_role === 'OWNER' || record.ws_role === 'ADMIN' ? 'ADMIN' : 'MEMBER')) as any;
  next();
}
