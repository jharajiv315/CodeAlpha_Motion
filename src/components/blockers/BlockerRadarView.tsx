import React, { useState, useEffect, useCallback } from 'react';
import type { TaskBlocker } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { ResolveBlockerModal } from './ResolveBlockerModal.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import {
  formatDate,
  formatRelativeTime,
  getBlockerAgeDays,
  getAvatarColor,
  getInitials,
} from '../../lib/utils.ts';
import {
  AlertTriangle,
  CheckCircle2,
  Check,
} from 'lucide-react';

export function BlockerRadarView() {
  const { currentProject, workspaceMembers } = useWorkspace();
  const { refreshKey } = useRealtime();

  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved'>('active');
  const [blockers, setBlockers] = useState<TaskBlocker[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [resolvingBlocker, setResolvingBlocker] = useState<TaskBlocker | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadBlockers = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.blockers.listByProject(currentProject.id, statusFilter);
      setBlockers(res.blockers);
    } catch (err) {
      console.error('Failed to load blocker radar data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusFilter]);

  useEffect(() => {
    loadBlockers();
  }, [loadBlockers, refreshKey]);

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-[#6D7480] text-xs">
        Select a project to view its active blockers.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F8F9FB] p-6 md:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-4">
        {/* Header with quiet tab switcher */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E9ED]">
          <div>
            <h1 className="text-sm font-bold text-[#20242B] tracking-tight">Blocker Radar</h1>
            <p className="text-xs text-[#6D7480]">
              Operational obstacles requiring team intervention.
            </p>
          </div>

          {/* Quiet tab toggle */}
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-[#20242B] font-semibold shadow-2xs border border-[#E7E9ED]'
                  : 'text-[#6D7480] hover:text-[#20242B]'
              }`}
            >
              Active ({statusFilter === 'active' ? blockers.length : 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('resolved')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'resolved'
                  ? 'bg-white text-[#20242B] font-semibold shadow-2xs border border-[#E7E9ED]'
                  : 'text-[#6D7480] hover:text-[#20242B]'
              }`}
            >
              Resolved History
            </button>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="p-8 text-center text-xs text-[#6D7480]">Loading blockers...</div>
        ) : blockers.length === 0 ? (
          /* Restrained, elegant empty state (No oversized card, no marketing essay!) */
          <div className="py-12 text-center space-y-1">
            <p className="text-xs font-semibold text-[#20242B]">
              {statusFilter === 'active' ? 'No active blockers' : 'No resolved blockers archived'}
            </p>
            <p className="text-[11px] text-[#6D7480]">
              {statusFilter === 'active'
                ? 'Tasks marked as blocked on the board will appear here for team attention.'
                : 'Resolved blocker records will be catalogued here.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E7E9ED] rounded-xl overflow-hidden divide-y divide-[#F4F5F7] shadow-2xs">
            {blockers.map((b) => (
              <div
                key={b.id}
                className="p-3.5 hover:bg-[#F8F9FB] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                {/* Left: Task & Obstacle details */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PriorityBadge priority={b.task_priority || 'MEDIUM'} />
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(b.task_id)}
                      className="font-semibold text-[#20242B] hover:text-[#5965D8] hover:underline text-left truncate"
                    >
                      {b.task_title}
                    </button>
                    <span className="text-[10px] text-[#6D7480] bg-[#F4F5F7] px-1.5 py-0.5 rounded">
                      {b.column_name}
                    </span>
                    {!b.is_resolved && (
                      <span className="text-[10px] text-[#B97828] font-mono" data-tabular-nums="true">
                        {getBlockerAgeDays(b.created_at)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#20242B] leading-relaxed">
                    <span className="font-medium text-[#B97828]">Obstacle: </span>
                    {b.reason}
                  </p>

                  {b.is_resolved && b.resolution_note && (
                    <p className="text-[11px] text-[#238565] leading-relaxed">
                      <span className="font-medium">Resolution: </span>
                      {b.resolution_note}
                      <span className="text-[#6D7480] ml-1">
                        (by {b.resolved_by_name} · {formatRelativeTime(b.resolved_at)})
                      </span>
                    </p>
                  )}
                </div>

                {/* Right: Waiting on & Action */}
                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#F4F5F7]">
                  <div className="text-left md:text-right text-[11px] text-[#6D7480]">
                    {b.waiting_on_name ? (
                      <span className="inline-flex items-center gap-1">
                        <span>Waiting on</span>
                        <span className="font-semibold text-[#20242B]">{b.waiting_on_name}</span>
                      </span>
                    ) : (
                      <span>Waiting on team</span>
                    )}
                  </div>

                  {!b.is_resolved ? (
                    <button
                      type="button"
                      onClick={() => setResolvingBlocker(b)}
                      className="px-2.5 py-1 text-xs bg-[#238565] hover:bg-[#1E7357] text-white font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Resolve</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#238565] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Resolved</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve Blocker Modal */}
      {resolvingBlocker && (
        <ResolveBlockerModal
          taskId={resolvingBlocker.task_id}
          taskTitle={resolvingBlocker.task_title || ''}
          blockerReason={resolvingBlocker.reason}
          isOpen={!!resolvingBlocker}
          onClose={() => setResolvingBlocker(null)}
          onSuccess={() => {
            setResolvingBlocker(null);
            loadBlockers();
          }}
        />
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        columns={[]}
        members={workspaceMembers}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadBlockers}
      />
    </div>
  );
}
