import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { useSearch } from '../../contexts/SearchContext.tsx';
import { getSocket } from '../../lib/socket.ts';
import type { MemberPulseItem } from '../../types/index.ts';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Circle,
  ExternalLink,
  Filter,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';

interface TeamPulseWidgetProps {
  onSelectTask?: (taskId: string) => void;
  onFilterUser?: (userId: string) => void;
}

export function TeamPulseWidget({ onSelectTask, onFilterUser }: TeamPulseWidgetProps) {
  const { currentWorkspace, currentProject } = useWorkspace();
  const { refreshKey } = useRealtime();
  const { setSelectedAssignee, selectedAssignee } = useSearch();

  const [members, setMembers] = useState<MemberPulseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const loadTeamPulse = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const res = await api.workspaces.getTeamPulse(currentWorkspace.id);
      setMembers(res.teamPulse);
    } catch (err) {
      console.error('Failed to load team pulse:', err);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    loadTeamPulse();
  }, [loadTeamPulse, refreshKey]);

  // Listen for socket events for instant real-time pulse updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onPulseUpdate = () => {
      loadTeamPulse();
    };

    const onPresenceGlobal = (data: { onlineUserIds: string[] }) => {
      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          is_online: m.is_current_user || data.onlineUserIds.includes(m.user_id),
        }))
      );
    };

    socket.on('team:pulse:update', onPulseUpdate);
    socket.on('presence:global', onPresenceGlobal);
    socket.on('presence:update', onPulseUpdate);
    socket.on('task:created', onPulseUpdate);
    socket.on('task:updated', onPulseUpdate);
    socket.on('task:moved', onPulseUpdate);
    socket.on('blocker:created', onPulseUpdate);
    socket.on('blocker:resolved', onPulseUpdate);

    return () => {
      socket.off('team:pulse:update', onPulseUpdate);
      socket.off('presence:global', onPresenceGlobal);
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
    <div className="bg-white border border-[#E7E9ED] rounded-xl shadow-2xs overflow-hidden transition-all">
      {/* Widget Header */}
      <div
        className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#F8F9FB] transition-colors select-none"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-[#5965D8]" />
            {activeCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] absolute -top-0.5 -right-0.5 animate-pulse" />
            )}
          </div>
          <span className="text-[11px] font-bold text-[#20242B] tracking-tight uppercase">
            Team Pulse
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]"
            title={`${activeCount} of ${members.length} team members currently online`}
          >
            {activeCount} active
          </span>
        </div>

        <div className="flex items-center gap-1 text-[#9CA3AF]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFilterActiveOnly((prev) => !prev);
            }}
            className={`p-0.5 rounded text-[10px] px-1 transition-colors cursor-pointer ${
              filterActiveOnly
                ? 'bg-[#20242B] text-white font-semibold'
                : 'hover:text-[#20242B] text-[#9CA3AF]'
            }`}
            title={filterActiveOnly ? 'Show all members' : 'Filter to online only'}
          >
            {filterActiveOnly ? 'Online' : 'All'}
          </button>

          {isCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {/* Widget Body */}
      {!isCollapsed && (
        <div className="p-2 pt-0 space-y-2 border-t border-[#F4F5F7] max-h-72 overflow-y-auto">
          {displayedMembers.length === 0 ? (
            <div className="p-3 text-center text-[11px] text-[#9CA3AF] italic">
              {filterActiveOnly ? 'No teammates currently active.' : 'No members in workspace.'}
            </div>
          ) : (
            displayedMembers.map((member) => {
              const isFiltered = selectedAssignee === member.user_id;
              const isExpanded = expandedMemberId === member.user_id;
              const hasFocusTask = !!member.primary_task;
              const isBlocked = member.focus_status === 'blocked';

              return (
                <div
                  key={member.user_id}
                  className={`p-2 rounded-lg border transition-all text-xs space-y-1.5 ${
                    isFiltered
                      ? 'bg-[#EEF0FF] border-[#CBD2FB] ring-1 ring-[#5965D8]/20'
                      : member.is_online
                      ? 'bg-white hover:bg-[#F8F9FB] border-[#E7E9ED]'
                      : 'bg-[#F9FAFB]/70 border-[#E7E9ED]/60 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Member Identity & Status Header */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Avatar with live presence beacon */}
                      <div className="relative shrink-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 ring-white ${getAvatarColor(
                            member.name
                          )}`}
                          title={member.name}
                        >
                          {getInitials(member.name)}
                        </span>
                        {/* Real-time Presence Dot */}
                        <span
                          className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 ring-1.5 ring-white ${
                            member.is_online
                              ? 'bg-[#16A34A]'
                              : 'bg-[#9CA3AF]'
                          }`}
                          title={member.is_online ? 'Active now' : 'Offline'}
                        />
                      </div>

                      {/* Name & Title */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 leading-tight">
                          <span className="font-semibold text-[11px] text-[#20242B] truncate max-w-[105px]">
                            {member.name}
                          </span>
                          {member.is_current_user && (
                            <span className="text-[9px] font-mono font-medium text-[#5965D8] bg-[#EEF0FF] px-1 rounded">
                              you
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#6D7480] truncate block leading-tight">
                          {member.title}
                        </span>
                      </div>
                    </div>

                    {/* Filter by this member button */}
                    <button
                      type="button"
                      onClick={(e) => handleMemberFilterClick(member.user_id, e)}
                      className={`p-1 rounded text-[10px] transition-colors cursor-pointer shrink-0 ${
                        isFiltered
                          ? 'bg-[#5965D8] text-white font-semibold'
                          : 'text-[#9CA3AF] hover:text-[#20242B] hover:bg-[#EAECEF]'
                      }`}
                      title={isFiltered ? 'Clear filter' : `Filter board to ${member.name}'s tasks`}
                      aria-label={`Filter by ${member.name}`}
                    >
                      <Filter className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Current Focus Area Badge / Card */}
                  <div className="pt-0.5">
                    {hasFocusTask && member.primary_task ? (
                      <div
                        onClick={() => onSelectTask?.(member.primary_task!.id)}
                        className={`group/task p-1.5 rounded-md border text-left transition-colors cursor-pointer space-y-0.5 ${
                          isBlocked
                            ? 'bg-[#FFF7ED] border-[#FED7AA] hover:border-[#FDBA74]'
                            : member.focus_status === 'reviewing'
                            ? 'bg-[#FAF5FF] border-[#E9D5FF] hover:border-[#D8B4FE]'
                            : 'bg-[#F8F9FB] border-[#E7E9ED] hover:border-[#CBD2FB]'
                        }`}
                        title="Click to view task details"
                      >
                        {/* Focus tag label */}
                        <div className="flex items-center justify-between text-[10px] leading-none">
                          <span
                            className={`flex items-center gap-1 font-semibold ${
                              isBlocked
                                ? 'text-[#C2410C]'
                                : member.focus_status === 'reviewing'
                                ? 'text-[#7E22CE]'
                                : 'text-[#434DB7]'
                            }`}
                          >
                            {isBlocked ? (
                              <AlertTriangle className="w-2.5 h-2.5 text-[#EA580C] shrink-0" />
                            ) : (
                              <Zap className="w-2.5 h-2.5 text-[#5965D8] shrink-0" />
                            )}
                            <span className="uppercase tracking-wider">
                              {isBlocked
                                ? 'Blocked'
                                : member.focus_status === 'reviewing'
                                ? 'Reviewing'
                                : 'Working On'}
                            </span>
                          </span>

                          <span className="text-[9px] font-mono text-[#9CA3AF] shrink-0">
                            {member.primary_task.column_name}
                          </span>
                        </div>

                        {/* Task Title */}
                        <div className="font-medium text-[11px] text-[#20242B] line-clamp-1 group-hover/task:text-[#5965D8] group-hover/task:underline">
                          {member.primary_task.title}
                        </div>

                        {/* Blocker reason if blocked */}
                        {isBlocked && member.primary_task.blocker_reason && (
                          <div className="text-[10px] text-[#9A3412] line-clamp-1 italic">
                            &bull; {member.primary_task.blocker_reason}
                          </div>
                        )}

                        {/* Project Name subtext */}
                        <div className="text-[9px] text-[#9CA3AF] truncate">
                          {member.primary_task.project_name}
                        </div>
                      </div>
                    ) : member.focus_status === 'completed' ? (
                      <div className="p-1 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] text-[#15803D] flex items-center gap-1 font-medium truncate">
                        <Sparkles className="w-2.5 h-2.5 text-[#16A34A] shrink-0" />
                        <span className="truncate">{member.focus_summary}</span>
                      </div>
                    ) : (
                      <div className="p-1 rounded bg-[#F8F9FB] border border-[#E7E9ED]/60 text-[10px] text-[#9CA3AF] flex items-center gap-1 italic">
                        <Circle className="w-1.5 h-1.5 text-[#D1D5DB] shrink-0" />
                        <span>Available / Open for tasks</span>
                      </div>
                    )}
                  </div>

                  {/* Queued tasks indicator (if multiple assigned) */}
                  {member.active_task_count > 1 && (
                    <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMemberId(isExpanded ? null : member.user_id)
                        }
                        className="flex items-center gap-1 hover:text-[#20242B] transition-colors cursor-pointer"
                      >
                        <Layers className="w-2.5 h-2.5 text-[#9CA3AF]" />
                        <span>
                          +{member.active_task_count - 1} more in queue
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-2.5 h-2.5" />
                        ) : (
                          <ChevronDown className="w-2.5 h-2.5" />
                        )}
                      </button>

                      {member.in_progress_count > 1 && (
                        <span className="font-mono text-[9px] text-[#5965D8]">
                          {member.in_progress_count} in-progress
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded list of other assigned tasks */}
                  {isExpanded && member.other_tasks && member.other_tasks.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[#F4F5F7] text-[10px]">
                      {member.other_tasks.map((ot) => (
                        <div
                          key={ot.id}
                          onClick={() => onSelectTask?.(ot.id)}
                          className="flex items-center justify-between gap-1 p-1 rounded bg-[#F8F9FB] hover:bg-white hover:border-[#CBD2FB] border border-transparent transition-colors cursor-pointer"
                        >
                          <span className="truncate text-[#4B5563] hover:underline">
                            {ot.title}
                          </span>
                          <span className="text-[9px] font-mono text-[#9CA3AF] shrink-0">
                            {ot.column_name}
                          </span>
                        </div>
                      ))}
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
