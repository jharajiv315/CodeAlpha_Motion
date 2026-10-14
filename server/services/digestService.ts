import { db } from '../db/database.ts';
import { mailer } from './mailer.ts';
import { broadcastToUser } from '../realtime/socket.ts';

export interface DigestTaskItem {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  column_name: string;
  priority: string;
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

export interface DigestData {
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

export class DigestService {
  /**
   * Builds the digest data and renders email templates for a single user
   */
  public async generateUserDigestData(userId: string, workspaceId?: string): Promise<DigestData | null> {
    const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];

    // Determine target workspace
    let wsId = workspaceId;
    if (!wsId) {
      const wsRes = await db.query(
        `SELECT w.id, w.name FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1 ORDER BY wm.joined_at ASC LIMIT 1`,
        [userId]
      );
      if (wsRes.rows.length > 0) {
        wsId = wsRes.rows[0].id;
      }
    }

    let workspaceName = 'Your Team Workspace';
    if (wsId) {
      const wsDetails = await db.query('SELECT name FROM workspaces WHERE id = $1', [wsId]);
      if (wsDetails.rows.length > 0) {
        workspaceName = wsDetails.rows[0].name;
      }
    }

    // 1. Fetch Completed Tasks (completed recently in the user's projects)
    const completedRes = await db.query(
      `SELECT t.id, t.title, t.priority, t.due_date, t.completed_at,
              p.id as project_id, p.name as project_name, c.name as column_name,
              COALESCE(
                (SELECT string_agg(u.name, ', ')
                 FROM task_assignees ta
                 JOIN users u ON u.id = ta.user_id
                 WHERE ta.task_id = t.id),
                'Unassigned'
              ) as assignees_text
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN board_columns c ON c.id = t.column_id
       WHERE ($1::text IS NULL OR p.workspace_id = $1)
         AND (t.completed_at IS NOT NULL OR UPPER(c.name) = 'DONE')
         AND (t.completed_at >= NOW() - INTERVAL '3 days' OR t.updated_at >= NOW() - INTERVAL '3 days')
       ORDER BY t.completed_at DESC NULLS LAST, t.updated_at DESC
       LIMIT 10`,
      [wsId || null]
    );

    // Fallback: If no tasks completed in past 3 days, grab the most recent completed tasks from the projects so the digest provides real value
    let completedRows = completedRes.rows;
    if (completedRows.length === 0) {
      const fallbackCompleted = await db.query(
        `SELECT t.id, t.title, t.priority, t.due_date, t.completed_at,
                p.id as project_id, p.name as project_name, c.name as column_name,
                COALESCE(
                  (SELECT string_agg(u.name, ', ')
                   FROM task_assignees ta
                   JOIN users u ON u.id = ta.user_id
                   WHERE ta.task_id = t.id),
                  'Unassigned'
                ) as assignees_text
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         JOIN board_columns c ON c.id = t.column_id
         WHERE ($1::text IS NULL OR p.workspace_id = $1)
           AND (t.completed_at IS NOT NULL OR UPPER(c.name) = 'DONE')
         ORDER BY t.completed_at DESC NULLS LAST, t.updated_at DESC
         LIMIT 3`,
        [wsId || null]
      );
      completedRows = fallbackCompleted.rows;
    }

    const completedTasks: DigestTaskItem[] = completedRows.map((r: any) => ({
      id: r.id,
      title: r.title,
      project_id: r.project_id,
      project_name: r.project_name,
      column_name: r.column_name,
      priority: r.priority || 'MEDIUM',
      due_date: r.due_date,
      completed_at: r.completed_at,
      assignees: r.assignees_text ? r.assignees_text.split(', ') : [],
    }));

    // 2. Fetch Upcoming Deadlines (due within the next 7 days or overdue, not yet done)
    const upcomingRes = await db.query(
      `SELECT t.id, t.title, t.priority, t.due_date, t.completed_at,
              p.id as project_id, p.name as project_name, c.name as column_name,
              COALESCE(
                (SELECT string_agg(u.name, ', ')
                 FROM task_assignees ta
                 JOIN users u ON u.id = ta.user_id
                 WHERE ta.task_id = t.id),
                'Unassigned'
              ) as assignees_text,
              ROUND(EXTRACT(EPOCH FROM (t.due_date - NOW())) / 86400) as days_diff
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN board_columns c ON c.id = t.column_id
       WHERE ($1::text IS NULL OR p.workspace_id = $1)
         AND t.due_date IS NOT NULL
         AND t.completed_at IS NULL
         AND UPPER(c.name) != 'DONE'
         AND t.due_date <= NOW() + INTERVAL '7 days'
       ORDER BY t.due_date ASC
       LIMIT 10`,
      [wsId || null]
    );

