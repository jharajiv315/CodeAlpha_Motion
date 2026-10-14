import type {
  User,
  Workspace,
  WorkspaceMember,
  Project,
  BoardColumn,
  Task,
  TaskDetail,
  TaskBlocker,
  TaskDecision,
  TaskComment,
  NotificationItem,
  DigestPreviewData,
  DigestLogItem,
  DigestSettings,
  DigestTriggerResult,
  TeamPulseResponse,
  TaskTimeLog,
} from '../types/index.ts';

const TOKEN_KEY = 'motion_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    try {
      const errorData = await res.json();
      if (errorData.error) errorMessage = errorData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  auth: {
    me: () => apiFetch<{ user: User }>('/api/auth/me'),
    login: (body: { email: string; password: string }) =>
      apiFetch<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    register: (body: { name: string; email: string; password: string; workspaceName?: string }) =>
      apiFetch<{ user: User; token: string; defaultWorkspaceId: string; defaultProjectId: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    logout: () =>
      apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
    updateProfile: (body: { name?: string; title?: string }) =>
      apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    getDemoUsers: () => apiFetch<{ users: User[] }>('/api/auth/demo-users'),
  },

  // Workspaces
  workspaces: {
    list: () => apiFetch<{ workspaces: Workspace[] }>('/api/workspaces'),
    create: (name: string) =>
      apiFetch<{ workspace: Workspace; defaultProjectId: string }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    members: (workspaceId: string) =>
      apiFetch<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members`),
    createInvite: (workspaceId: string, role = 'MEMBER') =>
      apiFetch<{ invite: { id: string; token: string; expiresAt: string } }>(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    inspectInvite: (token: string) =>
      apiFetch<{ invite: { id: string; workspaceId: string; workspaceName: string; inviterName: string; role: string; isExpired: boolean } }>(
        `/api/workspaces/invites/${token}`
      ),
    acceptInvite: (token: string) =>
      apiFetch<{ success: boolean; workspaceId: string }>(`/api/workspaces/invites/${token}/accept`, {
        method: 'POST',
      }),
    getTeamPulse: (workspaceId: string) =>
      apiFetch<TeamPulseResponse>(`/api/workspaces/${workspaceId}/team-pulse`),
  },

  // Projects
  projects: {
    list: (workspaceId: string) =>
      apiFetch<{ projects: Project[] }>(`/api/projects?workspaceId=${workspaceId}`),
    create: (workspaceId: string, name: string, description?: string) =>
      apiFetch<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ workspaceId, name, description }),
      }),
    get: (projectId: string) =>
      apiFetch<{ project: Project; members: WorkspaceMember[]; columns: BoardColumn[] }>(`/api/projects/${projectId}`),
    getColumns: (projectId: string) =>
      apiFetch<{ columns: BoardColumn[] }>(`/api/projects/${projectId}/columns`),
    createColumn: (projectId: string, name: string) =>
      apiFetch<{ column: BoardColumn }>(`/api/projects/${projectId}/columns`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },

  // Tasks
  tasks: {
    listByProject: (projectId: string) =>
      apiFetch<{ tasks: Task[] }>(`/api/projects/${projectId}/tasks`),
    get: (taskId: string) => apiFetch<{ task: TaskDetail }>(`/api/tasks/${taskId}`),
    create: (
      projectId: string,
      body: {
        title: string;
        description?: string;
        columnId: string;
        priority?: string;
        dueDate?: string | null;
        estimatedHours?: number | null;
        assigneeIds?: string[];
        dependsOnTaskIds?: string[];
      }
    ) =>
      apiFetch<{ task: Task }>(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (
      taskId: string,
      body: {
        title?: string;
        description?: string;
        columnId?: string;
        priority?: string;
        dueDate?: string | null;
        estimatedHours?: number | null;
      }
    ) =>
      apiFetch<{ task: Task }>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    move: (taskId: string, targetColumnId: string, newPosition: number) =>
      apiFetch<{ success: boolean; taskId: string; columnId: string; position: number }>(`/api/tasks/${taskId}/move`, {
        method: 'POST',
        body: JSON.stringify({ targetColumnId, newPosition }),
      }),
    reorder: (projectId: string, targetColumnId: string, orderedTaskIds: string[]) =>
      apiFetch<{ success: boolean; columnId: string; orderedTaskIds: string[] }>(
        `/api/projects/${projectId}/tasks/reorder`,
        {
          method: 'POST',
          body: JSON.stringify({ targetColumnId, orderedTaskIds }),
        }
      ),
    updateAssignees: (taskId: string, userIds: string[]) =>
      apiFetch<{ assignees: any[] }>(`/api/tasks/${taskId}/assignees`, {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      }),
    delete: (taskId: string) =>
      apiFetch<{ success: boolean; taskId: string }>(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      }),
    addDependency: (taskId: string, dependsOnTaskId: string) =>
      apiFetch<{ success: boolean; dependency: any }>(`/api/tasks/${taskId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ dependsOnTaskId }),
      }),
    removeDependency: (taskId: string, dependsOnTaskId: string) =>
      apiFetch<{ success: boolean }>(`/api/tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
        method: 'DELETE',
      }),
    logTime: (
      taskId: string,
      body: { hours: number; description?: string; loggedAt?: string }
    ) =>
      apiFetch<{ success: boolean; timeLog: TaskTimeLog; task: Task }>(`/api/tasks/${taskId}/time-logs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    deleteTimeLog: (taskId: string, logId: string) =>
      apiFetch<{ success: boolean; task: Task }>(`/api/tasks/${taskId}/time-logs/${logId}`, {
        method: 'DELETE',
      }),
  },

  // Flagship USP 1: Blocker Radar
  blockers: {
    listByProject: (projectId: string, status: 'active' | 'resolved' | 'all' = 'active') =>
      apiFetch<{ blockers: TaskBlocker[] }>(`/api/projects/${projectId}/blockers?status=${status}`),
    markBlocked: (
      taskId: string,
      body: { reason: string; waitingOnUserId?: string | null; waitingOnTeamText?: string | null }
    ) =>
      apiFetch<{ blocker: TaskBlocker }>(`/api/tasks/${taskId}/block`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    resolve: (taskId: string, resolutionNote: string) =>
      apiFetch<{ success: boolean; taskId: string; blockerId: string }>(`/api/tasks/${taskId}/unblock`, {
        method: 'POST',
        body: JSON.stringify({ resolutionNote }),
      }),
  },

  // Flagship USP 2: Decision Notes
  decisions: {
    listByProject: (projectId: string) =>
      apiFetch<{ decisions: TaskDecision[] }>(`/api/projects/${projectId}/decisions`),
    record: (
      taskId: string,
      body: { title: string; summary: string; rationale?: string; sourceCommentId?: string | null }
    ) =>
      apiFetch<{ decision: TaskDecision }>(`/api/tasks/${taskId}/decisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    delete: (decisionId: string) =>
      apiFetch<{ success: boolean; decisionId: string }>(`/api/decisions/${decisionId}`, {
        method: 'DELETE',
      }),
  },

  // Comments
  comments: {
    add: (taskId: string, body: string) =>
      apiFetch<{ comment: TaskComment }>(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    delete: (commentId: string) =>
      apiFetch<{ success: boolean; commentId: string }>(`/api/comments/${commentId}`, {
        method: 'DELETE',
      }),
  },

  // Notifications
  notifications: {
    list: () =>
      apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),
    markRead: (id: string) =>
      apiFetch<{ success: boolean; id: string }>(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllRead: () =>
      apiFetch<{ success: boolean }>('/api/notifications/read-all', {
        method: 'POST',
      }),
  },

  // My Work
  myWork: {
    get: () =>
      apiFetch<{ assignedTasks: Task[]; blockingMeTasks: Task[] }>('/api/notifications/my-work'),
  },

  // Daily Digest
  digests: {
    preview: (workspaceId?: string, userId?: string) => {
      const params = new URLSearchParams();
      if (workspaceId) params.append('workspaceId', workspaceId);
      if (userId) params.append('userId', userId);
      const query = params.toString() ? `?${params.toString()}` : '';
      return apiFetch<{ success: boolean; digest: DigestPreviewData }>(`/api/digests/preview${query}`);
    },
    trigger: (workspaceId?: string, targetUserId?: string) =>
      apiFetch<DigestTriggerResult>('/api/digests/trigger', {
        method: 'POST',
        body: JSON.stringify({ workspaceId, targetUserId }),
      }),
    getHistory: (workspaceId?: string, limit = 30) => {
      const params = new URLSearchParams();
      if (workspaceId) params.append('workspaceId', workspaceId);
      params.append('limit', limit.toString());
      return apiFetch<{ success: boolean; logs: DigestLogItem[] }>(`/api/digests/history?${params.toString()}`);
    },
    getSettings: (workspaceId: string) =>
      apiFetch<{ success: boolean; settings: DigestSettings }>(`/api/digests/settings?workspaceId=${workspaceId}`),
    updateSettings: (workspaceId: string, settings: Partial<DigestSettings>) =>
      apiFetch<{ success: boolean; settings: DigestSettings }>('/api/digests/settings', {
        method: 'PATCH',
        body: JSON.stringify({ workspaceId, ...settings }),
      }),
    getStatus: () =>
      apiFetch<{ success: boolean; status: { isRunning: boolean; nextScheduled: string; lastCheckedDate: string } }>(
        '/api/digests/status'
      ),
  },
};
