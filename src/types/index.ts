export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface User {
  id: string;
  email: string;
  name: string;
  title?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role: WorkspaceRole;
  member_count?: number;
  project_count?: number;
  created_at?: string;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  title?: string;
  avatar_url?: string;
  role: WorkspaceRole;
  joined_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  task_count?: number;
  blocked_count?: number;
  member_count?: number;
  workspace_name?: string;
}

export interface BoardColumn {
  id: string;
  project_id: string;
  name: string;
  position: number;
  is_default: boolean;
}

export interface TaskAssignee {
  user_id: string;
  name: string;
  email: string;
  title?: string;
  avatar_url?: string;
}

export interface TaskBlocker {
  id: string;
  task_id: string;
  project_id: string;
  reason: string;
  waiting_on_user_id?: string | null;
  waiting_on_name?: string | null;
  waiting_on_email?: string | null;
  waiting_on_team_text?: string | null;
  created_by_id: string;
  created_by_name?: string | null;
  is_resolved: boolean;
  resolved_by_id?: string | null;
  resolved_by_name?: string | null;
  resolution_note?: string | null;
  created_at: string;
  resolved_at?: string | null;
  task_title?: string;
  task_priority?: PriorityLevel;
  task_due_date?: string | null;
  column_name?: string;
  taskAssignees?: TaskAssignee[];
}

export interface TaskDecision {
  id: string;
  task_id: string;
  project_id: string;
  title: string;
  summary: string;
  rationale?: string | null;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  source_comment_id?: string | null;
  created_at: string;
  task_title?: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  action_type: string;
  metadata_json: string;
  created_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  depends_on_title: string;
  depends_on_priority?: PriorityLevel;
  depends_on_description?: string;
  depends_on_completed_at?: string | null;
  depends_on_column_name?: string;
  is_completed: boolean;
  created_at?: string;
}

export interface DownstreamBlockedTask {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  blocked_task_title: string;
  blocked_task_priority?: PriorityLevel;
  blocked_task_completed_at?: string | null;
  blocked_task_column_name?: string;
  is_completed: boolean;
  created_at?: string;
}

export interface TaskTimeLog {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  user_title?: string;
  avatar_url?: string;
  hours: number;
  description: string;
  logged_at: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  due_date: string | null;
  creator_id: string;
  creator_name?: string;
  position: number;
  is_blocked: boolean;
  estimated_hours?: number | null;
  time_spent_hours?: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignees: TaskAssignee[];
  activeBlocker?: TaskBlocker | null;
  dependencies?: TaskDependency[];
  blockingCount?: number;
  commentCount: number;
  decisionCount: number;
}

export interface TaskDetail extends Task {
  project_name?: string;
  column_name?: string;
  blockers: TaskBlocker[];
  decisions: TaskDecision[];
  comments: TaskComment[];
  activity: TaskActivity[];
  dependencies: TaskDependency[];
  blocking?: DownstreamBlockedTask[];
  timeLogs?: TaskTimeLog[];
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  project_id?: string;
  project_name?: string;
  is_read: boolean;
  created_at: string;
}

export interface ActiveViewer {
  userId: string;
  name: string;
}

export interface DigestTaskItem {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  column_name: string;
  priority: PriorityLevel | string;
  due_date: string | null;
  completed_at: string | null;
  assignees: string[];
  days_until_due?: number;
  urgency_label?: string;
}

export interface DigestBlockerItem {
  id: string;
  task_id: string;
  task_title: string;
  project_name: string;
  reason: string;
  waiting_on_name: string | null;
}

export interface DigestPreviewData {
  user: {
    id: string;
    name: string;
    email: string;
  };
  workspaceName: string;
  dateFormatted: string;
  completedTasks: DigestTaskItem[];
  upcomingTasks: DigestTaskItem[];
  activeBlockers: DigestBlockerItem[];
  subject: string;
  html: string;
  text: string;
}

export interface DigestLogItem {
  id: string;
  workspace_id: string;
  user_id: string;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  completed_count: number;
  upcoming_count: number;
  blockers_count: number;
  html_content: string;
  text_content: string | null;
  status: string;
  trigger_type: string;
  error_message: string | null;
  sent_at: string;
}

export interface DigestSettings {
  id: string;
  workspace_id: string;
  is_enabled: boolean;
  scheduled_hour: number;
  scheduled_minute: number;
  include_blockers: boolean;
  days_ahead: number;
  recipient_email_override: string | null;
  last_run_at: string | null;
}

export interface DigestTriggerResult {
  success: boolean;
  message: string;
  totalSent: number;
  totalFailed: number;
  logs: DigestLogItem[];
}

export interface PulseTaskInfo {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  column_name: string;
  priority: PriorityLevel | string;
  due_date: string | null;
  is_blocked: boolean;
  blocker_reason?: string | null;
  waiting_on_name?: string | null;
}

export interface PulseOtherTask {
  id: string;
  title: string;
  column_name: string;
  priority: PriorityLevel | string;
  project_name: string;
}

export interface MemberPulseItem {
  user_id: string;
  name: string;
  email: string;
  title: string;
  avatar_url: string | null;
  role: string;
  is_online: boolean;
  is_current_user: boolean;
  focus_status: 'working' | 'reviewing' | 'blocked' | 'available' | 'completed';
  focus_summary: string;
  primary_task: PulseTaskInfo | null;
  active_task_count: number;
  in_progress_count: number;
  blocked_count: number;
  other_tasks: PulseOtherTask[];
}

export interface TeamPulseResponse {
  success: boolean;
  workspaceId: string;
  activeCount: number;
  totalCount: number;
  teamPulse: MemberPulseItem[];
}


