import React, { useState, useEffect, useCallback } from 'react';
import type { TaskDetail, WorkspaceMember, PriorityLevel, BoardColumn, Task } from '../../types/index.ts';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import { api } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { BlockerModal } from '../blockers/BlockerModal.tsx';
import { ResolveBlockerModal } from '../blockers/ResolveBlockerModal.tsx';
import { DecisionModal } from '../decisions/DecisionModal.tsx';
import {
  formatDate,
  formatRelativeTime,
  getAvatarColor,
  getInitials,
  getBlockerAgeDays,
  removeEmojis,
} from '../../lib/utils.ts';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  MessageSquare,
  Clock,
  Send,
  Trash2,
  Calendar,
  Link2,
  Plus,
  Check,
  CornerDownRight,
} from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string | null;
  columns: BoardColumn[];
  members: WorkspaceMember[];
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export function TaskDetailModal({
  taskId,
  columns,
  members,
  isOpen,
  onClose,
  onTaskUpdated,
}: TaskDetailModalProps) {
  const { user } = useAuth();
  const { refreshKey } = useRealtime();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(taskId);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');

  // Dependencies state
  const [showAddDepForm, setShowAddDepForm] = useState(false);
  const [selectedDepId, setSelectedDepId] = useState('');
  const [addingDep, setAddingDep] = useState(false);
  const [depError, setDepError] = useState<string | null>(null);

  // Time Tracking & Effort state
  const [showLogTimeForm, setShowLogTimeForm] = useState(false);
  const [timeLogHours, setTimeLogHours] = useState('1.0');
  const [timeLogDesc, setTimeLogDesc] = useState('');
  const [timeLogDate, setTimeLogDate] = useState(new Date().toISOString().substring(0, 10));
  const [loggingTime, setLoggingTime] = useState(false);
  const [estimateInput, setEstimateInput] = useState('');
  const [savingEstimate, setSavingEstimate] = useState(false);

  // Sub-modals
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionPrefill, setDecisionPrefill] = useState<{ summary?: string; sourceCommentId?: string }>({});

  useEffect(() => {
    setActiveTaskId(taskId);
    setShowAddDepForm(false);
    setSelectedDepId('');
    setDepError(null);
    setShowLogTimeForm(false);
    setTimeLogHours('1.0');
    setTimeLogDesc('');
  }, [taskId]);

  const loadTask = useCallback(async () => {
    if (!activeTaskId) return;
    setLoading(true);
    try {
      const res = await api.tasks.get(activeTaskId);
      setTask(res.task);
      setEstimateInput(
        res.task.estimated_hours !== null && res.task.estimated_hours !== undefined
          ? String(res.task.estimated_hours)
          : ''
      );
      if (res.task.project_id) {
        api.tasks.listByProject(res.task.project_id).then((pRes) => {
          setProjectTasks(pRes.tasks);
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTaskId]);

  useEffect(() => {
    if (isOpen && activeTaskId) {
      loadTask();
    }
  }, [isOpen, activeTaskId, loadTask, refreshKey]);

  if (!isOpen || !activeTaskId) return null;

  const handleTitleChange = async (newTitle: string) => {
    const cleanTitle = removeEmojis(newTitle);
    if (!task || !cleanTitle || cleanTitle === task.title) return;
    try {
      await api.tasks.update(task.id, { title: cleanTitle });
      setTask((prev) => (prev ? { ...prev, title: cleanTitle } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const handleColumnChange = async (colId: string) => {
    if (!task || colId === task.column_id) return;
    try {
      await api.tasks.move(task.id, colId, 0);
      setTask((prev) => (prev ? { ...prev, column_id: colId } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to change column:', err);
    }
  };

  const handlePriorityChange = async (priority: PriorityLevel) => {
    if (!task) return;
    try {
      await api.tasks.update(task.id, { priority });
      setTask((prev) => (prev ? { ...prev, priority } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleDueDateChange = async (dueDate: string) => {
    if (!task) return;
    try {
      await api.tasks.update(task.id, { dueDate: dueDate ? new Date(dueDate).toISOString() : null });
      setTask((prev) => (prev ? { ...prev, due_date: dueDate ? new Date(dueDate).toISOString() : null } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update due date:', err);
    }
  };

  const handleDescriptionBlur = async (desc: string) => {
    const cleanDesc = removeEmojis(desc);
    if (!task || cleanDesc === task.description) return;
    try {
      await api.tasks.update(task.id, { description: cleanDesc });
      setTask((prev) => (prev ? { ...prev, description: cleanDesc } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update description:', err);
    }
  };

  const handleAssigneeToggle = async (userId: string) => {
    if (!task) return;
    const currentIds = task.assignees.map((a) => a.user_id);
    const newIds = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId];

    try {
      const res = await api.tasks.updateAssignees(task.id, newIds);
      setTask((prev) => (prev ? { ...prev, assignees: res.assignees } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update assignees:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanComment = removeEmojis(commentText);
    if (!task || !cleanComment) return;
    setSubmittingComment(true);
    try {
      const res = await api.comments.add(task.id, cleanComment);
      setTask((prev) => (prev ? { ...prev, comments: [...prev.comments, res.comment] } : null));
      setCommentText('');
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!task) return;
    try {
      await api.comments.delete(commentId);
      setTask((prev) => (prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handlePromoteCommentToDecision = (comment: { id: string; body: string }) => {
    setDecisionPrefill({
      summary: comment.body,
      sourceCommentId: comment.id,
    });
    setIsDecisionModalOpen(true);
  };

  const handleDeleteDecision = async (decisionId: string) => {
    try {
      await api.decisions.delete(decisionId);
      setTask((prev) => (prev ? { ...prev, decisions: prev.decisions.filter((d) => d.id !== decisionId) } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to delete decision:', err);
    }
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !selectedDepId) return;
    setAddingDep(true);
    setDepError(null);
    try {
      await api.tasks.addDependency(task.id, selectedDepId);
      setSelectedDepId('');
      setShowAddDepForm(false);
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      setDepError(err.message || 'Failed to add dependency');
    } finally {
      setAddingDep(false);
    }
  };

  const handleRemoveDependency = async (depTaskId: string) => {
    if (!task) return;
    try {
      await api.tasks.removeDependency(task.id, depTaskId);
      await loadTask();
      onTaskUpdated?.();
    } catch (err: any) {
      console.error('Failed to remove dependency:', err);
    }
  };

  const handleJumpToTask = (targetId: string) => {
    setActiveTaskId(targetId);
  };

  const handleSaveEstimate = async (newVal?: string) => {
    const valToSave = newVal !== undefined ? newVal : estimateInput;
    if (!task) return;
    const estNum = valToSave.trim() === '' ? null : parseFloat(valToSave);
    if (estNum !== null && (isNaN(estNum) || estNum < 0)) return;

    setSavingEstimate(true);
    try {
      await api.tasks.update(task.id, { estimatedHours: estNum });
      setTask((prev) => (prev ? { ...prev, estimated_hours: estNum } : null));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update estimate:', err);
    } finally {
      setSavingEstimate(false);
    }
  };

  const handleCreateTimeLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    const hrs = parseFloat(timeLogHours);
    if (isNaN(hrs) || hrs <= 0) return;

    setLoggingTime(true);
    try {
      const res = await api.tasks.logTime(task.id, {
        hours: hrs,
        description: removeEmojis(timeLogDesc).trim() || undefined,
        loggedAt: timeLogDate ? new Date(timeLogDate).toISOString() : undefined,
      });

      setTask((prev) =>
        prev
          ? {
              ...prev,
              time_spent_hours: res.task.time_spent_hours,
              timeLogs: [res.timeLog, ...(prev.timeLogs || [])],
            }
          : null
      );
      setTimeLogHours('1.0');
      setTimeLogDesc('');
      setShowLogTimeForm(false);
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to log time:', err);
    } finally {
      setLoggingTime(false);
    }
  };

  const handleDeleteTimeLog = async (logId: string) => {
    if (!task) return;
    try {
      const res = await api.tasks.deleteTimeLog(task.id, logId);
      setTask((prev) =>
        prev
          ? {
              ...prev,
              time_spent_hours: res.task.time_spent_hours,
              timeLogs: (prev.timeLogs || []).filter((l) => l.id !== logId),
            }
          : null
      );
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to delete time log:', err);
    }
  };

  const existingDepIds = new Set((task?.dependencies || []).map((d) => d.depends_on_task_id));
  const eligibleTasks = projectTasks.filter(
    (t) => t.id !== task?.id && !existingDepIds.has(t.id)
  );

  const timeSpent = Math.round(Number(task?.time_spent_hours || 0) * 10) / 10;
  const estimated = task?.estimated_hours !== null && task?.estimated_hours !== undefined ? Number(task.estimated_hours) : null;
  const hasEstimate = estimated !== null && estimated > 0;
  const percentSpent = hasEstimate ? Math.round((timeSpent / estimated!) * 100) : 0;
  const isOver = hasEstimate && timeSpent > estimated!;
  const isNear = hasEstimate && !isOver && percentSpent >= 80;
  const overAmount = isOver ? (timeSpent - estimated!).toFixed(1) : null;
  const remainingAmount = hasEstimate && !isOver ? (estimated! - timeSpent).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:justify-end bg-black/25 backdrop-blur-2xs">
      <div className="bg-white w-full max-w-xl h-full max-h-screen flex flex-col border-l border-[#E7E9ED] shadow-xl overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#E7E9ED] bg-[#F8F9FB] shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#6D7480]">
            <span>{task?.project_name || 'Project'}</span>
            <span>/</span>
            <span className="text-[#20242B] font-medium">{task?.column_name || 'Task'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#20242B] p-1 rounded-md transition-colors"
            aria-label="Close task details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && !task ? (
          <div className="flex-1 flex items-center justify-center p-8 text-[#6D7480] text-xs">
            Loading task...
          </div>
        ) : task ? (
          <div className="flex-1 overflow-y-auto divide-y divide-[#F4F5F7]">
            {/* Blocker Banner (if blocked) */}
            {task.is_blocked && task.activeBlocker ? (
              <div className="p-4 bg-[#FAF8F5] border-b border-[#EFE9DF] flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold text-[#92400E]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B97828]" />
                    <span>Operational Blocker</span>
                    <span className="text-[10px] text-[#78350F] font-mono" data-tabular-nums="true">
                      · {getBlockerAgeDays(task.activeBlocker.created_at)}
                    </span>
                  </div>
                  <p className="text-[#78350F] leading-relaxed">
                    {task.activeBlocker.reason}
                  </p>
                  {task.activeBlocker.waiting_on_name && (
                    <p className="text-[11px] text-[#92400E]">
                      Waiting on <span className="font-semibold">{task.activeBlocker.waiting_on_name}</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(true)}
                  className="px-2.5 py-1 text-xs bg-[#238565] hover:bg-[#1E7357] text-white font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resolve</span>
                </button>
              </div>
            ) : null}

            {/* Title & Metadata */}
            <div className="p-6 space-y-4">
              <input
                type="text"
                defaultValue={task.title}
                onBlur={(e) => handleTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="w-full text-base font-bold text-[#20242B] border-none p-0 focus:outline-hidden focus:ring-0 hover:bg-[#F8F9FB] rounded px-1 -mx-1 transition-colors"
                title="Click to edit task title"
              />

              {/* Status Row */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                {/* Column */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9CA3AF]">Status:</span>
                  <select
                    value={task.column_id}
                    onChange={(e) => handleColumnChange(e.target.value)}
                    className="bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#20242B] font-medium rounded-md px-2 py-1 border-none cursor-pointer text-xs"
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9CA3AF]">Priority:</span>
                  <select
                    value={task.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                    className="bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#20242B] font-medium rounded-md px-2 py-1 border-none cursor-pointer text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9CA3AF]">Due:</span>
                  <input
                    type="date"
                    defaultValue={task.due_date ? task.due_date.substring(0, 10) : ''}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    className="bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#20242B] font-medium rounded-md px-2 py-1 border-none cursor-pointer text-xs"
                  />
                </div>

                {/* Estimate */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9CA3AF]">Estimate:</span>
                  <div className="flex items-center bg-[#F4F5F7] hover:bg-[#EAECEF] rounded-md px-2 py-1 text-xs">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={estimateInput}
                      onChange={(e) => setEstimateInput(e.target.value)}
                      onBlur={() => handleSaveEstimate()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEstimate();
                        }
                      }}
                      placeholder="0.0"
                      className="w-12 bg-transparent text-[#20242B] font-mono font-medium border-none focus:outline-hidden p-0 text-xs"
                      title="Estimated effort in hours (auto-saves on blur)"
                    />
                    <span className="text-[#9CA3AF] text-[10px] ml-0.5">hrs</span>
                    {savingEstimate && (
                      <span className="text-[9px] text-[#5965D8] ml-1">...</span>
                    )}
                  </div>
                </div>

                {/* Mark Blocked button if not currently blocked */}
                {!task.is_blocked && (
                  <button
                    type="button"
                    onClick={() => setIsBlockerModalOpen(true)}
                    className="px-2 py-1 text-xs text-[#B97828] hover:bg-[#FAF8F5] rounded-md transition-colors flex items-center gap-1 border border-[#EFE9DF]"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Mark Blocked</span>
                  </button>
                )}
              </div>

              {/* Assignees */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-[#6D7480]">Assignees</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {members.map((m) => {
                    const isAssigned = task.assignees.some((a) => a.user_id === m.user_id);
                    return (
                      <button
                        type="button"
                        key={m.user_id}
                        onClick={() => handleAssigneeToggle(m.user_id)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isAssigned
                            ? 'bg-[#20242B] text-white border-[#20242B]'
                            : 'bg-white text-[#6D7480] border-[#E7E9ED] hover:border-[#D1D5DB]'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                            isAssigned ? 'bg-[#374151] text-white' : getAvatarColor(m.name)
                          }`}
                        >
                          {getInitials(m.name)}
                        </span>
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-medium text-[#6D7480]">Description</span>
                <textarea
                  defaultValue={task.description}
                  onBlur={(e) => handleDescriptionBlur(e.target.value)}
                  placeholder="Add notes, specifications, or context..."
                  rows={3}
                  className="w-full text-xs text-[#20242B] border border-[#E7E9ED] rounded-lg p-2.5 focus:outline-hidden focus:border-[#5965D8] placeholder-[#9CA3AF] resize-none transition-colors"
                />
              </div>
            </div>

            {/* Effort & Time Tracking Section (Estimated vs Actual Effort) */}
            <div className="p-6 space-y-4 bg-white border-t border-[#E7E9ED]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#EEF0FF] flex items-center justify-center text-[#5965D8]">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#20242B]">
                      Effort &amp; Time Tracking
                    </h3>
                    <p className="text-[11px] text-[#6D7480]">
                      Track estimated vs actual effort and log team hours
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLogTimeForm((prev) => !prev)}
                  className="px-2.5 py-1 text-xs bg-[#5965D8] hover:bg-[#434DB7] text-white rounded-lg transition-colors flex items-center gap-1 font-medium cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showLogTimeForm ? 'Cancel' : 'Log Time'}</span>
                </button>
              </div>

              {/* 3 Metric Cards for Variance Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* 1. Actual Time Spent */}
                <div className="p-3 rounded-xl border border-[#E7E9ED] bg-[#F8FAFC]">
                  <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">
                    Actual Time Spent
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold font-mono text-[#1E293B]">{timeSpent}</span>
                    <span className="text-[11px] text-[#64748B]">hrs</span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] block mt-0.5">
                    {task.timeLogs && task.timeLogs.length > 0
                      ? `${task.timeLogs.length} logged ${task.timeLogs.length === 1 ? 'entry' : 'entries'}`
                      : 'No work logged yet'}
                  </span>
                </div>

                {/* 2. Estimated Effort */}
                <div className="p-3 rounded-xl border border-[#E7E9ED] bg-[#F8FAFC]">
                  <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">
                    Estimated Effort
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold font-mono text-[#1E293B]">
                      {hasEstimate ? estimated : '—'}
                    </span>
                    <span className="text-[11px] text-[#64748B]">hrs</span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] block mt-0.5">
                    {hasEstimate ? 'Target effort plan' : 'No estimate defined'}
                  </span>
                </div>

                {/* 3. Variance & Status */}
                <div
                  className={`p-3 rounded-xl border ${
                    isOver
                      ? 'bg-[#FEF2F2] border-[#FECACA]'
                      : isNear
                      ? 'bg-[#FFFBEB] border-[#FDE68A]'
                      : hasEstimate
                      ? 'bg-[#F0FDF4] border-[#BBF7D0]'
                      : 'bg-[#F8FAFC] border-[#E7E9ED]'
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase font-semibold tracking-wider block ${
                      isOver
                        ? 'text-[#DC2626]'
                        : isNear
                        ? 'text-[#D97706]'
                        : hasEstimate
                        ? 'text-[#15803D]'
                        : 'text-[#64748B]'
                    }`}
                  >
                    Variance Status
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    {isOver ? (
                      <span className="text-sm font-bold font-mono text-[#DC2626]">
                        +{overAmount} hrs over
                      </span>
                    ) : hasEstimate ? (
                      <span className="text-sm font-bold font-mono text-[#15803D]">
                        {remainingAmount} hrs left
                      </span>
                    ) : (
                      <span className="text-xs text-[#94A3B8] italic">Unestimated</span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] block mt-0.5 ${
                      isOver
                        ? 'text-[#991B1B]'
                        : isNear
                        ? 'text-[#92400E]'
                        : hasEstimate
                        ? 'text-[#166534]'
                        : 'text-[#94A3B8]'
                    }`}
                  >
                    {hasEstimate ? `${percentSpent}% of estimate used` : 'Set estimate above'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {hasEstimate && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Effort Consumed</span>
                    <span className="font-mono font-semibold text-[#1E293B]">
                      {timeSpent}h / {estimated}h ({percentSpent}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isOver ? 'bg-[#DC2626]' : isNear ? 'bg-[#D97706]' : 'bg-[#5965D8]'
                      }`}
                      style={{ width: `${Math.min(percentSpent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Manual Entry Logger Form */}
              {showLogTimeForm && (
                <form
                  onSubmit={handleCreateTimeLog}
                  className="p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl space-y-3 text-xs shadow-2xs animate-in fade-in"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
                    <span className="font-semibold text-[#1E293B] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#5965D8]" />
                      <span>Log Work Effort</span>
                    </span>
                    <span className="text-[10px] text-[#64748B]">
                      Logged under your user profile
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                      Quick Add
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '+15m', val: '0.25' },
                        { label: '+30m', val: '0.5' },
                        { label: '+1h', val: '1.0' },
                        { label: '+2h', val: '2.0' },
                        { label: '+4h', val: '4.0' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setTimeLogHours(preset.val)}
                          className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors cursor-pointer ${
                            timeLogHours === preset.val
                              ? 'bg-[#5965D8] text-white border-[#5965D8]'
                              : 'bg-white hover:bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Hours input */}
                    <div>
                      <label htmlFor="log-hours-input" className="block text-[11px] font-semibold text-[#20242B] mb-1">
                        Time Spent (Hours) *
                      </label>
                      <div className="relative">
                        <input
                          id="log-hours-input"
                          type="number"
                          step="0.25"
                          min="0.1"
                          max="100"
                          required
                          value={timeLogHours}
                          onChange={(e) => setTimeLogHours(e.target.value)}
                          placeholder="e.g. 1.5"
                          className="w-full text-xs font-mono border border-[#CBD5E1] rounded-lg p-2 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
                        />
                        <span className="absolute right-2.5 top-2 text-[11px] text-[#94A3B8]">
                          hrs
                        </span>
                      </div>
                    </div>

                    {/* Date worked */}
                    <div>
                      <label htmlFor="log-date-input" className="block text-[11px] font-semibold text-[#20242B] mb-1">
                        Date Worked
                      </label>
                      <input
                        id="log-date-input"
                        type="date"
                        value={timeLogDate}
                        onChange={(e) => setTimeLogDate(e.target.value)}
                        className="w-full text-xs border border-[#CBD5E1] rounded-lg p-2 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
                      />
                    </div>
                  </div>

                  {/* Work Description note */}
                  <div>
                    <label htmlFor="log-desc-input" className="block text-[11px] font-semibold text-[#20242B] mb-1">
                      Description / Work Note <span className="font-normal text-[#94A3B8]">(Optional)</span>
                    </label>
                    <input
                      id="log-desc-input"
                      type="text"
                      value={timeLogDesc}
                      onChange={(e) => setTimeLogDesc(e.target.value)}
                      placeholder="e.g. Investigated auth token expiration, implemented tests"
                      className="w-full text-xs border border-[#CBD5E1] rounded-lg p-2 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8] placeholder-[#94A3B8]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowLogTimeForm(false)}
                      className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#1E293B] rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loggingTime || !timeLogHours || parseFloat(timeLogHours) <= 0}
                      className="px-3.5 py-1.5 text-xs bg-[#5965D8] hover:bg-[#434DB7] text-white font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{loggingTime ? 'Saving...' : 'Add Worklog'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Logged Work History List */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Logged Work History ({task.timeLogs?.length || 0})
                </span>

                {!task.timeLogs || task.timeLogs.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-[#E7E9ED] rounded-xl text-xs text-[#9CA3AF] bg-[#FAF8F5]/50">
                    No effort logged yet on this task. Click &quot;Log Time&quot; to record hours.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {task.timeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-lg border border-[#E7E9ED] bg-[#F8FAFC] flex items-center justify-between gap-3 text-xs hover:border-[#CBD5E1] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* User Avatar */}
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(
                              log.user_name
                            )}`}
                            title={log.user_name}
                          >
                            {getInitials(log.user_name)}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#1E293B] truncate">
                                {log.user_name}
                              </span>
                              <span className="text-[10px] text-[#94A3B8]">·</span>
                              <span className="text-[10px] text-[#94A3B8]">
                                {formatDate(log.logged_at)}
                              </span>
                            </div>
                            {log.description ? (
                              <p className="text-[11px] text-[#475569] truncate mt-0.5">
                                {log.description}
                              </p>
                            ) : (
                              <p className="text-[10px] text-[#94A3B8] italic mt-0.5">
                                No note provided
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 font-mono font-bold text-xs bg-white border border-[#CBD5E1] rounded-md text-[#1E293B]">
                            {log.hours}h
                          </span>

                          <button
                            type="button"
                            onClick={() => handleDeleteTimeLog(log.id)}
                            className="p-1 text-[#94A3B8] hover:text-[#DC2626] rounded transition-colors cursor-pointer"
                            title="Delete this worklog"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Task Dependencies & Blocked Links Section */}
            <div className="p-6 space-y-3 bg-[#FAF8F5]/80 border-t border-[#E7E9ED]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span className="text-xs font-semibold text-[#20242B]">
                    Task Dependencies ({task.dependencies?.length || 0})
                  </span>
                  {task.dependencies && task.dependencies.some((d) => !d.is_completed) && (
                    <span className="text-[10px] font-medium bg-[#FFEDD5] text-[#C2410C] px-1.5 py-0.5 rounded border border-[#FED7AA]">
                      Blocked
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDepForm((prev) => !prev);
                    setDepError(null);
                  }}
                  className="px-2 py-1 text-xs text-[#EA580C] hover:bg-[#FFF7ED] rounded-md transition-colors flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showAddDepForm ? 'Cancel' : 'Add Prerequisite'}</span>
                </button>
              </div>

              <p className="text-[11px] text-[#78350F]">
                Define tasks that must be finished before this task can proceed, or view downstream tasks waiting on this task.
              </p>

              {/* Add Dependency Form */}
              {showAddDepForm && (
                <form
                  onSubmit={handleAddDependency}
                  className="p-3 bg-white border border-[#FED7AA] rounded-lg space-y-2 text-xs shadow-2xs animate-in fade-in"
                >
                  <label htmlFor="dep-select-task" className="block text-[11px] font-semibold text-[#20242B]">
                    Select Prerequisite Task
                  </label>
                  {eligibleTasks.length === 0 ? (
                    <p className="text-[11px] text-[#9CA3AF] italic">
                      No other available tasks in this project to link.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        id="dep-select-task"
                        value={selectedDepId}
                        onChange={(e) => setSelectedDepId(e.target.value)}
                        className="flex-1 text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
                        required
                      >
                        <option value="">-- Choose a prerequisite task --</option>
                        {eligibleTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.priority} priority)
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={addingDep || !selectedDepId}
                        className="px-3 py-2 bg-[#20242B] hover:bg-[#323842] text-white rounded-lg font-medium transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {addingDep ? 'Linking...' : 'Link Task'}
                      </button>
                    </div>
                  )}

                  {depError && (
                    <div className="p-2 text-[11px] bg-[#FEE2E2] text-[#991B1B] rounded-md flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{depError}</span>
                    </div>
                  )}
                </form>
              )}

              {/* Prerequisites List (Blocked by) */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#6D7480] uppercase tracking-wider">
                  Prerequisites (Must be completed first)
                </span>

                {(!task.dependencies || task.dependencies.length === 0) ? (
                  <p className="text-xs text-[#9CA3AF] italic bg-white/60 p-2.5 rounded-lg border border-dashed border-[#E7E9ED]">
                    No prerequisites defined. This task can proceed independently.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {task.dependencies.map((dep) => (
                      <div
                        key={dep.id}
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs transition-colors ${
                          dep.is_completed
                            ? 'bg-[#F0FDF4] border-[#BBF7D0]'
                            : 'bg-white border-[#FED7AA]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {dep.is_completed ? (
                            <span
                              className="text-[#16A34A] shrink-0"
                              title="Completed prerequisite"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span
                              className="text-[#EA580C] shrink-0"
                              title="Incomplete prerequisite - blocking this task"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleJumpToTask(dep.depends_on_task_id)}
                            className="font-medium text-[#20242B] hover:underline truncate text-left cursor-pointer"
                            title={`Jump to prerequisite task: ${dep.depends_on_title}`}
                          >
                            {dep.depends_on_title}
                          </button>

                          {dep.depends_on_priority && (
                            <PriorityBadge priority={dep.depends_on_priority} showLabel={false} />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              dep.is_completed
                                ? 'bg-[#DCFCE7] text-[#15803D]'
                                : 'bg-[#FFEDD5] text-[#C2410C]'
                            }`}
                          >
                            {dep.is_completed ? 'Done' : dep.depends_on_column_name || 'Pending'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveDependency(dep.depends_on_task_id)}
                            className="text-[#9CA3AF] hover:text-[#C54D4D] p-1 rounded hover:bg-white transition-colors cursor-pointer"
                            title="Remove dependency"
                            aria-label={`Remove dependency on ${dep.depends_on_title}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Downstream Tasks List (Blocking downstream) */}
              {task.blocking && task.blocking.length > 0 && (
                <div className="pt-2 border-t border-[#E7E9ED]/60 space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#6D7480] uppercase tracking-wider flex items-center gap-1">
                    <CornerDownRight className="w-3 h-3 text-[#C2410C]" />
                    <span>Downstream Tasks ({task.blocking.length})</span>
                    <span className="text-[10px] text-[#9CA3AF] font-normal lowercase">
                      · {task.completed_at ? 'prerequisite satisfied' : 'waiting for this task to finish'}
                    </span>
                  </span>

                  <div className="space-y-1.5">
                    {task.blocking.map((blocked) => (
                      <div
                        key={blocked.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-[#E7E9ED] text-xs hover:border-[#CBD2FB] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              blocked.is_completed ? 'bg-[#16A34A]' : 'bg-[#EA580C]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleJumpToTask(blocked.task_id)}
                            className="font-medium text-[#20242B] hover:underline truncate text-left cursor-pointer"
                            title={`Jump to blocked task: ${blocked.blocked_task_title}`}
                          >
                            {blocked.blocked_task_title}
                          </button>
                          {blocked.blocked_task_priority && (
                            <PriorityBadge priority={blocked.blocked_task_priority} showLabel={false} />
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-[#6D7480] bg-[#F4F5F7] px-1.5 py-0.5 rounded shrink-0">
                          {blocked.blocked_task_column_name || 'In Progress'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Decision Notes Section (Flagship USP 2) */}
            <div className="p-6 space-y-3 bg-[#F8F9FB]/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-[#5965D8]" />
                  <span className="text-xs font-semibold text-[#20242B]">
                    Decision Notes ({task.decisions.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionPrefill({});
                    setIsDecisionModalOpen(true);
                  }}
                  className="px-2 py-1 text-xs text-[#5965D8] hover:bg-[#EEF0FF] rounded-md transition-colors flex items-center gap-1 font-medium cursor-pointer"
                >
                  <FileCheck className="w-3 h-3" />
                  <span>Record Decision</span>
                </button>
              </div>

              {task.decisions.length === 0 ? (
                <p className="text-xs text-[#9CA3AF] italic">
                  No decisions recorded yet. Agreements in comments can be converted into decisions.
                </p>
              ) : (
                <div className="space-y-2">
                  {task.decisions.map((dec) => (
                    <div
                      key={dec.id}
                      className="bg-white border border-[#E7E9ED] rounded-lg p-3 space-y-1 text-xs shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[#20242B]">{dec.title}</p>
                        {user?.id === dec.author_id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDecision(dec.id)}
                            className="text-[#9CA3AF] hover:text-[#C54D4D] p-0.5"
                            title="Delete decision note"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[#20242B]">{dec.summary}</p>
                      {dec.rationale && (
                        <p className="text-[11px] text-[#6D7480]">
                          <span className="font-medium text-[#9CA3AF]">Rationale: </span>
                          {dec.rationale}
                        </p>
                      )}
                      <div className="text-[10px] text-[#9CA3AF] pt-0.5">
                        By {dec.author_name} · {formatRelativeTime(dec.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discussion & Activity Tabs */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 border-b border-[#E7E9ED] pb-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`font-semibold pb-1.5 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'comments'
                      ? 'text-[#20242B] border-b-2 border-[#20242B]'
                      : 'text-[#6D7480] hover:text-[#20242B]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discussion ({task.comments.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`font-semibold pb-1.5 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'activity'
                      ? 'text-[#20242B] border-b-2 border-[#20242B]'
                      : 'text-[#6D7480] hover:text-[#20242B]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Activity ({task.activity.length})</span>
                </button>
              </div>

              {activeTab === 'comments' ? (
                <div className="space-y-3">
                  {task.comments.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF] italic">
                      No comments yet. Share an update below.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {task.comments.map((cmt) => (
                        <div
                          key={cmt.id}
                          className="bg-white border border-[#E7E9ED] rounded-lg p-3 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(
                                  cmt.author_name
                                )}`}
                              >
                                {getInitials(cmt.author_name)}
                              </span>
                              <span className="font-semibold text-[#20242B]">
                                {cmt.author_name}
                              </span>
                              <span className="text-[10px] text-[#9CA3AF]">
                                {formatRelativeTime(cmt.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handlePromoteCommentToDecision(cmt)}
                                className="text-[10px] text-[#5965D8] hover:underline flex items-center gap-0.5"
                                title="Convert to Decision Note"
                              >
                                <FileCheck className="w-2.5 h-2.5" />
                                <span>Convert to Decision</span>
                              </button>
                              {user?.id === cmt.author_id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(cmt.id)}
                                  className="text-[#9CA3AF] hover:text-[#C54D4D] p-0.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-[#20242B] whitespace-pre-wrap pl-5.5 leading-relaxed">
                            {cmt.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment Input */}
                  <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 text-xs border border-[#E7E9ED] rounded-lg px-3 py-2 text-[#20242B] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#5965D8]"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !commentText.trim()}
                      className="px-3 py-2 text-xs bg-[#20242B] hover:bg-[#323842] disabled:opacity-40 text-white font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              ) : (
                /* Activity Log */
                <div className="space-y-1.5 text-xs text-[#6D7480]">
                  {task.activity.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-2 py-1 border-b border-[#F4F5F7] last:border-none"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-[#20242B]">{act.user_name} </span>
                        <span>
                          {act.action_type === 'task_created' && 'created this task'}
                          {act.action_type === 'status_changed' && 'updated status'}
                          {act.action_type === 'task_blocked' && 'marked this task as blocked'}
                          {act.action_type === 'blocker_resolved' && 'resolved the blocker'}
                          {act.action_type === 'decision_recorded' && 'recorded a decision note'}
                          {act.action_type === 'task_assigned' && 'updated assignees'}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF] ml-2">
                          {formatRelativeTime(act.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Blocker Modal */}
        {task && (
          <BlockerModal
            taskId={task.id}
            taskTitle={task.title}
            members={members}
            isOpen={isBlockerModalOpen}
            onClose={() => setIsBlockerModalOpen(false)}
            onSuccess={() => {
              loadTask();
              onTaskUpdated?.();
            }}
          />
        )}

        {/* Resolve Blocker Modal */}
        {task && (
          <ResolveBlockerModal
            taskId={task.id}
            taskTitle={task.title}
            blockerReason={task.activeBlocker?.reason}
            isOpen={isResolveModalOpen}
            onClose={() => setIsResolveModalOpen(false)}
            onSuccess={() => {
              loadTask();
              onTaskUpdated?.();
            }}
          />
        )}

        {/* Decision Modal */}
        {task && (
          <DecisionModal
            taskId={task.id}
            taskTitle={task.title}
            defaultSummary={decisionPrefill.summary}
            sourceCommentId={decisionPrefill.sourceCommentId}
            isOpen={isDecisionModalOpen}
            onClose={() => {
              setIsDecisionModalOpen(false);
              setDecisionPrefill({});
            }}
            onSuccess={() => {
              loadTask();
              onTaskUpdated?.();
            }}
          />
        )}
      </div>
    </div>
  );
}
