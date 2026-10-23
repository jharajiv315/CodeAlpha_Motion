import React, { useState } from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import { api } from '../../lib/api.ts';
import {
  formatDate,
  getAvatarColor,
  getInitials,
  isOverdue,
} from '../../lib/utils.ts';
import {
  Calendar,
  MessageSquare,
  FileCheck,
  MoreHorizontal,
  Link2,
  Clock,
  Check,
  X,
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

  const dependencies = task.dependencies || [];
  const incompleteDeps = dependencies.filter((d) => !d.is_completed);
  const hasIncompleteDeps = incompleteDeps.length > 0;

  const timeSpent = Math.round(Number(task.time_spent_hours || 0) * 10) / 10;
  const estimated =
    task.estimated_hours !== null && task.estimated_hours !== undefined
      ? Number(task.estimated_hours)
      : null;
  const hasEstimate = estimated !== null && estimated > 0;
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

      setTimeSuccess(true);
      setTimeout(() => {
        setTimeSuccess(false);
        setShowTimeLogger(false);
        setLogDesc('');
      }, 600);

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
      className={`group relative bg-[#FFFCF6] border border-[#EAE4D8] hover:border-[#DED8CB] rounded-[9px] p-3.5 space-y-2.5 cursor-grab active:cursor-grabbing select-none transition-colors ${
        isDragging ? 'opacity-40 border-dashed border-[#596D56] bg-[#E3EBDD]/40' : ''
      } ${
        isDragOverlay
          ? 'border-[#DED8CB] shadow-[0_8px_30px_rgba(66,62,48,0.12)] -translate-y-0.5 cursor-grabbing z-50'
          : ''
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail?.(task.id);
        }
      }}
    >
      {/* Top Row: [Due date, if known] on left, [···] overflow menu on right */}
      <div className="flex items-center justify-between gap-2 text-[11.5px]">
        <div className="flex items-center gap-2 min-w-0">
          {task.due_date ? (
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                overdue ? 'text-[#985C51]' : 'text-[#70786D]'
              }`}
              title={overdue ? 'Overdue' : 'Due date'}
              data-tabular-nums="true"
            >
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{formatDate(task.due_date)}</span>
            </span>
          ) : (
            <span className="text-[11px] text-[#70786D]">Task</span>
          )}
        </div>

        {/* Overflow menu (Keyboard accessible move-to-column & quick time log) */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setShowQuickMove((prev) => !prev)}
            className="text-[#70786D] hover:text-[#33382F] p-1 rounded-[5px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
            title="Task actions & move to column"
            aria-label="Task actions & move to column"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showQuickMove && (
            <div className="absolute right-0 top-6 z-30 motion-popover py-1.5 w-44 text-[12px]">
              <div className="px-3 py-1 text-[10.5px] font-semibold text-[#70786D] uppercase tracking-wider">
                Move to column
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
                  className={`w-full text-left px-3 py-1.5 hover:bg-[#EDE7DA] transition-colors cursor-pointer ${
                    c.id === task.column_id
                      ? 'text-[#70786D] cursor-not-allowed'
                      : 'text-[#33382F] font-medium'
                  }`}
                >
                  {c.name}
                </button>
              ))}
              <div className="border-t border-[#EAE4D8] mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickMove(false);
                    setShowTimeLogger((prev) => !prev);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[#596D56] hover:bg-[#EDE7DA] font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Log effort hours</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Title (13.5–14px, 600 weight, 1.4 line height, wraps up to 3 lines) */}
      <h3 className="text-[13.5px] font-semibold text-[#33382F] leading-[1.4] line-clamp-3">
        {task.title}
      </h3>

      {/* Short, useful context (optional, max 2 lines) */}
      {task.description && (
        <p className="text-[12.5px] text-[#5D655A] leading-[1.45] line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Blocked State: concise clay indicator plus text ("Blocked · reason") */}
      {task.is_blocked && (
        <div className="bg-[#F3E7DD] border border-[#E5D0C1] rounded-[6px] px-2.5 py-1.5 text-[11.5px] text-[#7B4B3A] flex items-start gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A46F5C] shrink-0 mt-1.5" />
          <span className="line-clamp-2 leading-snug">
            <strong className="font-semibold text-[#A46F5C]">Blocked</strong>
            {task.activeBlocker?.reason ? ` · ${task.activeBlocker.reason}` : ''}
          </span>
        </div>
      )}

      {/* Prerequisite Dependencies indicator (if incomplete) */}
      {hasIncompleteDeps && (
        <div
          className="bg-[#F1E9DB] border border-[#E2D5BE] rounded-[6px] px-2.5 py-1.5 text-[11.5px] text-[#5E4D33] space-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <Link2 className="w-3 h-3 text-[#A46F5C] shrink-0" />
            <span>Waiting on {incompleteDeps.length} prerequisite{incompleteDeps.length === 1 ? '' : 's'}</span>
          </div>
          {incompleteDeps.slice(0, 2).map((dep) => (
            <button
              type="button"
              key={dep.id}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail?.(dep.depends_on_task_id);
              }}
              className="w-full text-left truncate text-[11px] text-[#33382F] hover:underline block cursor-pointer"
            >
              · {dep.depends_on_title}
            </button>
          ))}
        </div>
      )}

      {/* Quick Time Logger Inline Form (when opened from menu) */}
      {showTimeLogger && (
        <form
          onSubmit={handleQuickLogSubmit}
          onClick={(e) => e.stopPropagation()}
          className="p-2.5 rounded-[6px] bg-[#F3EFE5] border border-[#DED8CB] space-y-2 text-[12px]"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#33382F] text-[11.5px]">Log effort (hrs)</span>
            <button
              type="button"
              onClick={() => setShowTimeLogger(false)}
              className="text-[#70786D] hover:text-[#33382F]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={logHours}
              onChange={(e) => setLogHours(e.target.value)}
              className="w-16 motion-input px-2 py-1 text-[12px]"
              placeholder="Hrs"
            />
            <input
              type="text"
              value={logDesc}
              onChange={(e) => setLogDesc(e.target.value)}
              className="flex-1 motion-input px-2 py-1 text-[12px]"
              placeholder="Note (optional)"
            />
            <button
              type="submit"
              disabled={isLoggingTime}
              className="px-2.5 py-1 btn-primary text-[11.5px] cursor-pointer"
            >
              {timeSuccess ? <Check className="w-3.5 h-3.5" /> : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Bottom Row: [assignee avatars] on left, [comments] [decisions] [effort] [priority] on right */}
      <div className="pt-1 flex items-center justify-between gap-2">
        {/* Assignee Avatars (24–26px) */}
        <div className="flex items-center -space-x-1.5">
          {task.assignees && task.assignees.length > 0 ? (
            task.assignees.slice(0, 3).map((a) => (
              <span
                key={a.user_id}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ring-2 ring-[#FFFCF6] ${getAvatarColor(
                  a.name
                )}`}
                title={a.name}
              >
                {getInitials(a.name)}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-[#70786D]">Unassigned</span>
          )}
          {task.assignees && task.assignees.length > 3 && (
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-semibold bg-[#EDE7DA] text-[#5D655A] ring-2 ring-[#FFFCF6]">
              +{task.assignees.length - 3}
            </span>
          )}
        </div>

        {/* Quiet Metadata & Muted Priority */}
        <div className="flex items-center gap-2 text-[11.5px] text-[#70786D]">
          {hasTimeData && (
            <span
              className="inline-flex items-center gap-1"
              title={
                hasEstimate
                  ? `${timeSpent}h logged of ${estimated}h estimated`
                  : `${timeSpent}h logged`
              }
              data-tabular-nums="true"
            >
              <Clock className="w-3 h-3" />
              <span>
                {timeSpent}h{hasEstimate ? `/${estimated}h` : ''}
              </span>
            </span>
          )}

          {task.decisionCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[#596D56]"
              title={`${task.decisionCount} decision note(s)`}
              data-tabular-nums="true"
            >
              <FileCheck className="w-3 h-3" />
              <span>{task.decisionCount}</span>
            </span>
          )}

          {task.commentCount > 0 && (
            <span
              className="inline-flex items-center gap-1"
              title={`${task.commentCount} comment(s)`}
              data-tabular-nums="true"
            >
              <MessageSquare className="w-3 h-3" />
              <span>{task.commentCount}</span>
            </span>
          )}

          <PriorityBadge priority={task.priority} />
        </div>
      </div>
    </div>
  );
}
