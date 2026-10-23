import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import type {
  DigestPreviewData,
  DigestLogItem,
  DigestSettings,
} from '../../types/index.ts';
import { formatDate } from '../../lib/utils.ts';
import {
  X,
  Mail,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  Settings,
  Eye,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface DailyDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyDigestModal({ isOpen, onClose }: DailyDigestModalProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'preview' | 'history' | 'settings'>('overview');
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [preview, setPreview] = useState<DigestPreviewData | null>(null);
  const [history, setHistory] = useState<DigestLogItem[]>([]);
  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [workerStatus, setWorkerStatus] = useState<{ isRunning: boolean; nextScheduled: string } | null>(null);

  const [isEnabled, setIsEnabled] = useState(true);
  const [scheduledHour, setScheduledHour] = useState(8);
  const [recipientEmailOverride, setRecipientEmailOverride] = useState('');
  const [daysAhead, setDaysAhead] = useState(7);
  const [savingSettings, setSavingSettings] = useState(false);

  const [inspectedLog, setInspectedLog] = useState<DigestLogItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadAllData();
  }, [isOpen, currentWorkspace]);

  const loadAllData = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const [prevRes, histRes, setRes, statRes] = await Promise.all([
        api.digests.preview(currentWorkspace.id).catch(() => ({ digest: null })),
        api.digests.getHistory(currentWorkspace.id).catch(() => ({ logs: [] })),
        api.digests.getSettings(currentWorkspace.id).catch(() => ({ settings: null })),
        api.digests.getStatus().catch(() => ({ status: { isRunning: true, nextScheduled: 'Daily at 08:00 AM' } })),
      ]);

      if (prevRes && 'digest' in prevRes && prevRes.digest) setPreview(prevRes.digest);
      if (histRes && 'logs' in histRes) setHistory(histRes.logs);
      if (statRes && 'status' in statRes) setWorkerStatus(statRes.status as any);

      if (setRes && 'settings' in setRes && setRes.settings) {
        setSettings(setRes.settings);
        setIsEnabled(setRes.settings.is_enabled);
        setScheduledHour(setRes.settings.scheduled_hour);
        setRecipientEmailOverride(setRes.settings.recipient_email_override || '');
        setDaysAhead(setRes.settings.days_ahead || 7);
      }
    } catch (err) {
      console.error('Failed to load digest data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDigest = async (targetUserId?: string) => {
    if (!currentWorkspace) return;
    setTriggering(true);
    setFeedbackMessage(null);
    try {
      const res = await api.digests.trigger(currentWorkspace.id, targetUserId);
      setFeedbackMessage({
        text: res.message || `Daily digest dispatched (${res.totalSent} sent).`,
        type: 'success',
      });
      const histRes = await api.digests.getHistory(currentWorkspace.id);
      if (histRes.logs) setHistory(histRes.logs);
    } catch (err: any) {
      setFeedbackMessage({
        text: err.message || 'Failed to dispatch daily digest email.',
        type: 'error',
      });
    } finally {
      setTriggering(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setSavingSettings(true);
    setFeedbackMessage(null);
    try {
      const res = await api.digests.updateSettings(currentWorkspace.id, {
        is_enabled: isEnabled,
        scheduled_hour: scheduledHour,
        scheduled_minute: 0,
        days_ahead: daysAhead,
        recipient_email_override: recipientEmailOverride.trim() || undefined,
      });
      setSettings(res.settings);
      setFeedbackMessage({
        text: 'Daily digest preferences saved.',
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMessage({
        text: err.message || 'Failed to save settings.',
        type: 'error',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/20 p-4 sm:p-6 overflow-y-auto">
      <div className="motion-modal rounded-[12px] max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#FFFCF6] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[9px] bg-[#E3EBDD] border border-[#C8D8C1] text-[#596D56] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[#33382F]">Daily Digest</h2>
              <p className="text-[12px] text-[#70786D]">
                Automated email summaries of completed tasks, upcoming deadlines, and blockers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTriggerDigest()}
              disabled={triggering}
              className="btn-primary px-3 py-1.5 rounded-[9px] text-[12.5px] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {triggering ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{triggering ? 'Sending...' : 'Send Digest Now'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-[#70786D] hover:text-[#33382F] p-1.5 rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 border-b border-[#EAE4D8] bg-[#F3EFE5] shrink-0">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-2.5 text-[12.5px] border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-[#596D56] text-[#33382F] font-semibold'
                  : 'border-transparent text-[#5D655A] hover:text-[#33382F]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`py-2.5 text-[12.5px] border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'preview'
                  ? 'border-[#596D56] text-[#33382F] font-semibold'
                  : 'border-transparent text-[#5D655A] hover:text-[#33382F]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Email Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-2.5 text-[12.5px] border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'border-[#596D56] text-[#33382F] font-semibold'
                  : 'border-transparent text-[#5D655A] hover:text-[#33382F]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Sent History ({history.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-2.5 text-[12.5px] border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-[#596D56] text-[#33382F] font-semibold'
                  : 'border-transparent text-[#5D655A] hover:text-[#33382F]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="text-[11.5px] text-[#5D655A] hover:text-[#33382F] p-1 flex items-center gap-1 cursor-pointer font-medium"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2.5 text-[12.5px] flex items-center justify-between shrink-0 ${
              feedbackMessage.type === 'success'
                ? 'bg-[#E6EEE4] text-[#35513A] border-b border-[#C8D8C1]'
                : 'bg-[#F3E7DD] text-[#985C51] border-b border-[#DFC2B0]'
            }`}
          >
            <span className="font-semibold">{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="hover:opacity-75 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F7F4EC] space-y-5 text-[13px]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="motion-surface rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#70786D] uppercase tracking-[0.04em]">
                    Schedule
                  </span>
                  <h3 className="text-[14px] font-semibold text-[#33382F]">
                    Daily at {settings?.scheduled_hour?.toString().padStart(2, '0') || '08'}:00 AM
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] text-[#5D655A]">
                    Recipient: <strong className="text-[#33382F]">{settings?.recipient_email_override || user?.email || 'Team'}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTriggerDigest(user?.id)}
                    disabled={triggering}
                    className="btn-secondary px-2.5 py-1 text-[12px] rounded-[6px] flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send to me</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Completed Tasks */}
                <div className="motion-surface rounded-[12px] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EAE4D8]">
                    <div className="flex items-center gap-2 font-semibold text-[13.5px] text-[#33382F]">
                      <CheckCircle2 className="w-4 h-4 text-[#62866B]" />
                      <span>Completed ({preview?.completedTasks?.length || 0})</span>
                    </div>
                    <span className="text-[11px] text-[#70786D]">Last 48h</span>
                  </div>

                  {(!preview?.completedTasks || preview.completedTasks.length === 0) ? (
                    <p className="text-[12.5px] text-[#70786D] py-3">
                      No tasks completed in this window.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {preview.completedTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-[9px] border border-[#C8D8C1] bg-[#E6EEE4]/50 text-[12.5px] space-y-0.5"
                        >
                          <div className="font-semibold text-[#33382F] flex items-center justify-between gap-2">
                            <span className="truncate">{t.title}</span>
                            <span className="text-[10.5px] font-semibold bg-[#E6EEE4] text-[#35513A] px-2 py-0.5 rounded-[4px]">
                              Done
                            </span>
                          </div>
                          <div className="text-[11px] text-[#5D655A]">
                            {t.project_name} · {t.assignees.join(', ') || 'Unassigned'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Deadlines */}
                <div className="motion-surface rounded-[12px] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EAE4D8]">
                    <div className="flex items-center gap-2 font-semibold text-[13.5px] text-[#33382F]">
                      <Clock className="w-4 h-4 text-[#B9A27C]" />
                      <span>Upcoming Deadlines ({preview?.upcomingTasks?.length || 0})</span>
                    </div>
                    <span className="text-[11px] text-[#70786D]">Next 7d</span>
                  </div>

                  {(!preview?.upcomingTasks || preview.upcomingTasks.length === 0) ? (
                    <p className="text-[12.5px] text-[#70786D] py-3">
                      No deadlines in the next 7 days.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {preview.upcomingTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-[9px] border border-[#DED8CB] bg-[#F3EFE5] text-[12.5px] space-y-0.5"
                        >
                          <div className="font-semibold text-[#33382F] flex items-center justify-between gap-2">
                            <span className="truncate">{t.title}</span>
                            <span className="text-[10.5px] font-semibold bg-[#F1E9DB] text-[#5E4D33] px-2 py-0.5 rounded-[4px]">
                              {t.urgency_label}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#5D655A]">
                            {t.project_name} · Due {t.due_date ? formatDate(t.due_date) : 'Soon'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Blockers */}
              {preview?.activeBlockers && preview.activeBlockers.length > 0 && (
                <div className="bg-[#F3E7DD] border border-[#DFC2B0] rounded-[12px] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#7B4B3A]">
                    <AlertTriangle className="w-4 h-4 text-[#A46F5C]" />
                    <span>Active Blockers Included ({preview.activeBlockers.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {preview.activeBlockers.map((b) => (
                      <div key={b.id} className="bg-[#FFFCF6] p-2.5 rounded-[9px] border border-[#DFC2B0] text-[12px]">
                        <div className="font-semibold text-[#33382F]">{b.task_title} ({b.project_name})</div>
                        <div className="text-[#5D655A]">{b.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[12.5px] text-[#5D655A] motion-surface p-3.5 rounded-[12px]">
                <div>
                  <strong className="text-[#33382F]">Subject:</strong> {preview?.subject || 'MOTION Daily Digest'}
                </div>
                <div>
                  <strong className="text-[#33382F]">To:</strong> {settings?.recipient_email_override || user?.email}
                </div>
              </div>

              <div className="motion-surface rounded-[12px] overflow-hidden">
                {preview?.html ? (
                  <iframe
                    title="Digest Email Preview"
                    srcDoc={preview.html}
                    className="w-full h-[480px] border-none bg-[#FFFCF6]"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="h-56 flex items-center justify-center text-[13px] text-[#70786D]">
                    No preview content generated.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="motion-surface rounded-[12px] p-8 text-center text-[13px] text-[#5D655A]">
                  No digest emails sent yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((log) => (
                    <div
                      key={log.id}
                      className="motion-surface rounded-[12px] p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#33382F] truncate">{log.subject}</span>
                          <span className="px-2 py-0.5 rounded-[4px] text-[10.5px] font-semibold bg-[#E6EEE4] text-[#35513A]">
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-[#70786D]">
                          To: <strong className="text-[#33382F]">{log.recipient_name}</strong> ({log.recipient_email}) · {new Date(log.sent_at).toLocaleString()}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setInspectedLog(log)}
                        className="btn-secondary px-3 py-1.5 text-[12px] rounded-[6px] flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="motion-surface rounded-[12px] p-5 space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-[#F3EFE5] rounded-[9px] border border-[#DED8CB]">
                <div>
                  <div className="font-semibold text-[#33382F]">Automated Daily Digest</div>
                  <div className="text-[12px] text-[#70786D]">Send summary email automatically every day</div>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="rounded text-[#596D56] focus:ring-[#596D56] w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="scheduled-hour" className="block font-semibold text-[#33382F]">
                  Scheduled Time
                </label>
                <select
                  id="scheduled-hour"
                  value={scheduledHour}
                  onChange={(e) => setScheduledHour(parseInt(e.target.value, 10))}
                  className="w-full sm:w-64 text-[13px] motion-input rounded-[9px] p-2 cursor-pointer"
                >
                  <option value={7}>07:00 AM</option>
                  <option value={8}>08:00 AM (Workday Start)</option>
                  <option value={9}>09:00 AM</option>
                  <option value={10}>10:00 AM</option>
                  <option value={17}>05:00 PM</option>
                  <option value={18}>06:00 PM</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="recipient-email" className="block font-semibold text-[#33382F]">
                  Recipient Email Override
                </label>
                <input
                  id="recipient-email"
                  type="email"
                  value={recipientEmailOverride}
                  onChange={(e) => setRecipientEmailOverride(e.target.value)}
                  placeholder="team@company.com"
                  className="w-full text-[13px] motion-input rounded-[9px] p-2"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="lookahead-days" className="block font-semibold text-[#33382F]">
                  Upcoming Deadlines Window
                </label>
                <select
                  id="lookahead-days"
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(parseInt(e.target.value, 10))}
                  className="w-full sm:w-64 text-[13px] motion-input rounded-[9px] p-2 cursor-pointer"
                >
                  <option value={3}>Next 3 Days</option>
                  <option value={7}>Next 7 Days</option>
                  <option value={14}>Next 14 Days</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#EAE4D8] flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn-primary px-4 py-2 rounded-[9px] text-[12.5px] disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#EAE4D8] bg-[#FFFCF6] flex items-center justify-between text-[12px] text-[#70786D] shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#596D56]" />
            <span>Next scheduled: {workerStatus?.nextScheduled || 'Daily at 08:00 AM'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-3.5 py-1.5 rounded-[9px] text-[12px] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {inspectedLog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#33382F]/25 p-4">
          <div className="motion-modal rounded-[12px] max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#EAE4D8] bg-[#FFFCF6]">
              <div>
                <h3 className="text-[14px] font-semibold text-[#33382F] truncate">{inspectedLog.subject}</h3>
                <p className="text-[11.5px] text-[#70786D]">To: {inspectedLog.recipient_name} &lt;{inspectedLog.recipient_email}&gt;</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="text-[#70786D] hover:text-[#33382F] p-1 rounded-[6px] hover:bg-[#EDE7DA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2 bg-[#F7F4EC]">
              <iframe
                title="Sent Email Content"
                srcDoc={inspectedLog.html_content}
                className="w-full h-[460px] border border-[#DED8CB] bg-[#FFFCF6] rounded-[9px]"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