    const now = new Date();
    const upcomingTasks: DigestTaskItem[] = upcomingRes.rows.map((r: any) => {
      const daysDiff = Number(r.days_diff);
      let urgency = 'Upcoming';
      if (daysDiff < 0) {
        urgency = 'Overdue';
      } else if (daysDiff === 0) {
        urgency = 'Due Today';
      } else if (daysDiff === 1) {
        urgency = 'Due Tomorrow';
      } else {
        urgency = `Due in ${daysDiff} days`;
      }

      return {
        id: r.id,
        title: r.title,
        project_id: r.project_id,
        project_name: r.project_name,
        column_name: r.column_name,
        priority: r.priority || 'MEDIUM',
        due_date: r.due_date,
        completed_at: null,
        assignees: r.assignees_text ? r.assignees_text.split(', ') : [],
        days_until_due: daysDiff,
        urgency_label: urgency,
      };
    });

    // 3. Fetch Active Blockers in their projects
    const blockersRes = await db.query(
      `SELECT tb.id, tb.task_id, tb.reason,
              t.title as task_title, p.name as project_name,
              u.name as waiting_on_name
       FROM task_blockers tb
       JOIN tasks t ON t.id = tb.task_id
       JOIN projects p ON p.id = tb.project_id
       LEFT JOIN users u ON u.id = tb.waiting_on_user_id
       WHERE ($1::text IS NULL OR p.workspace_id = $1)
         AND tb.is_resolved = FALSE
       ORDER BY tb.created_at DESC
       LIMIT 5`,
      [wsId || null]
    );

    const activeBlockers: DigestBlockerItem[] = blockersRes.rows.map((b: any) => ({
      id: b.id,
      task_id: b.task_id,
      task_title: b.task_title,
      project_name: b.project_name,
      reason: b.reason,
      waiting_on_name: b.waiting_on_name || 'Team member',
    }));

    const dateFormatted = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const subject = `[MOTION] Daily Digest: ${completedTasks.length} Completed, ${upcomingTasks.length} Deadlines (${dateFormatted})`;

    const html = this.renderHtmlEmail({
      userName: user.name,
      workspaceName,
      dateFormatted,
      completedTasks,
      upcomingTasks,
      activeBlockers,
    });

    const text = this.renderPlainTextEmail({
      userName: user.name,
      workspaceName,
      dateFormatted,
      completedTasks,
      upcomingTasks,
      activeBlockers,
    });

    return {
      user,
      workspaceName,
      dateFormatted,
      completedTasks,
      upcomingTasks,
      activeBlockers,
      subject,
      html,
      text,
    };
  }

  /**
   * Dispatches the daily digest email to team members
   */
  public async sendDailyDigest(options: {
    triggerType?: 'scheduled' | 'manual' | 'test';
    specificUserId?: string;
    workspaceId?: string;
  }): Promise<{ totalSent: number; totalFailed: number; logs: DigestLogItem[] }> {
    const triggerType = options.triggerType || 'scheduled';
    console.log(`[DigestService] Initiating daily digest run (trigger: ${triggerType})...`);

    // Find target workspace
    let wsId = options.workspaceId;
    if (!wsId) {
      const wsRes = await db.query('SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1');
      if (wsRes.rows.length > 0) {
        wsId = wsRes.rows[0].id;
      }
    }

    if (!wsId) {
      console.warn('[DigestService] No workspaces found in database to send digest for.');
      return { totalSent: 0, totalFailed: 0, logs: [] };
    }

    // Get settings
    const settings = await this.getDigestSettings(wsId);
    if (!settings.is_enabled && triggerType === 'scheduled') {
      console.log(`[DigestService] Daily digest is disabled for workspace ${wsId}. Skipping scheduled run.`);
      return { totalSent: 0, totalFailed: 0, logs: [] };
    }

    // Get users to send to
    let targetUsers: { id: string; name: string; email: string }[] = [];
    if (options.specificUserId) {
      const uRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [options.specificUserId]);
      targetUsers = uRes.rows;
    } else {
      // Send to all workspace members
      const membersRes = await db.query(
        `SELECT u.id, u.name, u.email
         FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = $1`,
        [wsId]
      );
      targetUsers = membersRes.rows;
    }

