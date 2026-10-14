import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { digestService } from '../services/digestService.ts';
import { dailyDigestWorker } from '../cron/dailyDigestWorker.ts';
import { z } from 'zod';

export const digestRouter = Router();

// GET /api/digests/preview - Preview the rendered digest email
digestRouter.get('/preview', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = (req.query.userId as string) || req.user!.id;
    const workspaceId = req.query.workspaceId as string | undefined;

    const data = await digestService.generateUserDigestData(userId, workspaceId);
    if (!data) {
      res.status(404).json({ error: 'Could not generate digest preview for user' });
      return;
    }

    res.json({ success: true, digest: data });
  } catch (err: any) {
    console.error('Error generating digest preview:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/digests/trigger - Manually trigger daily digest dispatch
digestRouter.post('/trigger', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { workspaceId, targetUserId } = req.body;

    const result = await digestService.sendDailyDigest({
      triggerType: 'manual',
      workspaceId,
      specificUserId: targetUserId,
    });

    res.json({
      success: true,
      message: `Daily digest successfully dispatched to ${result.totalSent} team members.`,
      totalSent: result.totalSent,
      totalFailed: result.totalFailed,
      logs: result.logs,
    });
  } catch (err: any) {
    console.error('Error triggering daily digest:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/digests/history - Get past digest dispatch logs
digestRouter.get('/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const limit = parseInt((req.query.limit as string) || '30', 10);

    const logs = await digestService.getDigestHistory(workspaceId, limit);
    res.json({ success: true, logs });
  } catch (err: any) {
    console.error('Error retrieving digest history:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/digests/settings - Get settings for workspace
digestRouter.get('/settings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws_acme';
    const settings = await digestService.getDigestSettings(workspaceId);
    res.json({ success: true, settings });
  } catch (err: any) {
    console.error('Error retrieving digest settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/digests/settings - Update settings for workspace
const UpdateSettingsSchema = z.object({
  workspaceId: z.string().min(1),
  isEnabled: z.boolean().optional(),
  scheduledHour: z.number().min(0).max(23).optional(),
  scheduledMinute: z.number().min(0).max(59).optional(),
  includeBlockers: z.boolean().optional(),
  daysAhead: z.number().min(1).max(30).optional(),
  recipientEmailOverride: z.string().email().optional().or(z.literal('')),
});

digestRouter.patch('/settings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = UpdateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings' });
      return;
    }

    const {
      workspaceId,
      isEnabled,
      scheduledHour,
      scheduledMinute,
      includeBlockers,
      daysAhead,
      recipientEmailOverride,
    } = parsed.data;

    const updated = await digestService.updateDigestSettings(workspaceId, {
      is_enabled: isEnabled,
      scheduled_hour: scheduledHour,
      scheduled_minute: scheduledMinute,
      include_blockers: includeBlockers,
      days_ahead: daysAhead,
      recipient_email_override: recipientEmailOverride,
    });

    res.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error('Error updating digest settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/digests/status - Get status of background worker
digestRouter.get('/status', requireAuth, async (_req, res) => {
  const status = dailyDigestWorker.getStatus();
  res.json({ success: true, status });
});
