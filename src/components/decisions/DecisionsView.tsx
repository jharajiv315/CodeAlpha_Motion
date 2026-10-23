import React, { useState, useEffect, useCallback } from 'react';
import type { TaskDecision } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import { formatRelativeTime } from '../../lib/utils.ts';
import { ArrowRight, Search, ArrowLeft } from 'lucide-react';

interface DecisionsViewProps {
  onNavigateTab?: (tab: 'board' | 'blockers' | 'decisions' | 'mywork') => void;
}

export function DecisionsView({ onNavigateTab }: DecisionsViewProps) {
  const { currentProject, workspaceMembers } = useWorkspace();
  const { refreshKey } = useRealtime();

  const [decisions, setDecisions] = useState<TaskDecision[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadDecisions = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await api.decisions.listByProject(currentProject.id);
      setDecisions(res.decisions);
    } catch (err) {
      console.error('Failed to load decisions:', err);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions, refreshKey]);

  const filteredDecisions = decisions.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      d.title.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q) ||
      (d.rationale || '').toLowerCase().includes(q) ||
      d.author_name.toLowerCase().includes(q)
    );
  });

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-[#70786D] text-[13px]">
        Select a project to view its decisions.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-5">
        {/* Header per design.md Section 7.2 */}
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
              <span className="text-[#33382F] font-medium">Decisions</span>
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
              <div className="flex items-center gap-2.5">
                <h1 className="text-[24px] font-bold text-[#33382F] tracking-[-0.02em]">
                  Decisions
                </h1>
                <span
                  className="text-[12px] font-semibold text-[#5D655A] bg-[#F3EFE5] px-2 py-0.5 rounded-[6px] border border-[#DED8CB]"
                  data-tabular-nums="true"
                >
                  {decisions.length}
                </span>
              </div>
              <p className="text-[13.5px] text-[#5D655A] mt-0.5">
                Architectural choices, product agreements, and rationale linked to tasks.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#70786D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search decisions..."
                className="text-[13px] motion-input rounded-[9px] pl-8 pr-3 py-1.5 w-56 focus:w-64 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-10 text-[13px] text-[#70786D]">Loading decisions...</div>
        ) : filteredDecisions.length === 0 ? (
          <div className="py-8 px-5 motion-surface rounded-[12px] text-[13.5px] text-[#5D655A]">
            No decisions recorded yet. Decisions can be logged inside any task or promoted from a comment.
          </div>
        ) : (
          <div className="motion-surface rounded-[12px] overflow-hidden divide-y divide-[#EAE4D8]">
            {filteredDecisions.map((dec) => (
              <div key={dec.id} className="p-5 hover:bg-[#F7F4EC] transition-colors space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-semibold text-[#33382F] text-[15px] leading-snug">
                      {dec.title}
                    </h2>
                    {dec.task_title && (
                      <button
                        type="button"
                        onClick={() => setSelectedTaskId(dec.task_id)}
                        className="text-[12px] text-[#596D56] hover:text-[#465A44] inline-flex items-center gap-1 hover:underline font-medium cursor-pointer"
                      >
                        <span>Task: {dec.task_title}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <span className="text-[11.5px] text-[#70786D] shrink-0" data-tabular-nums="true">
                    {formatRelativeTime(dec.created_at)}
                  </span>
                </div>

                <div className="text-[13.5px] text-[#33382F] leading-relaxed bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px] px-3.5 py-2.5">
                  <span className="font-semibold text-[#5D655A]">Outcome: </span>
                  {dec.summary}
                </div>

                {dec.rationale && (
                  <p className="text-[13px] text-[#5D655A] leading-relaxed">
                    <span className="font-semibold text-[#70786D]">Rationale: </span>
                    {dec.rationale}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11.5px] text-[#70786D] pt-1">
                  <span>
                    Recorded by <strong className="text-[#33382F] font-medium">{dec.author_name}</strong>
                  </span>
                  {dec.source_comment_id && (
                    <span className="text-[11px] text-[#5D655A] bg-[#F3EFE5] px-2 py-0.5 rounded-[6px] border border-[#DED8CB]">
                      Promoted from comment
                    </span>
                  )}
                </div>
              </div>
            ))}
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
          onTaskUpdated={loadDecisions}
        />
      )}
    </div>
  );
}
