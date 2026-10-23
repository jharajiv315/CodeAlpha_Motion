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
  Link2,
  Plus,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:justify-end bg-[#33382F]/20 animate-in fade-in duration-150">
      <div className="bg-[#FFFDF9] w-full md:w-[min(600px,48vw)] h-full max-h-screen flex flex-col border-l border-[#DED8CB] shadow-xl overflow-hidden">
        {/* 1. Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#FFFCF6] shrink-0">
          <div className="flex items-center gap-2 text-[12px] text-[#70786D] font-medium">
            <span>{task?.project_name || 'Project'}</span>
            <span>/</span>
            <span className="text-[#33382F] font-semibold bg-[#F3EFE5] border border-[#DED8CB] px-2 py-0.5 rounded-[6px]">
              {task?.column_name || 'Task'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#70786D] hover:text-[#33382F] p-1.5 rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
            aria-label="Close task details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && !task ? (
          <div className="flex-1 flex items-center justify-center p-8 text-[#70786D] text-[13px]">
            Loading task...
          </div>
        ) : task ? (
          <div className="flex-1 overflow-y-auto divide-y divide-[#EAE4D8]">
            {/* 4. Blocker Callout (if active) */}
            {task.is_blocked && task.activeBlocker ? (
              <div className="p-4 bg-[#F3E7DD] border-b border-[#DFC2B0] flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-semibold text-[#7B4B3A] text-[13px]">
                    <AlertTriangle className="w-4 h-4 text-[#A46F5C]" />
                    <span>Blocked</span>
                    <span className="text-[11.5px] text-[#7B4B3A]/80" data-tabular-nums="true">
                      · {getBlockerAgeDays(task.activeBlocker.created_at)}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#33382F] leading-relaxed">
                    {task.activeBlocker.reason}
                  </p>
                  {task.activeBlocker.waiting_on_name && (
                    <p className="text-[12px] text-[#7B4B3A]">
                      Waiting on <strong className="font-semibold">{task.activeBlocker.waiting_on_name}</strong>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(true)}
                  className="btn-primary px-3 py-1.5 text-[12.5px] rounded-[9px] flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resolve</span>
                </button>
              </div>
            ) : null}

            {/* 2. Title & Context Metadata */}
            <div className="p-6 space-y-4">
              <input
                type="text"
                defaultValue={task.title}
                onBlur={(e) => handleTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="w-full text-[20px] font-bold tracking-[-0.015em] text-[#33382F] bg-transparent border border-transparent focus:border-[#596D56] hover:bg-[#F3EFE5]/60 rounded-[9px] px-2 py-1 -mx-2 focus:outline-hidden transition-colors leading-snug"
                title="Click to edit task title"
              />

              {/* Context Metadata Row */}
              <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
                {/* Column */}
                {columns.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#70786D] font-medium">Status</span>
                    <select
                      value={task.column_id}
                      onChange={(e) => handleColumnChange(e.target.value)}
                      className="motion-input font-medium rounded-[6px] px-2.5 py-1 text-[12.5px] cursor-pointer"
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Priority */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#70786D] font-medium">Priority</span>
                  <select
                    value={task.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                    className="motion-input font-medium rounded-[6px] px-2.5 py-1 text-[12.5px] cursor-pointer"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#70786D] font-medium">Due</span>
                  <input
                    type="date"
                    defaultValue={task.due_date ? task.due_date.substring(0, 10) : ''}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    className="motion-input font-medium rounded-[6px] px-2.5 py-1 text-[12.5px] cursor-pointer"
                  />
                </div>

                {/* Estimate */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#70786D] font-medium">Estimate</span>
                  <div className="flex items-center motion-input rounded-[6px] px-2 py-1 text-[12.5px]">
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
                      className="w-10 bg-transparent text-[#33382F] font-semibold border-none focus:outline-hidden p-0 text-[12.5px]"
                      data-tabular-nums="true"
                      title="Estimated effort in hours"
                    />
                    <span className="text-[#70786D] text-[11px] ml-0.5">h</span>
                    {savingEstimate && <span className="text-[10px] text-[#70786D] ml-1">...</span>}
                  </div>
                </div>

                {/* Mark Blocked button if not currently blocked */}
                {!task.is_blocked && (
                  <button
                    type="button"
                    onClick={() => setIsBlockerModalOpen(true)}
                    className="px-2.5 py-1 text-[12px] text-[#7B4B3A] bg-[#F3E7DD] hover:bg-[#EBDDD0] rounded-[6px] transition-colors flex items-center gap-1 border border-[#DFC2B0] font-semibold cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-[#A46F5C]" />
                    <span>Mark Blocked</span>
                  </button>
                )}
              </div>

              {/* Assignees */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11.5px] font-semibold text-[#70786D] uppercase tracking-[0.04em]">
                  Assignees
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {members.map((m) => {
                    const isAssigned = task.assignees.some((a) => a.user_id === m.user_id);
                    return (
                      <button
                        type="button"
                        key={m.user_id}
                        onClick={() => handleAssigneeToggle(m.user_id)}
                        className={`text-[12px] px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isAssigned
                            ? 'bg-[#E3EBDD] text-[#33382F] border-[#C8D8C1] font-semibold'
                            : 'bg-[#F3EFE5] text-[#5D655A] border-[#DED8CB] hover:bg-[#EDE7DA] hover:text-[#33382F]'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-bold ${getAvatarColor(
                            m.name
                          )}`}
                        >
                          {getInitials(m.name)}
                        </span>
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Description */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11.5px] font-semibold text-[#70786D] uppercase tracking-[0.04em]">
                  Description
                </span>
                <textarea
                  defaultValue={task.description}
                  onBlur={(e) => handleDescriptionBlur(e.target.value)}
                  placeholder="Add notes, specifications, or context..."
                  rows={3}
                  className="w-full text-[13.5px] text-[#33382F] motion-input rounded-[9px] p-3 placeholder-[#70786D] resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* 5. Effort & Time Tracking (compact) */}
            <div className="p-6 space-y-3 bg-[#FFFCF6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#5D655A]" />
                  <h3 className="text-[15px] font-semibold text-[#33382F]">
                    Effort &amp; Time Tracking
                  </h3>
                  <span
                    className={`text-[12px] px-2 py-0.5 rounded-[6px] border ${
                      isOver
                        ? 'bg-[#F3E7DD] text-[#7B4B3A] border-[#DFC2B0] font-semibold'
                        : 'bg-[#F3EFE5] text-[#5D655A] border-[#DED8CB]'
                    }`}
                    data-tabular-nums="true"
                  >
                    {timeSpent}h logged {hasEstimate ? `/ ${estimated}h est.` : ''}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLogTimeForm((prev) => !prev)}
                  className="btn-secondary px-2.5 py-1 text-[12px] rounded-[6px] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showLogTimeForm ? 'Cancel' : 'Log Time'}</span>
                </button>
              </div>

              {hasEstimate && (
                <div className="w-full bg-[#EDE7DA] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOver ? 'bg-[#A46F5C]' : 'bg-[#596D56]'
                    }`}
                    style={{ width: `${Math.min(percentSpent, 100)}%` }}
                  />
                </div>
              )}

              {showLogTimeForm && (
                <form
                  onSubmit={handleCreateTimeLog}
                  className="p-3.5 bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px] space-y-3 text-[12.5px]"
                >
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
                        className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-[6px] border transition-colors cursor-pointer ${
                          timeLogHours === preset.val
                            ? 'bg-[#596D56] text-[#FFFCF6] border-[#596D56]'
                            : 'bg-[#FFFCF6] text-[#5D655A] border-[#DED8CB] hover:bg-[#EDE7DA]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="log-hours-input" className="block text-[11.5px] font-semibold text-[#5D655A] mb-1">
                        Hours *
                      </label>
                      <input
                        id="log-hours-input"
                        type="number"
                        step="0.25"
                        min="0.1"
                        max="100"
                        required
                        value={timeLogHours}
                        onChange={(e) => setTimeLogHours(e.target.value)}
                        className="w-full text-[12.5px] motion-input rounded-[6px] px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="log-date-input" className="block text-[11.5px] font-semibold text-[#5D655A] mb-1">
                        Date
                      </label>
                      <input
                        id="log-date-input"
                        type="date"
                        value={timeLogDate}
                        onChange={(e) => setTimeLogDate(e.target.value)}
                        className="w-full text-[12.5px] motion-input rounded-[6px] px-2.5 py-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={timeLogDesc}
                      onChange={(e) => setTimeLogDesc(e.target.value)}
                      placeholder="Work note (optional)..."
                      className="w-full text-[12.5px] motion-input rounded-[6px] px-2.5 py-1.5"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLogTimeForm(false)}
                      className="btn-tertiary px-2.5 py-1 text-[12px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loggingTime || !timeLogHours || parseFloat(timeLogHours) <= 0}
                      className="btn-primary px-3 py-1 text-[12px] rounded-[6px] cursor-pointer disabled:opacity-50"
                    >
                      {loggingTime ? 'Saving...' : 'Add Entry'}
                    </button>
                  </div>
                </form>
              )}

              {task.timeLogs && task.timeLogs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {task.timeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-3 py-2 rounded-[6px] border border-[#EAE4D8] bg-[#F7F4EC] flex items-center justify-between gap-2 text-[12px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getAvatarColor(
                            log.user_name
                          )}`}
                        >
                          {getInitials(log.user_name)}
                        </span>
                        <span className="font-semibold text-[#33382F] shrink-0">{log.user_name}</span>
                        {log.description && (
                          <span className="text-[#5D655A] truncate">· {log.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[#70786D]">{formatDate(log.logged_at)}</span>
                        <span className="font-semibold text-[#33382F] bg-[#FFFCF6] border border-[#DED8CB] px-1.5 py-0.5 rounded-[4px]" data-tabular-nums="true">
                          {log.hours}h
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTimeLog(log.id)}
                          className="text-[#70786D] hover:text-[#985C51] p-0.5 cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Dependencies */}
            <div className="p-6 space-y-3 bg-[#FFFCF6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#5D655A]" />
                  <h3 className="text-[15px] font-semibold text-[#33382F]">
                    Dependencies ({task.dependencies?.length || 0})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDepForm((prev) => !prev);
                    setDepError(null);
                  }}
                  className="btn-secondary px-2.5 py-1 text-[12px] rounded-[6px] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddDepForm ? 'Cancel' : 'Add Prerequisite'}</span>
                </button>
              </div>

              {showAddDepForm && (
                <form
                  onSubmit={handleAddDependency}
                  className="p-3 bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px] space-y-2 text-[12.5px]"
                >
                  {eligibleTasks.length === 0 ? (
                    <p className="text-[12px] text-[#70786D]">
                      No other tasks available in this project to link.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedDepId}
                        onChange={(e) => setSelectedDepId(e.target.value)}
                        className="flex-1 text-[12.5px] motion-input rounded-[6px] px-2.5 py-1.5 cursor-pointer"
                        required
                      >
                        <option value="">Select prerequisite task...</option>
                        {eligibleTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.priority})
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={addingDep || !selectedDepId}
                        className="btn-primary px-3 py-1.5 text-[12px] rounded-[6px] disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {addingDep ? 'Linking...' : 'Link'}
                      </button>
                    </div>
                  )}

                  {depError && (
                    <div className="p-2 text-[12px] bg-[#F3E7DD] border border-[#DFC2B0] text-[#985C51] rounded-[6px]">
                      {depError}
                    </div>
                  )}
                </form>
              )}

              {(!task.dependencies || task.dependencies.length === 0) ? (
                <p className="text-[12.5px] text-[#70786D]">
                  No prerequisite tasks linked.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {task.dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] border text-[12.5px] ${
                        dep.is_completed
                          ? 'bg-[#E6EEE4]/60 border-[#C8D8C1] text-[#35513A]'
                          : 'bg-[#F3E7DD]/60 border-[#DFC2B0] text-[#33382F]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {dep.is_completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#62866B] shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#A46F5C] shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleJumpToTask(dep.depends_on_task_id)}
                          className="font-semibold text-[#33382F] hover:text-[#596D56] hover:underline truncate text-left cursor-pointer"
                        >
                          {dep.depends_on_title}
                        </button>
                        {dep.depends_on_priority && (
                          <PriorityBadge priority={dep.depends_on_priority} showLabel={false} />
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-[#FFFCF6] border border-[#DED8CB] text-[#5D655A]">
                          {dep.is_completed ? 'Done' : dep.depends_on_column_name || 'Pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDependency(dep.depends_on_task_id)}
                          className="text-[#70786D] hover:text-[#985C51] p-1 cursor-pointer"
                          title="Remove dependency"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Downstream Tasks */}
              {task.blocking && task.blocking.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <span className="text-[11.5px] font-semibold text-[#70786D] flex items-center gap-1">
                    <CornerDownRight className="w-3.5 h-3.5" />
                    <span>Blocking downstream ({task.blocking.length})</span>
                  </span>
                  {task.blocking.map((blocked) => (
                    <div
                      key={blocked.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] bg-[#F7F4EC] border border-[#EAE4D8] text-[12.5px]"
                    >
                      <button
                        type="button"
                        onClick={() => handleJumpToTask(blocked.task_id)}
                        className="font-semibold text-[#33382F] hover:text-[#596D56] hover:underline truncate text-left cursor-pointer"
                      >
                        {blocked.blocked_task_title}
                      </button>
                      <span className="text-[11px] text-[#5D655A] bg-[#FFFCF6] border border-[#DED8CB] px-2 py-0.5 rounded-[4px] shrink-0">
                        {blocked.blocked_task_column_name || 'In Progress'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 7. Decisions */}
            <div className="p-6 space-y-3 bg-[#FFFCF6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#5D655A]" />
                  <h3 className="text-[15px] font-semibold text-[#33382F]">
                    Decisions ({task.decisions.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionPrefill({});
                    setIsDecisionModalOpen(true);
                  }}
                  className="btn-secondary px-2.5 py-1 text-[12px] rounded-[6px] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Decision</span>
                </button>
              </div>

              {task.decisions.length === 0 ? (
                <p className="text-[12.5px] text-[#70786D]">
                  No decisions recorded for this task yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {task.decisions.map((dec) => (
                    <div
                      key={dec.id}
                      className="bg-[#F7F4EC] border border-[#DED8CB] rounded-[9px] p-3.5 space-y-1.5 text-[13px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[#33382F]">{dec.title}</p>
                        {user?.id === dec.author_id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDecision(dec.id)}
                            className="text-[#70786D] hover:text-[#985C51] p-0.5 cursor-pointer"
                            title="Delete decision"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[#33382F] leading-relaxed">{dec.summary}</p>
                      {dec.rationale && (
                        <p className="text-[12px] text-[#5D655A] bg-[#FFFCF6] p-2 rounded-[6px] border border-[#EAE4D8]">
                          <span className="font-semibold text-[#70786D]">Rationale: </span>
                          {dec.rationale}
                        </p>
                      )}
                      <div className="text-[11px] text-[#70786D] pt-0.5">
                        Recorded by {dec.author_name} · {formatRelativeTime(dec.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 8. Comments & Activity */}
            <div className="p-6 space-y-4 bg-[#FFFCF6]">
              <div className="flex items-center gap-4 border-b border-[#EAE4D8] pb-2 text-[13px]">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`font-semibold pb-2 -mb-2.5 transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 ${
                    activeTab === 'comments'
                      ? 'text-[#33382F] border-[#596D56]'
                      : 'text-[#70786D] border-transparent hover:text-[#33382F]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Comments ({task.comments.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`font-semibold pb-2 -mb-2.5 transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 ${
                    activeTab === 'activity'
                      ? 'text-[#33382F] border-[#596D56]'
                      : 'text-[#70786D] border-transparent hover:text-[#33382F]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Activity ({task.activity.length})</span>
                </button>
              </div>

              {activeTab === 'comments' ? (
                <div className="space-y-3">
                  {task.comments.length === 0 ? (
                    <p className="text-[12.5px] text-[#70786D] py-2">
                      No comments yet. Share an update below.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {task.comments.map((cmt) => (
                        <div
                          key={cmt.id}
                          className="bg-[#F7F4EC] border border-[#EAE4D8] rounded-[9px] p-3.5 space-y-1.5 text-[13px]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(
                                  cmt.author_name
                                )}`}
                              >
                                {getInitials(cmt.author_name)}
                              </span>
                              <span className="font-semibold text-[#33382F]">
                                {cmt.author_name}
                              </span>
                              <span className="text-[11px] text-[#70786D]">
                                {formatRelativeTime(cmt.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handlePromoteCommentToDecision(cmt)}
                                className="text-[11px] font-medium text-[#596D56] hover:text-[#465A44] hover:underline flex items-center gap-1 cursor-pointer bg-[#E3EBDD] px-2 py-0.5 rounded-[4px]"
                                title="Promote to Decision"
                              >
                                <FileCheck className="w-3 h-3" />
                                <span>Record as Decision</span>
                              </button>
                              {user?.id === cmt.author_id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(cmt.id)}
                                  className="text-[#70786D] hover:text-[#985C51] p-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[13px] text-[#33382F] whitespace-pre-wrap pl-7 leading-relaxed">
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
                      className="flex-1 text-[13px] motion-input rounded-[9px] px-3.5 py-2"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !commentText.trim()}
                      className="btn-primary px-4 py-2 text-[12.5px] rounded-[9px] disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-2 text-[12.5px] text-[#5D655A]">
                  {task.activity.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-2.5 py-1.5 border-b border-[#EAE4D8] last:border-none"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#596D56] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-[#33382F]">{act.user_name} </span>
                        <span>
                          {act.action_type === 'task_created' && 'created this task'}
                          {act.action_type === 'status_changed' && 'updated status'}
                          {act.action_type === 'task_blocked' && 'marked this task as blocked'}
                          {act.action_type === 'blocker_resolved' && 'resolved the blocker'}
                          {act.action_type === 'decision_recorded' && 'recorded a decision'}
                          {act.action_type === 'task_assigned' && 'updated assignees'}
                        </span>
                        <span className="text-[11px] text-[#70786D] ml-2">
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
