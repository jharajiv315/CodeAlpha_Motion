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
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  Settings,
  Eye,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface DailyDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyDigestModal({ isOpen, onClose }: DailyDigestModalProps) {
  const { currentWorkspace, workspaceMembers } = useWorkspace();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'preview' | 'history' | 'settings'>('overview');
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Digest data
  const [preview, setPreview] = useState<DigestPreviewData | null>(null);
  const [history, setHistory] = useState<DigestLogItem[]>([]);
  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [workerStatus, setWorkerStatus] = useState<{ isRunning: boolean; nextScheduled: string } | null>(null);

  // Settings form
  const [isEnabled, setIsEnabled] = useState(true);
  const [scheduledHour, setScheduledHour] = useState(8);
  const [recipientEmailOverride, setRecipientEmailOverride] = useState('');
  const [daysAhead, setDaysAhead] = useState(7);
  const [savingSettings, setSavingSettings] = useState(false);

  // Inspect email modal
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
        text: res.message || `Daily digest dispatched successfully (${res.totalSent} sent).`,
        type: 'success',
      });
      // Refresh history & preview
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
        text: 'Daily digest schedule preferences saved successfully.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E7E9ED] max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E9ED] bg-[#F8F9FB] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#20242B] text-white flex items-center justify-center shadow-xs">
              <Mail className="w-4 h-4 text-[#A5B4FC]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#20242B]">Daily Digest &amp; Email Reports</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                  Background Task Active
                </span>
              </div>
              <p className="text-[11px] text-[#6D7480]">
                Automated daily email summaries of completed tasks &amp; upcoming deadlines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTriggerDigest()}
              disabled={triggering}
              className="px-3 py-1.5 bg-[#20242B] hover:bg-[#323842] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Execute daily digest background task now"
            >
              {triggering ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#A5B4FC]" />
              ) : (
                <Send className="w-3.5 h-3.5 text-[#A5B4FC]" />
              )}
              <span>{triggering ? 'Sending...' : 'Send Digest Now'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-[#9CA3AF] hover:text-[#20242B] p-1.5 rounded-lg hover:bg-[#EAECEF] transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 border-b border-[#E7E9ED] bg-white shrink-0">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'border-[#20242B] text-[#20242B] font-semibold'
                  : 'border-transparent text-[#6D7480] hover:text-[#20242B]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5965D8]" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'border-[#20242B] text-[#20242B] font-semibold'
                  : 'border-transparent text-[#6D7480] hover:text-[#20242B]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#5965D8]" />
              <span>Email Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-[#20242B] text-[#20242B] font-semibold'
                  : 'border-transparent text-[#6D7480] hover:text-[#20242B]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#5965D8]" />
              <span>Sent Outbox ({history.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'border-[#20242B] text-[#20242B] font-semibold'
                  : 'border-transparent text-[#6D7480] hover:text-[#20242B]'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-[#5965D8]" />
              <span>Schedule Settings</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="text-[11px] text-[#6D7480] hover:text-[#20242B] p-1 flex items-center gap-1 cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between shrink-0 ${
              feedbackMessage.type === 'success'
                ? 'bg-[#F0FDF4] text-[#15803D] border-b border-[#BBF7D0]'
                : 'bg-[#FEF2F2] text-[#991B1B] border-b border-[#FECACA]'
            }`}
          >
            <span className="font-medium">{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-xs hover:opacity-75 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8F9FB] space-y-5">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Status Header Card */}
              <div className="bg-white border border-[#E7E9ED] rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                      Schedule Configuration
                    </span>
                    <h3 className="text-sm font-bold text-[#20242B]">
                      Daily at {settings?.scheduled_hour?.toString().padStart(2, '0') || '08'}:00 AM
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6D7480]">
                      Target: <strong className="text-[#20242B]">{settings?.recipient_email_override || user?.email || 'Team Members'}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTriggerDigest(user?.id)}
                      disabled={triggering}
                      className="px-2.5 py-1 text-xs border border-[#CBD2FB] bg-[#EEF0FF] hover:bg-[#E0E4FF] text-[#434DB7] rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send To Me Now</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#F4F5F7]">
                  <div className="bg-[#F8F9FB] rounded-lg p-3 text-center border border-[#E7E9ED]/60">
                    <div className="text-2xl font-bold text-[#16A34A]">{preview?.completedTasks?.length ?? 0}</div>
                    <div className="text-[11px] font-medium text-[#6D7480] uppercase tracking-wider mt-0.5">
                      Completed Tasks
                    </div>
                  </div>

                  <div className="bg-[#F8F9FB] rounded-lg p-3 text-center border border-[#E7E9ED]/60">
                    <div className="text-2xl font-bold text-[#EA580C]">{preview?.upcomingTasks?.length ?? 0}</div>
                    <div className="text-[11px] font-medium text-[#6D7480] uppercase tracking-wider mt-0.5">
                      Upcoming Deadlines
                    </div>
                  </div>

                  <div className="bg-[#F8F9FB] rounded-lg p-3 text-center border border-[#E7E9ED]/60">
                    <div className="text-2xl font-bold text-[#DC2626]">{preview?.activeBlockers?.length ?? 0}</div>
                    <div className="text-[11px] font-medium text-[#6D7480] uppercase tracking-wider mt-0.5">
                      Active Blockers
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasks Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Completed Tasks Box */}
                <div className="bg-white border border-[#E7E9ED] rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F4F5F7]">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-[#20242B]">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                      <span>Completed Tasks ({preview?.completedTasks?.length || 0})</span>
                    </div>
                    <span className="text-[10px] text-[#9CA3AF]">Last 48 Hours</span>
                  </div>

                  {(!preview?.completedTasks || preview.completedTasks.length === 0) ? (
                    <p className="text-xs text-[#9CA3AF] italic py-4 text-center">
                      No tasks completed yet in this period.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {preview.completedTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-lg border border-[#BBF7D0]/50 bg-[#F0FDF4]/50 text-xs space-y-1"
                        >
                          <div className="font-semibold text-[#1E293B] flex items-center justify-between">
                            <span className="truncate">{t.title}</span>
                            <span className="text-[10px] font-mono bg-[#DCFCE7] text-[#15803D] px-1.5 py-0.5 rounded">
                              Done
                            </span>
                          </div>
                          <div className="text-[10px] text-[#64748B] flex items-center gap-2">
                            <span>Project: {t.project_name}</span>
                            <span>&bull;</span>
                            <span>Assignee: {t.assignees.join(', ') || 'Unassigned'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Deadlines Box */}
                <div className="bg-white border border-[#E7E9ED] rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F4F5F7]">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-[#20242B]">
                      <Clock className="w-4 h-4 text-[#EA580C]" />
                      <span>Upcoming Deadlines ({preview?.upcomingTasks?.length || 0})</span>
                    </div>
                    <span className="text-[10px] text-[#9CA3AF]">Next 7 Days</span>
                  </div>

                  {(!preview?.upcomingTasks || preview.upcomingTasks.length === 0) ? (
                    <p className="text-xs text-[#9CA3AF] italic py-4 text-center">
                      No deadlines pending in the next 7 days.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {preview.upcomingTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-lg border border-[#FED7AA]/50 bg-[#FFF7ED]/50 text-xs space-y-1"
                        >
                          <div className="font-semibold text-[#1E293B] flex items-center justify-between">
                            <span className="truncate">{t.title}</span>
                            <span className="text-[10px] font-semibold bg-[#FFEDD5] text-[#C2410C] px-1.5 py-0.5 rounded">
                              {t.urgency_label}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#64748B] flex items-center gap-2">
                            <span>Project: {t.project_name}</span>
                            <span>&bull;</span>
                            <span>Due: {t.due_date ? formatDate(t.due_date) : 'Soon'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Blockers Box */}
              {preview?.activeBlockers && preview.activeBlockers.length > 0 && (
                <div className="bg-[#FAF8F5] border border-[#EFE9DF] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#92400E]">
                    <AlertTriangle className="w-4 h-4 text-[#B97828]" />
                    <span>Active Blocker Radar Included in Digest ({preview.activeBlockers.length})</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {preview.activeBlockers.map((b) => (
                      <div key={b.id} className="bg-white p-2.5 rounded-lg border border-[#EFE9DF] text-[11px] space-y-0.5">
                        <div className="font-semibold text-[#78350F]">{b.task_title} ({b.project_name})</div>
                        <div className="text-[#92400E]">{b.reason}</div>
                        {b.waiting_on_name && (
                          <div className="text-[10px] text-[#B45309] font-medium">Waiting on: {b.waiting_on_name}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EMAIL PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#6D7480] bg-white p-3 rounded-xl border border-[#E7E9ED]">
                <div>
                  <span className="font-semibold text-[#20242B]">Subject:</span> {preview?.subject || 'MOTION Daily Digest'}
                </div>
                <div>
                  <span className="font-semibold text-[#20242B]">Recipient:</span> {settings?.recipient_email_override || user?.email}
                </div>
              </div>

              <div className="bg-white border border-[#E7E9ED] rounded-xl overflow-hidden shadow-xs">
                {preview?.html ? (
                  <iframe
                    title="Digest Email Preview"
                    srcDoc={preview.html}
                    className="w-full h-[520px] border-none bg-[#F8F9FA]"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-[#9CA3AF]">
                    No preview content generated.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SENT OUTBOX / HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#20242B] uppercase tracking-wider">
                  Sent Digest Delivery Logs
                </h3>
                <span className="text-[11px] text-[#6D7480]">
                  Showing last {history.length} dispatches
                </span>
              </div>

              {history.length === 0 ? (
                <div className="bg-white border border-dashed border-[#D1D5DB] rounded-xl p-8 text-center text-xs text-[#9CA3AF] space-y-2">
                  <Mail className="w-8 h-8 text-[#D1D5DB] mx-auto" />
                  <p className="font-medium">No digest emails dispatched yet.</p>
                  <p className="text-[11px]">Click &quot;Send Digest Now&quot; above to run your first scheduled summary.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white border border-[#E7E9ED] rounded-xl p-3.5 shadow-2xs hover:border-[#CBD2FB] transition-colors text-xs flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#20242B] truncate">{log.subject}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                            {log.status.toUpperCase()}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#F4F5F7] text-[#6D7480]">
                            {log.trigger_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6D7480] flex items-center gap-2">
                          <span>To: <strong>{log.recipient_name}</strong> ({log.recipient_email})</span>
                          <span>&bull;</span>
                          <span>{new Date(log.sent_at).toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-[#4B5563] flex items-center gap-3">
                          <span className="text-[#16A34A] font-medium">&#10003; {log.completed_count} completed</span>
                          <span className="text-[#EA580C] font-medium">&#9200; {log.upcoming_count} deadlines</span>
                          {log.blockers_count > 0 && (
                            <span className="text-[#DC2626] font-medium">&#9888; {log.blockers_count} blockers</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setInspectedLog(log)}
                        className="px-2.5 py-1 text-xs border border-[#E7E9ED] hover:bg-[#F8F9FB] rounded-lg text-[#20242B] font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5965D8]" />
                        <span>View HTML</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SCHEDULE SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="bg-white border border-[#E7E9ED] rounded-xl p-5 shadow-2xs space-y-4 text-xs">
              <div className="pb-3 border-b border-[#F4F5F7] space-y-0.5">
                <h3 className="text-xs font-bold text-[#20242B]">Daily Digest Schedule Preferences</h3>
                <p className="text-[11px] text-[#6D7480]">Configure when and to whom the background task sends daily updates</p>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3 bg-[#F8F9FB] rounded-lg border border-[#E7E9ED]">
                <div>
                  <div className="font-semibold text-[#20242B]">Automated Daily Schedule</div>
                  <div className="text-[11px] text-[#6D7480]">Send summary email automatically every day in the background</div>
                </div>
                <input
                  type="checkbox"
                  id="digest-enabled-toggle"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="rounded text-[#20242B] focus:ring-[#20242B] w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Scheduled Hour */}
              <div className="space-y-1">
                <label htmlFor="scheduled-hour" className="block font-medium text-[#20242B]">
                  Scheduled Time (Daily)
                </label>
                <select
                  id="scheduled-hour"
                  value={scheduledHour}
                  onChange={(e) => setScheduledHour(parseInt(e.target.value, 10))}
                  className="w-full sm:w-64 text-xs border border-[#E7E9ED] rounded-lg p-2 bg-white text-[#20242B]"
                >
                  <option value={7}>07:00 AM (Early Morning)</option>
                  <option value={8}>08:00 AM (Recommended - Workday Start)</option>
                  <option value={9}>09:00 AM (Morning Standup)</option>
                  <option value={10}>10:00 AM</option>
                  <option value={17}>05:00 PM (End of Day Review)</option>
                  <option value={18}>06:00 PM (Evening Wrap-up)</option>
                </select>
              </div>

              {/* Recipient Email Override */}
              <div className="space-y-1">
                <label htmlFor="recipient-email" className="block font-medium text-[#20242B]">
                  Recipient Email Destination
                </label>
                <input
                  id="recipient-email"
                  type="email"
                  value={recipientEmailOverride}
                  onChange={(e) => setRecipientEmailOverride(e.target.value)}
                  placeholder="jharajiv315@gmail.com"
                  className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
                />
                <p className="text-[11px] text-[#9CA3AF]">
                  Emails will be dispatched directly to this address. Defaults to individual member profile emails if blank.
                </p>
              </div>

              {/* Lookahead Days */}
              <div className="space-y-1">
                <label htmlFor="lookahead-days" className="block font-medium text-[#20242B]">
                  Upcoming Deadlines Window
                </label>
                <select
                  id="lookahead-days"
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(parseInt(e.target.value, 10))}
                  className="w-full sm:w-64 text-xs border border-[#E7E9ED] rounded-lg p-2 bg-white text-[#20242B]"
                >
                  <option value={3}>Next 3 Days</option>
                  <option value={7}>Next 7 Days (1 Week - Recommended)</option>
                  <option value={14}>Next 14 Days (2 Weeks)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#F4F5F7] flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 bg-[#20242B] hover:bg-[#323842] text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#E7E9ED] bg-white flex items-center justify-between text-xs text-[#6D7480] shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>Worker status: <strong>{workerStatus?.isRunning ? 'Running' : 'Active'}</strong></span>
            <span>&bull;</span>
            <span>Next run: {workerStatus?.nextScheduled || 'Daily at 08:00 AM'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#20242B] font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Nested Inspect Email Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E7E9ED] max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E9ED] bg-[#F8F9FB]">
              <div>
                <h3 className="text-xs font-bold text-[#20242B] truncate">{inspectedLog.subject}</h3>
                <p className="text-[10px] text-[#6D7480]">To: {inspectedLog.recipient_name} &lt;{inspectedLog.recipient_email}&gt;</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="text-[#9CA3AF] hover:text-[#20242B] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2 bg-[#F8F9FA]">
              <iframe
                title="Sent Email Content"
                srcDoc={inspectedLog.html_content}
                className="w-full h-[480px] border-none bg-white rounded-lg shadow-2xs"
                sandbox="allow-same-origin"
              />
            </div>
            <div className="px-5 py-2.5 border-t border-[#E7E9ED] bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="px-3 py-1 bg-[#20242B] text-white rounded-md text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
