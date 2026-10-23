import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { useSearch } from '../../contexts/SearchContext.tsx';
import { getSocket } from '../../lib/socket.ts';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';
import type { MemberPulseItem } from '../../types/index.ts';
import {
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface TeamPulseWidgetProps {
  onSelectTask?: (taskId: string) => void;
  onFilterUser?: (userId: string) => void;
}

export function TeamPulseWidget({ onSelectTask, onFilterUser }: TeamPulseWidgetProps) {
  const { currentWorkspace } = useWorkspace();
  const { refreshKey } = useRealtime();
  const { selectedAssignee, setSelectedAssignee } = useSearch();

  const [members, setMembers] = useState<MemberPulseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  const loadTeamPulse = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await api.workspaces.getTeamPulse(currentWorkspace.id);
      setMembers(res.teamPulse || []);
    } catch (err) {
      console.error('Failed to load team pulse:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    loadTeamPulse();
  }, [loadTeamPulse, refreshKey]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onPulseUpdate = () => {
      loadTeamPulse();
    };

    socket.on('presence:update', onPulseUpdate);
    socket.on('task:created', onPulseUpdate);
    socket.on('task:updated', onPulseUpdate);
    socket.on('task:moved', onPulseUpdate);
    socket.on('blocker:created', onPulseUpdate);
    socket.on('blocker:resolved', onPulseUpdate);

    return () => {
      socket.off('presence:update', onPulseUpdate);
      socket.off('task:created', onPulseUpdate);
      socket.off('task:updated', onPulseUpdate);
      socket.off('task:moved', onPulseUpdate);
      socket.off('blocker:created', onPulseUpdate);
      socket.off('blocker:resolved', onPulseUpdate);
    };
  }, [loadTeamPulse]);

  const activeCount = members.filter((m) => m.is_online).length;
  const displayedMembers = filterActiveOnly ? members.filter((m) => m.is_online) : members;

  const handleMemberFilterClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedAssignee === userId) {
      setSelectedAssignee('all');
    } else {
      setSelectedAssignee(userId);
      onFilterUser?.(userId);
    }
  };

  return (
    <div className="bg-[#F7F4EC] rounded-[9px] overflow-hidden border border-[#DED8CB] transition-all">
      {/* Widget Header */}
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#EDE7DA] transition-colors select-none"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-3.5 h-3.5 text-[#596D56]" />
          <span className="text-[11.5px] font-semibold text-[#5D655A] uppercase tracking-[0.04em]">
            Team Members
          </span>
          <span
            className="text-[11px] px-1.5 py-0.2 rounded-[4px] font-medium bg-[#E3EBDD] text-[#33382F]"
            data-tabular-nums="true"
          >
            {members.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[#70786D]">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFilterActiveOnly((prev) => !prev);
              }}
              className={`rounded-[4px] text-[10.5px] px-1.5 py-0.5 transition-colors cursor-pointer font-medium ${
                filterActiveOnly
                  ? 'bg-[#E3EBDD] text-[#33382F]'
                  : 'hover:text-[#33382F] text-[#70786D]'
              }`}
              title={filterActiveOnly ? 'Show all members' : 'Filter to online only'}
            >
              {filterActiveOnly ? 'Online' : `${activeCount} online`}
            </button>
          )}
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="border-t border-[#EAE4D8] divide-y divide-[#EAE4D8] max-h-64 overflow-y-auto">
          {loading && members.length === 0 ? (
            <div className="p-3 text-center text-[11.5px] text-[#70786D]">
              Loading team members...
            </div>
          ) : displayedMembers.length === 0 ? (
            <div className="p-3 text-center text-[11.5px] text-[#70786D]">
              No members matching filter.
            </div>
          ) : (
            displayedMembers.map((m) => {
              const isExpanded = expandedUserId === m.user_id;
              const isFiltered = selectedAssignee === m.user_id;
              const primaryTask = m.primary_task;

              return (
                <div
                  key={m.user_id}
                  className={`transition-colors ${
                    isFiltered ? 'bg-[#E3EBDD]/60' : 'hover:bg-[#EDE7DA]/60'
                  }`}
                >
                  <div
                    className="px-3 py-2 flex items-start justify-between gap-2 cursor-pointer"
                    onClick={() => setExpandedUserId(isExpanded ? null : m.user_id)}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className="relative shrink-0 mt-0.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${getAvatarColor(
                            m.name
                          )}`}
                        >
                          {getInitials(m.name)}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-[#F7F4EC] ${
                            m.is_online ? 'bg-[#62866B]' : 'bg-[#B9A27C]'
                          }`}
                          title={m.is_online ? 'Online' : 'Offline'}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12.5px] font-semibold text-[#33382F] truncate">
                            {m.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {m.blocked_count > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded-[4px] bg-[#F3E7DD] text-[#A46F5C]"
                                title={`${m.blocked_count} blocked task(s)`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span data-tabular-nums="true">{m.blocked_count}</span>
                              </span>
                            )}
                            {m.active_task_count > 0 && (
                              <span
                                className="text-[10.5px] px-1.5 py-0.2 rounded-[4px] bg-[#EAE4D8] text-[#5D655A] font-medium"
                                data-tabular-nums="true"
                              >
                                {m.active_task_count}
                              </span>
                            )}
                          </div>
                        </div>

                        {primaryTask ? (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#5D655A] truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#78906F] shrink-0" />
                            <span className="truncate">{primaryTask.title}</span>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-[#70786D] truncate">
                            {m.focus_summary || m.title || 'Member'}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleMemberFilterClick(m.user_id, e)}
                      className={`p-1 rounded-[4px] transition-colors shrink-0 cursor-pointer ${
                        isFiltered
                          ? 'bg-[#596D56] text-[#FFFCF6]'
                          : 'text-[#70786D] hover:text-[#33382F] hover:bg-[#EDE7DA]'
                      }`}
                      title={isFiltered ? 'Clear member filter' : `Filter board to ${m.name}`}
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-2.5 pt-1 bg-[#F3EFE5] border-t border-[#EAE4D8] space-y-2 text-[11.5px]">
                      {primaryTask && (
                        <button
                          type="button"
                          onClick={() => onSelectTask?.(primaryTask.id)}
                          className="w-full text-left p-1.5 rounded-[6px] bg-[#FFFCF6] hover:bg-[#EDE7DA] border border-[#EAE4D8] flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
                        >
                          <span className="text-[12px] font-medium text-[#33382F] truncate">
                            {primaryTask.title}
                          </span>
                          <span className="text-[10.5px] text-[#70786D] shrink-0">
                            {primaryTask.column_name}
                          </span>
                        </button>
                      )}

                      {m.other_tasks && m.other_tasks.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10.5px] font-semibold text-[#70786D] uppercase tracking-wider block">
                            Other Assigned ({m.other_tasks.length})
                          </span>
                          {m.other_tasks.map((t) => (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() => onSelectTask?.(t.id)}
                              className="w-full text-left p-1.5 rounded-[6px] bg-[#FFFCF6] hover:bg-[#EDE7DA] border border-[#EAE4D8] flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
                            >
                              <span className="text-[12px] font-medium text-[#33382F] truncate">
                                {t.title}
                              </span>
                              <span className="text-[10.5px] text-[#70786D] shrink-0">
                                {t.column_name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
