import React, { useState, useEffect, useCallback } from 'react';
import type { TaskDecision } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import {
  formatDate,
  formatRelativeTime,
} from '../../lib/utils.ts';
import { FileCheck, ArrowRight, Search } from 'lucide-react';

export function DecisionsView() {
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
      <div className="flex-1 flex items-center justify-center p-8 text-[#6D7480] text-xs">
        Select a project to view its decision register.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F8F9FB] p-6 md:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E9ED]">
          <div>
            <h1 className="text-sm font-bold text-[#20242B] tracking-tight">Decision Notes</h1>
            <p className="text-xs text-[#6D7480]">
              Agreed outcomes and rationales recorded across tasks.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search decisions..."
              className="text-xs bg-white border border-[#E7E9ED] rounded-lg pl-8 pr-2.5 py-1 text-[#20242B] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#5965D8] w-48 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-xs text-[#6D7480]">Loading decisions...</div>
        ) : filteredDecisions.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-xs font-semibold text-[#20242B]">No decision notes recorded</p>
            <p className="text-[11px] text-[#6D7480]">
              Decisions agreed in task discussions can be converted or recorded directly inside tasks.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E7E9ED] rounded-xl overflow-hidden divide-y divide-[#F4F5F7] shadow-2xs">
            {filteredDecisions.map((dec) => (
              <div key={dec.id} className="p-4 hover:bg-[#F8F9FB] transition-colors space-y-2 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-[#20242B] text-xs leading-snug">
                      {dec.title}
                    </h2>
                    {dec.task_title && (
                      <button
                        type="button"
                        onClick={() => setSelectedTaskId(dec.task_id)}
                        className="text-[11px] text-[#6D7480] hover:text-[#5965D8] flex items-center gap-1 mt-0.5 hover:underline"
                      >
                        <span>Task: {dec.task_title}</span>
                        <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] shrink-0 font-mono" data-tabular-nums="true">
                    {formatRelativeTime(dec.created_at)}
                  </span>
                </div>

                <p className="text-xs text-[#20242B] leading-relaxed">
                  <span className="font-medium text-[#6D7480]">Agreement: </span>
                  {dec.summary}
                </p>

                {dec.rationale && (
                  <p className="text-[11px] text-[#6D7480] leading-relaxed">
                    <span className="font-medium text-[#9CA3AF]">Rationale: </span>
                    {dec.rationale}
                  </p>
                )}

                <div className="text-[11px] text-[#9CA3AF] pt-1">
                  Decided by {dec.author_name} · {formatDate(dec.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        columns={[]}
        members={workspaceMembers}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadDecisions}
      />
    </div>
  );
}
