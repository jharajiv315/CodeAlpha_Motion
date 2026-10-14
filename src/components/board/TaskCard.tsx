import React, { useState } from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { PriorityBadge, getPriorityBorderColor } from '../ui/PriorityBadge.tsx';
import { api } from '../../lib/api.ts';
import {
  formatDate,
  getAvatarColor,
  getInitials,
  isOverdue,
} from '../../lib/utils.ts';
import {
  AlertTriangle,
  Calendar,
  MessageSquare,
  FileCheck,
  MoreHorizontal,
  GripVertical,
  Link2,
  Check,
  CornerDownRight,
  Clock,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskCardProps {
  task: Task;
  columns: BoardColumn[];
  onOpenDetail?: (taskId: string) => void;
  onMoveToColumn?: (taskId: string, targetColId: string) => void;
  onTaskUpdated?: () => void;
  isDragOverlay?: boolean;
}

export function TaskCard({
  task,
  columns,
  onOpenDetail,
  onMoveToColumn,
  onTaskUpdated,
  isDragOverlay = false,
}: TaskCardProps) {
  const [showQuickMove, setShowQuickMove] = useState(false);
  const [showTimeLogger, setShowTimeLogger] = useState(false);
  const [logHours, setLogHours] = useState('0.5');
  const [logDesc, setLogDesc] = useState('');
  const [isLoggingTime, setIsLoggingTime] = useState(false);
  const [timeSuccess, setTimeSuccess] = useState(false);
  const [quickEstimate, setQuickEstimate] = useState(
    task.estimated_hours !== null && task.estimated_hours !== undefined ? String(task.estimated_hours) : ''
  );
  const overdue = isOverdue(task.due_date, !!task.completed_at);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isDragOverlay,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = !isDragOverlay
    ? {
        transform: CSS.Translate.toString(transform),
        transition,
      }
    : undefined;

  const priorityBorderClass = getPriorityBorderColor(task.priority);

  // Task Dependencies & Blocked Links
  const dependencies = task.dependencies || [];
  const incompleteDeps = dependencies.filter((d) => !d.is_completed);
  const completedDeps = dependencies.filter((d) => d.is_completed);
  const hasIncompleteDeps = incompleteDeps.length > 0;

  // Time Spent (Actual vs Estimated Effort)
  const timeSpent = Math.round(Number(task.time_spent_hours || 0) * 10) / 10;
  const estimated = task.estimated_hours !== null && task.estimated_hours !== undefined ? Number(task.estimated_hours) : null;
  const hasEstimate = estimated !== null && estimated > 0;
  const percentSpent = hasEstimate ? Math.round((timeSpent / estimated!) * 100) : 0;
  const isOver = hasEstimate && timeSpent > estimated!;
  const isNear = hasEstimate && !isOver && percentSpent >= 80;
  const overAmount = isOver ? (timeSpent - estimated!).toFixed(1) : null;
  const hasTimeData = timeSpent > 0 || hasEstimate;

  const handleQuickLogSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const hoursNum = parseFloat(logHours);
    if (isNaN(hoursNum) || hoursNum <= 0) return;

    setIsLoggingTime(true);
    try {
      await api.tasks.logTime(task.id, {
        hours: hoursNum,
        description: logDesc.trim() || undefined,
      });

      // If user also entered or updated an estimate
      if (quickEstimate && (!estimated || parseFloat(quickEstimate) !== estimated)) {
        const estNum = parseFloat(quickEstimate);
        if (!isNaN(estNum) && estNum > 0) {
          await api.tasks.update(task.id, { estimatedHours: estNum });
        }
      }

      setTimeSuccess(true);
      setTimeout(() => {
        setTimeSuccess(false);
        setShowTimeLogger(false);
        setLogDesc('');
      }, 700);

      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to log time:', err);
    } finally {
      setIsLoggingTime(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging && onOpenDetail) {
          onOpenDetail(task.id);
        }
      }}
      className={`group relative bg-white border border-[#E7E9ED] border-l-4 ${priorityBorderClass} rounded-xl p-3 shadow-2xs hover:border-[#D1D5DB] hover:shadow-xs transition-all cursor-grab active:cursor-grabbing select-none space-y-2.5 ${
        isDragging ? 'opacity-30 border-dashed border-[#5965D8] bg-[#F8F9FB]' : ''
      } ${isDragOverlay ? 'shadow-xl ring-2 ring-[#5965D8]/40 rotate-1 cursor-grabbing' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail?.(task.id);
        }
      }}
    >
      {/* Top Header Row: Priority Visual Indicator, Decision Count, Drag Grip & Quick Move */}
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#6D7480]">
          {/* Visual Priority Badge */}
          <PriorityBadge priority={task.priority} />

          {/* Blocked by prerequisite dependencies indicator */}
          {hasIncompleteDeps && (
            <span
              className="inline-flex items-center gap-1 text-[#EA580C] bg-[#FFF7ED] border border-[#FED7AA] px-1 rounded text-[10px] font-semibold"
              title={`Blocked by ${incompleteDeps.length} prerequisite ${incompleteDeps.length === 1 ? 'task' : 'tasks'}`}
            >
              <Link2 className="w-2.5 h-2.5" />
              <span>Blocked</span>
            </span>
          )}

          {task.decisionCount > 0 && (
            <>
              <span aria-hidden="true" className="text-[#D1D5DB]">·</span>
              <span
                className="inline-flex items-center gap-0.5 text-[#5965D8] font-medium"
                title={`${task.decisionCount} decision notes recorded`}
              >
                <FileCheck className="w-2.5 h-2.5" />
                <span data-tabular-nums="true">{task.decisionCount}</span>
              </span>
            </>
          )}

          {/* Downstream blocking indicator badge */}
          {task.blockingCount && task.blockingCount > 0 ? (
            <span
              className="inline-flex items-center gap-0.5 text-[#C2410C] bg-[#FFF7ED] border border-[#FFEDD5] px-1 rounded text-[10px] font-medium"
              title={`This task is blocking ${task.blockingCount} downstream tasks`}
            >
              <CornerDownRight className="w-2.5 h-2.5" />
              <span>{task.blockingCount}</span>
            </span>
          ) : null}
        </div>

        {/* Right side: Reorder grip & Keyboard Quick Move */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span
            className="opacity-0 group-hover:opacity-100 text-[#9CA3AF] transition-opacity cursor-grab active:cursor-grabbing"
            title="Drag to reorder within or across columns"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>

          {/* Keyboard Quick Move Menu Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQuickMove((prev) => !prev)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#9CA3AF] hover:text-[#20242B] p-0.5 rounded transition-opacity"
              title="Move to column (Keyboard accessible)"
              aria-label="Move task to column"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {showQuickMove && (
              <div className="absolute right-0 top-5 z-30 bg-white border border-[#E7E9ED] shadow-md rounded-lg py-1 w-36 text-xs animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                  Move to
                </div>
                {columns.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    disabled={c.id === task.column_id}
                    onClick={() => {
                      onMoveToColumn?.(task.id, c.id);
                      setShowQuickMove(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-[#F8F9FB] transition-colors ${
                      c.id === task.column_id ? 'text-[#D1D5DB] cursor-not-allowed' : 'text-[#20242B] font-medium'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xs font-medium text-[#20242B] leading-snug line-clamp-2">
        {task.title}
      </h3>

      {/* Visualized Blocked Links (Prerequisite Task Dependencies) */}
      {hasIncompleteDeps && (
        <div
          className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg p-2 text-xs space-y-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#9A3412]">
            <span className="flex items-center gap-1">
              <Link2 className="w-3 h-3 text-[#EA580C] shrink-0" />
              <span>Blocked by {incompleteDeps.length} {incompleteDeps.length === 1 ? 'task' : 'tasks'}</span>
            </span>
            <span className="text-[9px] font-mono px-1 py-0.2 bg-[#FFEDD5] rounded text-[#C2410C]">
              Dependency
            </span>
          </div>

          <div className="space-y-1">
            {incompleteDeps.map((dep) => (
              <button
                type="button"
                key={dep.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.(dep.depends_on_task_id);
                }}
                className="w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-white hover:bg-[#FFFBEB] border border-[#FDBA74]/60 text-left transition-colors cursor-pointer group/link text-[11px]"
                title={`Click to open blocking task: ${dep.depends_on_title}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C] shrink-0" />
                  <span className="truncate font-medium text-[#7C2D12] group-hover/link:underline">
                    {dep.depends_on_title}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[#9A3412] px-1 py-0.2 rounded bg-[#FED7AA]/50 shrink-0">
                  {dep.depends_on_column_name || 'Pending'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Satisfied dependencies indicator */}
      {!hasIncompleteDeps && completedDeps.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] font-medium text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-md">
          <Check className="w-2.5 h-2.5 text-[#16A34A] shrink-0" />
          <span>Dependencies met ({completedDeps.length})</span>
        </div>
      )}

      {/* Flagship USP 1: Blocker Radar Indicator */}
      {task.is_blocked && (
        <div className="bg-[#FAF8F5] border border-[#EFE9DF] rounded-lg p-2 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[#92400E]">
            <AlertTriangle className="w-3 h-3 text-[#B97828] shrink-0" />
            <span>Blocker Radar</span>
            {task.activeBlocker?.waiting_on_name && (
              <span className="font-normal text-[#78350F]">
                · on {task.activeBlocker.waiting_on_name}
              </span>
            )}
          </div>
          {task.activeBlocker?.reason && (
            <p className="line-clamp-2 text-[#78350F] text-[11px] leading-relaxed">
              {task.activeBlocker.reason}
            </p>
          )}
        </div>
      )}

      {/* Time Spent & Effort (Estimated vs Actual) */}
      <div className="relative pt-1 border-t border-[#F4F5F7]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-1 text-[11px]">
          {/* Time spent chip with effort indicator */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTimeLogger((prev) => !prev);
            }}
            className={`group/timechip inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all cursor-pointer ${
              isOver
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2]'
                : isNear
                ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706] hover:bg-[#FEF3C7]'
                : hasTimeData
                ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'
                : 'bg-transparent border-dashed border-[#CBD5E1] text-[#94A3B8] hover:text-[#475569] hover:border-[#94A3B8] opacity-80 group-hover:opacity-100'
            }`}
            title={
              hasEstimate
                ? `${timeSpent}h spent of ${estimated}h estimated (${percentSpent}%)${isOver ? ` — Exceeded estimate by ${overAmount}h!` : ''}`
                : timeSpent > 0
                ? `${timeSpent}h spent (No estimate set)`
                : 'Log time spent on this task'
            }
          >
            <Clock
              className={`w-3 h-3 shrink-0 ${
                isOver ? 'text-[#DC2626]' : isNear ? 'text-[#D97706]' : 'text-[#64748B]'
              }`}
            />
            <span className="font-mono flex items-center gap-0.5">
              {hasEstimate ? (
                <>
                  <span className="font-semibold">{timeSpent}h</span>
                  <span className="text-[#94A3B8]">/</span>
                  <span className="text-[#64748B]">{estimated}h</span>
                </>
              ) : timeSpent > 0 ? (
                <span className="font-semibold">{timeSpent}h spent</span>
              ) : (
                <span className="font-sans text-[10px] text-[#64748B]">+ Time</span>
              )}
            </span>

            {isOver && (
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#FEE2E2] text-[#991B1B] font-bold">
                +{overAmount}h
              </span>
            )}
          </button>

          {/* Quick Log button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTimeLogger((prev) => !prev);
            }}
            className="text-[10px] text-[#5965D8] hover:text-[#434DB7] hover:underline font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer px-1 flex items-center gap-0.5"
            title="Open time entry logger"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Log</span>
          </button>
        </div>

        {/* Progress bar showing % effort consumed */}
        {hasEstimate && (
          <div
            className="mt-1 w-full bg-[#E2E8F0] h-1 rounded-full overflow-hidden"
            title={`${percentSpent}% of estimated effort used`}
          >
            <div
              className={`h-full transition-all duration-300 ${
                isOver ? 'bg-[#DC2626]' : isNear ? 'bg-[#D97706]' : 'bg-[#5965D8]'
              }`}
              style={{ width: `${Math.min(percentSpent, 100)}%` }}
            />
          </div>
        )}

        {/* Manual Entry Logger Popover */}
        {showTimeLogger && (
          <div
            className="absolute left-0 bottom-full mb-2 z-50 bg-white border border-[#CBD5E1] shadow-xl rounded-xl p-3 w-68 text-xs space-y-2.5 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-1.5 font-semibold text-[#1E293B]">
                <Clock className="w-3.5 h-3.5 text-[#5965D8]" />
                <span>Log Time Spent</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTimeLogger(false)}
                className="text-[#94A3B8] hover:text-[#1E293B] p-0.5 rounded cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Current Effort Status Bar */}
            <div className="p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[11px] space-y-1">
              <div className="flex items-center justify-between text-[#475569]">
                <span>Logged so far:</span>
                <span className="font-mono font-bold text-[#1E293B]">{timeSpent} hrs</span>
              </div>
              <div className="flex items-center justify-between text-[#475569]">
                <span>Estimated effort:</span>
                <span className="font-mono font-semibold text-[#1E293B]">
                  {hasEstimate ? `${estimated} hrs` : 'Not set'}
                </span>
              </div>
              {hasEstimate && (
                <div className="flex items-center justify-between pt-0.5 text-[10px]">
                  <span className={isOver ? 'text-[#DC2626] font-semibold' : 'text-[#64748B]'}>
                    {isOver ? `Over budget by +${overAmount}h` : `${(estimated! - timeSpent).toFixed(1)}h remaining`}
                  </span>
                  <span className="font-mono font-bold text-[#5965D8]">{percentSpent}%</span>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                Quick Add Presets
              </span>
              <div className="flex flex-wrap gap-1">
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
                    onClick={() => setLogHours(preset.val)}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                      logHours === preset.val
                        ? 'bg-[#5965D8] text-white border-[#5965D8]'
                        : 'bg-white hover:bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Duration Input */}
            <div className="space-y-1">
              <label htmlFor={`hours-input-${task.id}`} className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                Duration (Hours)
              </label>
              <div className="relative">
                <input
                  id={`hours-input-${task.id}`}
                  type="number"
                  step="0.25"
                  min="0.1"
                  max="99"
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                  className="w-full text-xs font-mono border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[#1E293B] focus:outline-hidden focus:border-[#5965D8]"
                  placeholder="e.g. 1.5"
                />
                <span className="absolute right-2.5 top-1.5 text-[11px] text-[#94A3B8]">hrs</span>
              </div>
            </div>

            {/* Work Note Input */}
            <div className="space-y-1">
              <label htmlFor={`desc-input-${task.id}`} className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                Work Note <span className="font-normal text-[#94A3B8]">(Optional)</span>
              </label>
              <input
                id={`desc-input-${task.id}`}
                type="text"
                value={logDesc}
                onChange={(e) => setLogDesc(e.target.value)}
                placeholder="What did you work on?"
                className="w-full text-xs border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[#1E293B] focus:outline-hidden focus:border-[#5965D8] placeholder-[#94A3B8]"
              />
            </div>

            {/* Optional: Set estimate if missing */}
            {!hasEstimate && (
              <div className="space-y-1 pt-0.5">
                <label htmlFor={`est-input-${task.id}`} className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Set Task Estimate <span className="font-normal text-[#94A3B8]">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    id={`est-input-${task.id}`}
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={quickEstimate}
                    onChange={(e) => setQuickEstimate(e.target.value)}
                    placeholder="e.g. 4.0"
                    className="w-full text-xs font-mono border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-[#1E293B] focus:outline-hidden focus:border-[#5965D8]"
                  />
                  <span className="absolute right-2.5 top-1 text-[11px] text-[#94A3B8]">hrs est</span>
                </div>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => {
                  setShowTimeLogger(false);
                  onOpenDetail?.(task.id);
                }}
                className="text-[10px] text-[#5965D8] hover:underline cursor-pointer"
              >
                All logs →
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowTimeLogger(false)}
                  className="px-2 py-1 text-xs text-[#64748B] hover:text-[#1E293B] rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isLoggingTime || !logHours || parseFloat(logHours) <= 0}
                  onClick={() => handleQuickLogSubmit()}
                  className="px-3 py-1 bg-[#5965D8] hover:bg-[#434DB7] text-white font-medium rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {timeSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      <span>Logged!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>{isLoggingTime ? 'Saving...' : 'Log Effort'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Metadata: Due Date & Assignees */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#F4F5F7]">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span
              className={`flex items-center gap-1 text-[11px] font-mono ${
                overdue ? 'text-[#C54D4D] font-semibold' : 'text-[#6D7480]'
              }`}
              title={overdue ? 'Overdue' : 'Due date'}
            >
              <Calendar className="w-3 h-3 text-[#9CA3AF]" />
              <span>{formatDate(task.due_date)}</span>
            </span>
          )}

          {task.commentCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF] font-mono">
              <MessageSquare className="w-3 h-3" />
              <span>{task.commentCount}</span>
            </span>
          )}
        </div>

        {/* Assignees initials/avatars */}
        <div className="flex -space-x-1 overflow-hidden">
          {task.assignees.map((a) => (
            <span
              key={a.user_id}
              className={`inline-block w-4.5 h-4.5 rounded-full ring-1 ring-white text-[9px] font-bold flex items-center justify-center shrink-0 ${getAvatarColor(
                a.name
              )}`}
              title={a.name}
            >
              {getInitials(a.name)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