    if (targetUsers.length === 0) {
      console.warn('[DigestService] No recipients found for digest.');
      return { totalSent: 0, totalFailed: 0, logs: [] };
    }

    const createdLogs: DigestLogItem[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of targetUsers) {
      try {
        const digestData = await this.generateUserDigestData(recipient.id, wsId);
        if (!digestData) continue;

        // Determine destination email
        let destinationEmail = recipient.email;
        if (settings.recipient_email_override && recipient.id === 'usr_rajiv') {
          destinationEmail = settings.recipient_email_override;
        }

        // Send Email via Mailer
        const sendResult = await mailer.sendMail({
          to: destinationEmail,
          toName: recipient.name,
          subject: digestData.subject,
          html: digestData.html,
          text: digestData.text,
        });

        const logId = `dlog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const status = sendResult.success ? 'sent' : 'failed';
        const errorMsg = sendResult.error || null;

        // Record in daily_digest_logs table
        await db.query(
          `INSERT INTO daily_digest_logs (
            id, workspace_id, user_id, recipient_name, recipient_email,
            subject, completed_count, upcoming_count, blockers_count,
            html_content, text_content, status, trigger_type, error_message, sent_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
          [
            logId,
            wsId,
            recipient.id,
            recipient.name,
            destinationEmail,
            digestData.subject,
            digestData.completedTasks.length,
            digestData.upcomingTasks.length,
            digestData.activeBlockers.length,
            digestData.html,
            digestData.text,
            status,
            triggerType,
            errorMsg,
          ]
        );

        if (sendResult.success) {
          sentCount++;

          // Create an in-app notification for the team member
          const notifId = `ntf_d_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await db.query(
            `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())`,
            [
              notifId,
              recipient.id,
              'DAILY_DIGEST_SENT',
              'Daily Digest Delivered',
              `Summary: ${digestData.completedTasks.length} completed tasks & ${digestData.upcomingTasks.length} upcoming deadlines sent to ${destinationEmail}.`,
              'DIGEST',
              logId,
            ]
          );

          // Broadcast in real-time to active user
          broadcastToUser(recipient.id, 'notification:new', {
            id: notifId,
            title: 'Daily Digest Delivered',
            body: `Summary: ${digestData.completedTasks.length} completed tasks & ${digestData.upcomingTasks.length} upcoming deadlines.`,
          });
        } else {
          failedCount++;
        }

        createdLogs.push({
          id: logId,
          workspace_id: wsId,
          user_id: recipient.id,
          recipient_name: recipient.name,
          recipient_email: destinationEmail,
          subject: digestData.subject,
          completed_count: digestData.completedTasks.length,
          upcoming_count: digestData.upcomingTasks.length,
          blockers_count: digestData.activeBlockers.length,
          html_content: digestData.html,
          text_content: digestData.text,
          status,
          trigger_type: triggerType,
          error_message: errorMsg,
          sent_at: new Date().toISOString(),
        });
      } catch (userErr: any) {
        console.error(`[DigestService] Error processing digest for ${recipient.email}:`, userErr);
        failedCount++;
      }
    }

    // Update last_run_at in settings
    await db.query(
      `UPDATE daily_digest_settings SET last_run_at = NOW(), updated_at = NOW() WHERE workspace_id = $1`,
      [wsId]
    ).catch(() => {});

    console.log(`[DigestService] Daily digest run completed: ${sentCount} sent, ${failedCount} failed.`);
    return { totalSent: sentCount, totalFailed: failedCount, logs: createdLogs };
  }

  /**
   * Returns sent digest logs history
   */
  public async getDigestHistory(workspaceId?: string, limit = 25): Promise<DigestLogItem[]> {
    const res = await db.query(
      `SELECT id, workspace_id, user_id, recipient_name, recipient_email,
              subject, completed_count, upcoming_count, blockers_count,
              html_content, text_content, status, trigger_type, error_message, sent_at
       FROM daily_digest_logs
       WHERE ($1::text IS NULL OR workspace_id = $1)
       ORDER BY sent_at DESC
       LIMIT $2`,
      [workspaceId || null, limit]
    );
    return res.rows;
  }

  /**
   * Returns current settings
   */
  public async getDigestSettings(workspaceId: string): Promise<DigestSettings> {
    const res = await db.query(
      `SELECT id, workspace_id, is_enabled, scheduled_hour, scheduled_minute,
              include_blockers, days_ahead, recipient_email_override, last_run_at
       FROM daily_digest_settings
       WHERE workspace_id = $1`,
      [workspaceId]
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    }

    // Default settings
    const defaultSettings: DigestSettings = {
      id: `set_${workspaceId}`,
      workspace_id: workspaceId,
      is_enabled: true,
      scheduled_hour: 8,
      scheduled_minute: 0,
      include_blockers: true,
      days_ahead: 7,
      recipient_email_override: 'jharajiv315@gmail.com',
      last_run_at: null,
    };

    await db.query(
      `INSERT INTO daily_digest_settings (
        id, workspace_id, is_enabled, scheduled_hour, scheduled_minute,
        include_blockers, days_ahead, recipient_email_override, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING`,
      [
        defaultSettings.id,
        defaultSettings.workspace_id,
        defaultSettings.is_enabled,
        defaultSettings.scheduled_hour,
        defaultSettings.scheduled_minute,
        defaultSettings.include_blockers,
        defaultSettings.days_ahead,
        defaultSettings.recipient_email_override,
      ]
    ).catch(() => {});

    return defaultSettings;
  }

  /**
   * Updates settings
   */
  public async updateDigestSettings(
    workspaceId: string,
    updates: Partial<Omit<DigestSettings, 'id' | 'workspace_id'>>
  ): Promise<DigestSettings> {
    const current = await this.getDigestSettings(workspaceId);

    const isEnabled = updates.is_enabled !== undefined ? updates.is_enabled : current.is_enabled;
    const scheduledHour = updates.scheduled_hour !== undefined ? updates.scheduled_hour : current.scheduled_hour;
    const scheduledMinute = updates.scheduled_minute !== undefined ? updates.scheduled_minute : current.scheduled_minute;
    const includeBlockers = updates.include_blockers !== undefined ? updates.include_blockers : current.include_blockers;
    const daysAhead = updates.days_ahead !== undefined ? updates.days_ahead : current.days_ahead;
    const recipientOverride = updates.recipient_email_override !== undefined ? updates.recipient_email_override : current.recipient_email_override;

    await db.query(
      `UPDATE daily_digest_settings
       SET is_enabled = $1, scheduled_hour = $2, scheduled_minute = $3,
           include_blockers = $4, days_ahead = $5, recipient_email_override = $6, updated_at = NOW()
       WHERE workspace_id = $7`,
      [isEnabled, scheduledHour, scheduledMinute, includeBlockers, daysAhead, recipientOverride, workspaceId]
    );

    return this.getDigestSettings(workspaceId);
  }

  /**
   * Renders modern, responsive HTML email template
   */
  private renderHtmlEmail(data: {
    userName: string;
    workspaceName: string;
    dateFormatted: string;
    completedTasks: DigestTaskItem[];
    upcomingTasks: DigestTaskItem[];
    activeBlockers: DigestBlockerItem[];
  }): string {
    const { userName, workspaceName, dateFormatted, completedTasks, upcomingTasks, activeBlockers } = data;

    const completedRows = completedTasks.length > 0
      ? completedTasks.map((t) => `
        <tr style="border-bottom: 1px solid #F1F3F5;">
          <td style="padding: 12px 14px; vertical-align: top;">
            <div style="font-weight: 600; color: #1E293B; font-size: 14px; margin-bottom: 4px;">
              &#10003; ${this.escapeHtml(t.title)}
            </div>
            <div style="font-size: 12px; color: #64748B;">
              Project: <span style="font-weight: 500; color: #475569;">${this.escapeHtml(t.project_name)}</span>
              &nbsp;&bull;&nbsp;
              Assignee: <span style="color: #475569;">${this.escapeHtml(t.assignees.join(', ') || 'Unassigned')}</span>
            </div>
          </td>
          <td style="padding: 12px 14px; vertical-align: top; text-align: right; white-space: nowrap;">
            <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; background-color: #DCFCE7; color: #15803D;">
              Done
            </span>
          </td>
        </tr>
      `).join('')
      : `<tr><td colspan="2" style="padding: 16px; text-align: center; color: #94A3B8; font-size: 13px; font-style: italic;">No tasks marked completed in the last 48 hours.</td></tr>`;

    const upcomingRows = upcomingTasks.length > 0
      ? upcomingTasks.map((t) => {
        let badgeBg = '#F1F5F9';
        let badgeColor = '#475569';
        if (t.urgency_label?.includes('Overdue')) {
          badgeBg = '#FEE2E2';
          badgeColor = '#991B1B';
        } else if (t.urgency_label?.includes('Today')) {
          badgeBg = '#FEF3C7';
          badgeColor = '#92400E';
        } else if (t.urgency_label?.includes('Tomorrow')) {
          badgeBg = '#FFEDD5';
          badgeColor = '#C2410C';
        }

        const priorityBadge = t.priority === 'HIGH'
          ? '<span style="display: inline-block; padding: 1px 6px; font-size: 10px; font-weight: 600; border-radius: 3px; background-color: #FFE4E6; color: #E11D48; margin-left: 6px;">HIGH</span>'
          : t.priority === 'MEDIUM'
          ? '<span style="display: inline-block; padding: 1px 6px; font-size: 10px; font-weight: 600; border-radius: 3px; background-color: #FEF3C7; color: #D97706; margin-left: 6px;">MED</span>'
          : '<span style="display: inline-block; padding: 1px 6px; font-size: 10px; font-weight: 600; border-radius: 3px; background-color: #F1F5F9; color: #64748B; margin-left: 6px;">LOW</span>';

        return `
          <tr style="border-bottom: 1px solid #F1F3F5;">
            <td style="padding: 12px 14px; vertical-align: top;">
              <div style="font-weight: 600; color: #1E293B; font-size: 14px; margin-bottom: 4px;">
                ${this.escapeHtml(t.title)} ${priorityBadge}
              </div>
              <div style="font-size: 12px; color: #64748B;">
                Project: <span style="font-weight: 500; color: #475569;">${this.escapeHtml(t.project_name)}</span>
                &nbsp;&bull;&nbsp;
                Assignee: <span style="color: #475569;">${this.escapeHtml(t.assignees.join(', ') || 'Unassigned')}</span>
                &nbsp;&bull;&nbsp;
                Status: <span style="font-family: monospace; font-size: 11px;">${this.escapeHtml(t.column_name)}</span>
              </div>
            </td>
            <td style="padding: 12px 14px; vertical-align: top; text-align: right; white-space: nowrap;">
              <span style="display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; background-color: ${badgeBg}; color: ${badgeColor};">
                ${t.urgency_label}
              </span>
            </td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="2" style="padding: 16px; text-align: center; color: #94A3B8; font-size: 13px; font-style: italic;">No pending deadlines due in the next 7 days.</td></tr>`;

    const blockersSection = activeBlockers.length > 0 ? `
      <!-- Active Blockers Notice -->
      <div style="margin-top: 24px; padding: 16px; background-color: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px;">
        <div style="font-size: 13px; font-weight: 700; color: #9A3412; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          &#9888; Active Blocker Radar (${activeBlockers.length})
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #7C2D12; line-height: 1.6;">
          ${activeBlockers.map((b) => `
            <li style="margin-bottom: 6px;">
              <strong>${this.escapeHtml(b.task_title)}</strong> (${this.escapeHtml(b.project_name)}):
              ${this.escapeHtml(b.reason)}
              ${b.waiting_on_name ? `<span style="font-style: italic; color: #9A3412;"> &mdash; Waiting on ${this.escapeHtml(b.waiting_on_name)}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MOTION Daily Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #20242B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 24px 28px; background-color: #20242B; color: #FFFFFF;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF; margin-bottom: 4px;">
                      MOTION
                    </div>
                    <div style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">
                      Daily Digest &bull; ${this.escapeHtml(workspaceName)}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <div style="font-size: 12px; color: #CBD5E1; font-weight: 500;">
                      ${this.escapeHtml(dateFormatted)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome & Stats Banner -->
          <tr>
            <td style="padding: 24px 28px 16px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">
                Hello <strong>${this.escapeHtml(userName)}</strong>, here is your project summary for today with completed milestones and upcoming deadlines.
              </p>

              <!-- Quick Metrics Grid -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8px;">
                <tr>
                  <td width="33%" style="padding: 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; color: #16A34A;">${completedTasks.length}</div>
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748B; margin-top: 2px;">Completed</div>
                  </td>
                  <td width="4%"></td>
                  <td width="33%" style="padding: 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; color: #EA580C;">${upcomingTasks.length}</div>
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748B; margin-top: 2px;">Upcoming</div>
                  </td>
                  <td width="4%"></td>
                  <td width="33%" style="padding: 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; color: #DC2626;">${activeBlockers.length}</div>
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748B; margin-top: 2px;">Blockers</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section 1: Recently Completed Tasks -->
          <tr>
            <td style="padding: 12px 28px;">
              <div style="font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px;">
                &#10003; Completed Tasks (${completedTasks.length})
              </div>
              <table width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background-color: #FFFFFF;">
                ${completedRows}
              </table>
            </td>
          </tr>

          <!-- Section 2: Upcoming Deadlines -->
          <tr>
            <td style="padding: 16px 28px;">
              <div style="font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px;">
                &#9200; Upcoming Deadlines (${upcomingTasks.length})
              </div>
              <table width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background-color: #FFFFFF;">
                ${upcomingRows}
              </table>
            </td>
          </tr>

          <!-- Section 3: Blocker Radar (if any) -->
          ${blockersSection ? `
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              ${blockersSection}
            </td>
          </tr>
          ` : ''}

          <!-- Footer Action Button & Note -->
          <tr>
            <td style="padding: 24px 28px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
              <a href="#" style="display: inline-block; background-color: #20242B; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 22px; border-radius: 6px; margin-bottom: 14px;">
                Open Project Board &rarr;
              </a>
              <div style="font-size: 11px; color: #94A3B8; line-height: 1.5;">
                This digest was automatically dispatched by the MOTION daily background task.<br>
                To customize schedule timing or recipients, visit Workspace Settings in MOTION.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Plain-text email fallback
   */
  private renderPlainTextEmail(data: {
    userName: string;
    workspaceName: string;
    dateFormatted: string;
    completedTasks: DigestTaskItem[];
    upcomingTasks: DigestTaskItem[];
    activeBlockers: DigestBlockerItem[];
  }): string {
    const { userName, workspaceName, dateFormatted, completedTasks, upcomingTasks, activeBlockers } = data;

    let text = `MOTION DAILY DIGEST - ${workspaceName.toUpperCase()}\n`;
    text += `Date: ${dateFormatted}\n`;
    text += `Hello ${userName},\n\n`;
    text += `Here is your daily summary of completed tasks and upcoming deadlines.\n\n`;

    text += `========================================\n`;
    text += `COMPLETED TASKS (${completedTasks.length})\n`;
    text += `========================================\n`;
    if (completedTasks.length === 0) {
      text += `No tasks completed in the last 48 hours.\n`;
    } else {
      completedTasks.forEach((t) => {
        text += `- ${t.title} [Project: ${t.project_name}] (Assignees: ${t.assignees.join(', ') || 'None'})\n`;
      });
    }
    text += `\n`;

    text += `========================================\n`;
    text += `UPCOMING DEADLINES (${upcomingTasks.length})\n`;
    text += `========================================\n`;
    if (upcomingTasks.length === 0) {
      text += `No pending deadlines due in the next 7 days.\n`;
    } else {
      upcomingTasks.forEach((t) => {
        text += `- ${t.title} [${t.urgency_label}] (Project: ${t.project_name}, Priority: ${t.priority})\n`;
      });
    }
    text += `\n`;

    if (activeBlockers.length > 0) {
      text += `========================================\n`;
      text += `ACTIVE BLOCKERS (${activeBlockers.length})\n`;
      text += `========================================\n`;
      activeBlockers.forEach((b) => {
        text += `! ${b.task_title}: ${b.reason} (Waiting on: ${b.waiting_on_name || 'Team member'})\n`;
      });
      text += `\n`;
    }

    text += `\n--\nMOTION Collaborative Platform\n`;
    return text;
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const digestService = new DigestService();
