import React, { useState, useEffect, useCallback } from 'react';
import type { Task } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import {
  formatDate,
  isOverdue,
} from '../../lib/utils.ts';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
} from 'lucide-react';

export function MyWorkView() {
  const { user } = useAuth();
  const { workspaceMembers } = useWorkspace();
  const { refreshKey } = useRealtime();

  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [blockingMeTasks, setBlockingMeTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadMyWork = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.myWork.get();
      setAssignedTasks(res.assignedTasks);
      setBlockingMeTasks(res.blockingMeTasks);
    } catch (err) {
      console.error('Failed to load My Work:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyWork();
  }, [loadMyWork, refreshKey]);

  const overdueOrDueSoon = assignedTasks.filter((t) => {
    if (t.completed_at || !t.due_date) return false;
    const d = new Date(t.due_date);
    const now = new Date();
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays <= 3;
  });

  const inProgressTasks = assignedTasks.filter(
    (t) => !t.completed_at && (t as any).column_name?.toUpperCase() === 'IN PROGRESS'
  );

  const otherTasks = assignedTasks.filter(
    (t) => !t.completed_at && (t as any).column_name?.toUpperCase() !== 'IN PROGRESS'
  );

  const renderEffortChip = (t: Task) => {
    const spent = Math.round(Number(t.time_spent_hours || 0) * 10) / 10;
    const est = t.estimated_hours !== null && t.estimated_hours !== undefined ? Number(t.estimated_hours) : null;
    if (spent === 0 && !est) return null;

    const isOver = est !== null && spent > est;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[6px] border shrink-0 ${
          isOver
            ? 'bg-[#F3E7DD] border-[#DFC2B0] text-[#7B4B3A] font-semibold'
            : 'bg-[#F3EFE5] border-[#DED8CB] text-[#5D655A]'
        }`}
        data-tabular-nums="true"
        title={est ? `${spent}h spent of ${est}h estimated` : `${spent}h spent`}
      >
        <Clock className="w-3 h-3" />
        <span>{spent}h</span>
        {est && (
          <>
            <span className="opacity-60">/</span>
            <span>{est}h</span>
          </>
        )}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-8 animate-view-in">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-[#DED8CB] flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] font-bold text-[#33382F] tracking-[-0.02em]">
                My Work
              </h1>
              <span
                className="text-[12px] font-semibold text-[#5D655A] bg-[#F3EFE5] px-2 py-0.5 rounded-[6px] border border-[#DED8CB]"
                data-tabular-nums="true"
              >
                {assignedTasks.length} assigned
              </span>
            </div>
            <p className="text-[13.5px] text-[#5D655A] mt-0.5">
              Tasks assigned to {user?.name} and blockers awaiting your input.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-[13px] text-[#70786D]">Loading your tasks...</div>
        ) : (
          <div className="space-y-6">
            {/* 1. Blockers waiting on me */}
            {blockingMeTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-[#7B4B3A]">
                  <AlertTriangle className="w-4 h-4 text-[#A46F5C]" />
                  <span>Waiting on your action ({blockingMeTasks.length})</span>
                </div>
                <div className="bg-[#F3E7DD]/60 rounded-[12px] overflow-hidden divide-y divide-[#E2C8B8] border border-[#DFC2B0]">
                  {blockingMeTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-4 hover:bg-[#F3E7DD] transition-colors cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#33382F] text-[13.5px] truncate">{t.title}</span>
                          <span className="text-[11px] text-[#5D655A] bg-[#FFFCF6] px-2 py-0.5 rounded-[6px] border border-[#DED8CB] font-medium">
                            {t.project_name}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-[#7B4B3A] mt-1">
                          Blocked: &ldquo;{t.blocker_reason}&rdquo;
                        </p>
                      </div>
                      <span className="text-[12px] text-[#7B4B3A] font-semibold flex items-center gap-1 shrink-0 bg-[#FFFCF6] px-2.5 py-1 rounded-[6px] border border-[#DFC2B0]">
                        <span>Review</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Due soon or overdue */}
            {overdueOrDueSoon.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[15px] font-semibold text-[#33382F]">Due Soon &amp; Overdue</h2>
                <div className="motion-surface rounded-[12px] overflow-hidden divide-y divide-[#EAE4D8]">
                  {overdueOrDueSoon.map((t) => {
                    const overdue = isOverdue(t.due_date, !!t.completed_at);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="p-3.5 hover:bg-[#F7F4EC] transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={t.priority} />
                            <p className="font-semibold text-[#33382F] text-[13.5px] truncate group-hover:text-[#596D56] transition-colors">
                              {t.title}
                            </p>
                          </div>
                          <span className="text-[11.5px] text-[#70786D] mt-0.5 block">
                            {(t as any).project_name} · {(t as any).column_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {renderEffortChip(t)}
                          <span
                            className={`text-[11.5px] px-2 py-0.5 rounded-[6px] shrink-0 ${
                              overdue
                                ? 'text-[#985C51] bg-[#F3E7DD] font-semibold border border-[#DFC2B0]'
                                : 'text-[#5D655A] bg-[#F3EFE5] border border-[#DED8CB]'
                            }`}
                            data-tabular-nums="true"
                          >
                            {overdue ? 'Overdue · ' : 'Due · '}
                            {formatDate(t.due_date)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. In Progress */}
            {inProgressTasks.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[15px] font-semibold text-[#33382F]">In Progress</h2>
                <div className="motion-surface rounded-[12px] overflow-hidden divide-y divide-[#EAE4D8]">
                  {inProgressTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-3.5 hover:bg-[#F7F4EC] transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={t.priority} />
                          <p className="font-semibold text-[#33382F] text-[13.5px] truncate group-hover:text-[#596D56] transition-colors">
                            {t.title}
                          </p>
                        </div>
                        <span className="text-[11.5px] text-[#70786D] mt-0.5 block">
                          {(t as any).project_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {renderEffortChip(t)}
                        {t.is_blocked && (
                          <span className="text-[11px] text-[#7B4B3A] bg-[#F3E7DD] border border-[#DFC2B0] px-2 py-0.5 rounded-[6px] font-semibold">
                            Blocked
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Other Backlog Tasks */}
            {otherTasks.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[15px] font-semibold text-[#33382F]">To Do &amp; In Review</h2>
                <div className="motion-surface rounded-[12px] overflow-hidden divide-y divide-[#EAE4D8]">
                  {otherTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-3.5 hover:bg-[#F7F4EC] transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#33382F] text-[13.5px] truncate group-hover:text-[#596D56] transition-colors">
                          {t.title}
                        </p>
                        <span className="text-[11.5px] text-[#70786D] mt-0.5 block">
                          {(t as any).project_name} · {(t as any).column_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {renderEffortChip(t)}
                        <PriorityBadge priority={t.priority} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignedTasks.length === 0 && (
              <div className="py-8 px-5 motion-surface rounded-[12px] text-[13.5px] text-[#5D655A]">
                No active tasks assigned to you right now.
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          columns={[]}
          members={workspaceMembers}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={loadMyWork}
        />
      )}
    </div>
  );
}
