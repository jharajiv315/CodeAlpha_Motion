import React, { useState, useEffect, useCallback } from 'react';
import type { TaskBlocker } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { ResolveBlockerModal } from './ResolveBlockerModal.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import {
  formatRelativeTime,
  getBlockerAgeDays,
} from '../../lib/utils.ts';
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  ArrowLeft,
} from 'lucide-react';

interface BlockerRadarViewProps {
  onNavigateTab?: (tab: 'board' | 'blockers' | 'decisions' | 'mywork') => void;
}

export function BlockerRadarView({ onNavigateTab }: BlockerRadarViewProps) {
  const { currentProject, workspaceMembers } = useWorkspace();
  const { refreshKey } = useRealtime();

  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved'>('active');
  const [blockers, setBlockers] = useState<TaskBlocker[]>([]);
  const [loading, setLoading] = useState(false);

  const [resolvingBlocker, setResolvingBlocker] = useState<TaskBlocker | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadBlockers = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.blockers.listByProject(currentProject.id, statusFilter);
      setBlockers(res.blockers);
    } catch (err) {
      console.error('Failed to load blockers:', err);
    } finally {
      setLoading(false);
    }
  }, [currentProject, statusFilter]);

  useEffect(() => {
    loadBlockers();
  }, [loadBlockers, refreshKey]);

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-[#70786D] text-[13px]">
        Select a project to view its blockers.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-5">
        {/* Top breadcrumb & header per design.md Section 7.1 */}
        <div className="space-y-3 pb-4 border-b border-[#DED8CB]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px] text-[#70786D]">
              <span>Projects</span>
              <span>/</span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('board')}
                className="hover:text-[#33382F] transition-colors cursor-pointer"
              >
                {currentProject.name}
              </button>
              <span>/</span>
              <span className="text-[#33382F] font-medium">Blockers</span>
            </div>

            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('board')}
                className="btn-tertiary px-2.5 py-1 text-[12.5px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Board</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-bold text-[#33382F] tracking-[-0.02em]">
                Blockers
              </h1>
              <p className="text-[13.5px] text-[#5D655A] mt-0.5">
                Tasks waiting on a decision, dependency, or resource.
              </p>
            </div>

            {/* Simple Active / Resolved tabs with counts */}
            <div className="flex items-center gap-1 bg-[#F3EFE5] p-1 rounded-[9px] border border-[#DED8CB] self-start">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'active'
                    ? 'bg-[#FFFCF6] text-[#33382F] font-semibold shadow-2xs border border-[#DED8CB]/60'
                    : 'text-[#5D655A] hover:text-[#33382F]'
                }`}
              >
                <span>Active</span>
                {statusFilter === 'active' && (
                  <span className="text-[11px] px-1.5 py-0.2 rounded-[4px] bg-[#F3E7DD] text-[#7B4B3A] font-semibold" data-tabular-nums="true">
                    {blockers.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'resolved'
                    ? 'bg-[#FFFCF6] text-[#33382F] font-semibold shadow-2xs border border-[#DED8CB]/60'
                    : 'text-[#5D655A] hover:text-[#33382F]'
                }`}
              >
                <span>Resolved</span>
                {statusFilter === 'resolved' && (
                  <span className="text-[11px] px-1.5 py-0.2 rounded-[4px] bg-[#E6EEE4] text-[#35513A] font-semibold" data-tabular-nums="true">
                    {blockers.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-10 text-[13px] text-[#70786D]">Loading blockers...</div>
        ) : blockers.length === 0 ? (
          <div className="py-8 px-5 motion-surface rounded-[12px] text-[13.5px] text-[#5D655A]">
            {statusFilter === 'active'
              ? 'No active blockers. Tasks marked blocked will appear here.'
              : 'No resolved blockers recorded yet.'}
          </div>
        ) : (
          <div className="motion-surface rounded-[12px] overflow-hidden divide-y divide-[#EAE4D8]">
            {blockers.map((b) => (
              <div
                key={b.id}
                className="p-4 hover:bg-[#F7F4EC] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Task & Blocker reason */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: b.is_resolved ? '#62866B' : '#A46F5C' }}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(b.task_id)}
                      className="font-semibold text-[#33382F] hover:text-[#596D56] hover:underline text-left truncate text-[14px] cursor-pointer"
                    >
                      {b.task_title}
                    </button>
                    <PriorityBadge priority={b.task_priority || 'MEDIUM'} />
                    {b.column_name && (
                      <span className="text-[11.5px] text-[#5D655A] bg-[#F3EFE5] px-2 py-0.5 rounded-[6px] border border-[#DED8CB] font-medium">
                        {b.column_name}
                      </span>
                    )}
                    {!b.is_resolved && (
                      <span
                        className="text-[11.5px] text-[#7B4B3A] bg-[#F3E7DD] px-2 py-0.5 rounded-[6px] font-medium"
                        data-tabular-nums="true"
                      >
                        {getBlockerAgeDays(b.created_at)}
                      </span>
                    )}
                  </div>

                  <div className="text-[13px] text-[#33382F] leading-relaxed pl-4 border-l-2 border-[#A46F5C]">
                    <span className="font-semibold text-[#7B4B3A]">Reason: </span>
                    {b.reason}
                  </div>

                  {b.is_resolved && b.resolution_note && (
                    <div className="text-[12.5px] text-[#35513A] bg-[#E6EEE4] rounded-[6px] px-3 py-2 leading-relaxed">
                      <span className="font-semibold">Resolved: </span>
                      {b.resolution_note}
                      <span className="text-[#5D655A] ml-1.5">
                        ({b.resolved_by_name} · {formatRelativeTime(b.resolved_at)})
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Waiting on & Resolve button */}
                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#EAE4D8]">
                  <div className="text-left md:text-right text-[12px] text-[#70786D]">
                    {b.waiting_on_name ? (
                      <span>
                        Waiting on <strong className="text-[#33382F] font-semibold">{b.waiting_on_name}</strong>
                      </span>
                    ) : (
                      <span>Unassigned owner</span>
                    )}
                  </div>

                  {!b.is_resolved ? (
                    <button
                      type="button"
                      onClick={() => setResolvingBlocker(b)}
                      className="btn-primary px-3 py-1.5 text-[12.5px] rounded-[9px] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#35513A] font-medium flex items-center gap-1 bg-[#E6EEE4] px-2.5 py-1 rounded-[6px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#62866B]" />
                      <span>Resolved</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
