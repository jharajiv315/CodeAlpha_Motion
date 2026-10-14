import { db } from '../db/database.ts';
import { digestService } from '../services/digestService.ts';

class DailyDigestWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastCheckedDate = '';

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[DailyDigestWorker] Starting background task scheduler for Daily Digest emails...');

    // Run first check after a brief startup delay (5 seconds), then check every 60 seconds
    setTimeout(() => {
      this.checkSchedule();
    }, 5000);

    this.timer = setInterval(() => {
      this.checkSchedule();
    }, 60000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[DailyDigestWorker] Background task scheduler stopped.');
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      nextScheduled: 'Daily at 08:00 AM (local time)',
      lastCheckedDate: this.lastCheckedDate,
    };
  }

  public async triggerNow(workspaceId?: string, specificUserId?: string) {
    console.log('[DailyDigestWorker] Manual trigger initiated by user...');
    return await digestService.sendDailyDigest({
      triggerType: 'manual',
      workspaceId,
      specificUserId,
    });
  }

  private async checkSchedule(): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayDateStr = now.toISOString().split('T')[0];
      this.lastCheckedDate = todayDateStr;

      // Query active workspaces and their digest settings
      const settingsRes = await db.query(
        `SELECT id, workspace_id, is_enabled, scheduled_hour, scheduled_minute, last_run_at
         FROM daily_digest_settings
         WHERE is_enabled = TRUE`
      );

      for (const setting of settingsRes.rows) {
        const scheduledHour = setting.scheduled_hour ?? 8;
        const scheduledMinute = setting.scheduled_minute ?? 0;

        // Has it already run today?
        let alreadyRunToday = false;
        if (setting.last_run_at) {
          const lastRunDateStr = new Date(setting.last_run_at).toISOString().split('T')[0];
          if (lastRunDateStr === todayDateStr) {
            alreadyRunToday = true;
          }
        }

        // If not already run today and time has reached the scheduled time
        if (!alreadyRunToday && currentHour === scheduledHour && Math.abs(currentMinute - scheduledMinute) <= 1) {
          console.log(`[DailyDigestWorker] Scheduled time reached (${scheduledHour}:${scheduledMinute.toString().padStart(2, '0')}). Executing Daily Digest for workspace ${setting.workspace_id}...`);
          await digestService.sendDailyDigest({
            triggerType: 'scheduled',
            workspaceId: setting.workspace_id,
          });
        }
      }
    } catch (err) {
      console.error('[DailyDigestWorker] Error during schedule check cycle:', err);
    }
  }
}

export const dailyDigestWorker = new DailyDigestWorker();
