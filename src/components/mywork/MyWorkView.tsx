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

  // Groupings
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
        className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
          isOver
            ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
            : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]'
        }`}
        title={est ? `${spent}h spent of ${est}h estimated` : `${spent}h spent`}
      >
        <Clock className="w-2.5 h-2.5" />
        <span>{spent}h</span>
        {est && (
          <>
            <span className="text-[#94A3B8]">/</span>
            <span>{est}h</span>
          </>
        )}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F8F9FB] p-6 md:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="pb-3 border-b border-[#E7E9ED]">
          <h1 className="text-sm font-bold text-[#20242B] tracking-tight">My Tasks</h1>
          <p className="text-xs text-[#6D7480]">
            Tasks assigned to {user?.name} or awaiting your unblocking input.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#6D7480]">Loading your tasks...</div>
        ) : (
          <div className="space-y-6">
            {/* 1. Blockers waiting on me */}
            {blockingMeTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#92400E]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B97828]" />
                  <span>Waiting On Your Action ({blockingMeTasks.length})</span>
                </div>
                <div className="bg-white border border-[#EFE9DF] rounded-xl overflow-hidden divide-y divide-[#FAF8F5] shadow-2xs">
                  {blockingMeTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-3 hover:bg-[#FAF8F5] transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#20242B] truncate">{t.title}</span>
                          <span className="text-[10px] text-[#6D7480] bg-[#F4F5F7] px-1.5 py-0.5 rounded">
                            {t.project_name}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#78350F] mt-0.5">
                          Blocked: &quot;{t.blocker_reason}&quot;
                        </p>
                      </div>
                      <span className="text-[11px] text-[#92400E] font-medium flex items-center gap-1 shrink-0">
                        <span>Resolve</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Due soon or overdue */}
            {overdueOrDueSoon.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-[#20242B]">Due Soon &amp; Overdue</h2>
                <div className="bg-white border border-[#E7E9ED] rounded-xl overflow-hidden divide-y divide-[#F4F5F7] shadow-2xs">
                  {overdueOrDueSoon.map((t) => {
                    const overdue = isOverdue(t.due_date, !!t.completed_at);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="p-3 hover:bg-[#F8F9FB] transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={t.priority} />
                            <p className="font-semibold text-[#20242B] truncate">{t.title}</p>
                          </div>
                          <span className="text-[10px] text-[#6D7480]">
                            {(t as any).project_name} · {(t as any).column_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {renderEffortChip(t)}
                          <span
                            className={`text-[11px] font-mono shrink-0 ${
                              overdue ? 'text-[#C54D4D] font-semibold' : 'text-[#6D7480]'
                            }`}
                            data-tabular-nums="true"
                          >
                            {overdue ? 'Overdue: ' : 'Due: '}
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
                <h2 className="text-xs font-semibold text-[#20242B]">In Progress</h2>
                <div className="bg-white border border-[#E7E9ED] rounded-xl overflow-hidden divide-y divide-[#F4F5F7] shadow-2xs">
                  {inProgressTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-3 hover:bg-[#F8F9FB] transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={t.priority} />
                          <p className="font-semibold text-[#20242B] truncate">{t.title}</p>
                        </div>
                        <span className="text-[10px] text-[#6D7480]">{(t as any).project_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {renderEffortChip(t)}
                        {t.is_blocked && (
                          <span className="text-[10px] text-[#B97828] bg-[#FEF3C7] px-1.5 py-0.5 rounded font-medium">
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
                <h2 className="text-xs font-semibold text-[#20242B]">Backlog &amp; Review</h2>
                <div className="bg-white border border-[#E7E9ED] rounded-xl overflow-hidden divide-y divide-[#F4F5F7] shadow-2xs">
                  {otherTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-3 hover:bg-[#F8F9FB] transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#20242B] truncate">{t.title}</p>
                        <span className="text-[10px] text-[#6D7480]">
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

            {assignedTasks.length === 0 && blockingMeTasks.length === 0 && (
              <div className="py-12 text-center space-y-1">
                <p className="text-xs font-semibold text-[#20242B]">No tasks assigned to you</p>
                <p className="text-[11px] text-[#6D7480]">
                  Tasks assigned to your account on any project board will appear here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        columns={[]}
        members={workspaceMembers}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadMyWork}
      />
    </div>
  );
}
