import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { useSearch } from '../../contexts/SearchContext.tsx';
import { KanbanColumn } from './KanbanColumn.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import { CreateTaskModal } from '../task/CreateTaskModal.tsx';
import { TimelineGanttView } from './TimelineGanttView.tsx';
import { ArchiveDrawer } from './ArchiveDrawer.tsx';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard.tsx';
import {
  Plus,
  Search,
  AlertTriangle,
  RotateCcw,
  Kanban,
  Rows,
  Calendar,
  Archive,
  ChevronDown,
  ChevronRight,
  Flag,
  Users,
  FileCheck,
} from 'lucide-react';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';

type ViewMode = 'board' | 'swimlanes' | 'timeline';
type SwimlaneGroupBy = 'assignee' | 'priority';

interface KanbanBoardProps {
  onNavigateTab?: (tab: 'board' | 'blockers' | 'decisions' | 'mywork') => void;
  onOpenInvite?: () => void;
}

export function KanbanBoard({ onNavigateTab, onOpenInvite }: KanbanBoardProps) {
  const { currentProject, workspaceMembers } = useWorkspace();
  const { refreshKey } = useRealtime();
  const {
    searchQuery,
    setSearchQuery,
    selectedAssignee,
    setSelectedAssignee,
    selectedPriority,
    setSelectedPriority,
    onlyBlocked,
    setOnlyBlocked,
    resetFilters,
    hasActiveFilters,
  } = useSearch();

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [swimlaneGroupBy, setSwimlaneGroupBy] = useState<SwimlaneGroupBy>('assignee');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});

  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetColumnForCreate, setTargetColumnForCreate] = useState<string | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadBoardData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [colRes, taskRes] = await Promise.all([
        api.projects.getColumns(currentProject.id),
        api.tasks.listByProject(currentProject.id),
      ]);
      setColumns(colRes.columns);
      setTasks(taskRes.tasks);
    } catch (err) {
      console.error('Failed to load board data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData, refreshKey]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        const matchesAssignee = t.assignees?.some((a) =>
          a.name.toLowerCase().includes(q)
        );
        const matchesPriority = (t.priority || '').toLowerCase().includes(q);
        const matchesBlockerReason = t.activeBlocker?.reason
          ?.toLowerCase()
          .includes(q);
        const matchesWaitingOn = t.activeBlocker?.waiting_on_name
          ?.toLowerCase()
          .includes(q);

        if (
          !matchesTitle &&
          !matchesDesc &&
          !matchesAssignee &&
          !matchesPriority &&
          !matchesBlockerReason &&
          !matchesWaitingOn
        ) {
          return false;
        }
      }

      if (selectedAssignee !== 'all') {
        const hasAssignee = t.assignees?.some(
          (a) => a.user_id === selectedAssignee
        );
        if (!hasAssignee) return false;
      }

      if (selectedPriority !== 'all') {
        const normPriority = (t.priority || 'MEDIUM').toUpperCase();
        if (normPriority !== selectedPriority) {
          return false;
        }
      }

      if (onlyBlocked && !t.is_blocked) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedAssignee, selectedPriority, onlyBlocked]);

  // Real project completion & blocker counts
  const projectStats = useMemo(() => {
    const total = tasks.length;
    const doneColIds = columns
      .filter((c) => c.name.toLowerCase().includes('done'))
      .map((c) => c.id);
    const completed = tasks.filter(
      (t) => !!t.completed_at || doneColIds.includes(t.column_id)
    ).length;
    const blocked = tasks.filter((t) => t.is_blocked).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, blocked, pct };
  }, [tasks, columns]);

  interface SwimlaneGroup {
    id: string;
    title: string;
    subtitle?: string;
    avatarName?: string;
    tasks: Task[];
  }

  const swimlanes = useMemo<SwimlaneGroup[]>(() => {
    if (viewMode !== 'swimlanes') return [];

    if (swimlaneGroupBy === 'assignee') {
      const groups: SwimlaneGroup[] = [];

      workspaceMembers.forEach((member) => {
        const memberTasks = filteredTasks.filter((t) =>
          t.assignees.some((a) => a.user_id === member.user_id)
        );
        groups.push({
          id: member.user_id,
          title: member.name,
          subtitle: member.title || member.role.toLowerCase(),
          avatarName: member.name,
          tasks: memberTasks,
        });
      });

      const unassignedTasks = filteredTasks.filter((t) => !t.assignees || t.assignees.length === 0);
      if (unassignedTasks.length > 0) {
        groups.push({
          id: 'unassigned',
          title: 'Unassigned',
          subtitle: 'Tasks without owners',
          tasks: unassignedTasks,
        });
      }

      return groups;
    } else {
      const priorities: ('HIGH' | 'MEDIUM' | 'LOW')[] = ['HIGH', 'MEDIUM', 'LOW'];
      return priorities.map((p) => {
        const pTasks = filteredTasks.filter((t) => (t.priority || 'MEDIUM').toUpperCase() === p);
        return {
          id: p,
          title: `${p.charAt(0) + p.slice(1).toLowerCase()} Priority`,
          subtitle: `${pTasks.length} tasks`,
          tasks: pTasks,
        };
      });
    }
  }, [viewMode, swimlaneGroupBy, filteredTasks, workspaceMembers]);

  const toggleSwimlaneCollapse = (swimlaneId: string) => {
    setCollapsedSwimlanes((prev) => ({
      ...prev,
      [swimlaneId]: !prev[swimlaneId],
    }));
  };

  const handleOpenDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsDetailOpen(true);
  };

  const handleQuickAddTask = (columnId: string) => {
    setTargetColumnForCreate(columnId);
    setIsCreateModalOpen(true);
  };

  const handleMoveToColumn = async (taskId: string, targetColId: string) => {
    if (!currentProject) return;
    const originalTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column_id: targetColId } : t))
    );

    try {
      await api.tasks.move(taskId, targetColId, 0);
    } catch (err) {
      console.error('Move failed, rolling back:', err);
      setTasks(originalTasks);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveDragTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    const overCol = columns.find((c) => c.id === overId);
    const overTask = tasks.find((t) => t.id === overId);
    const targetColId = overCol ? overCol.id : overTask?.column_id;

    if (!targetColId) return;

    if (activeTask.column_id !== targetColId) {
      setTasks((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        const overIndex = overTask ? prev.findIndex((t) => t.id === overId) : prev.length;
        if (activeIndex === -1) return prev;

        const updated = [...prev];
        const [moved] = updated.splice(activeIndex, 1);
        const updatedTask = { ...moved, column_id: targetColId };

        const insertIndex = overIndex >= 0 ? overIndex : updated.length;
        updated.splice(insertIndex, 0, updatedTask);
        return updated;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTask(null);
    if (!over || !currentProject) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const currentTask = tasks.find((t) => t.id === activeId);
    if (!currentTask) return;

    const overCol = columns.find((c) => c.id === overId);
    const overTask = tasks.find((t) => t.id === overId);
    const targetColId = overCol ? overCol.id : overTask?.column_id || currentTask.column_id;

    if (!targetColId) return;

    const colTasks = tasks.filter((t) => t.column_id === targetColId);
    const oldIndex = colTasks.findIndex((t) => t.id === activeId);
    let newIndex = overTask ? colTasks.findIndex((t) => t.id === overId) : colTasks.length - 1;
    if (newIndex < 0) newIndex = 0;

    let reorderedColTasks = colTasks;
    if (oldIndex !== -1 && oldIndex !== newIndex) {
      reorderedColTasks = arrayMove(colTasks, oldIndex, newIndex);
    }

    const reorderedTaskIds = reorderedColTasks.map((t) => t.id);

    setTasks((prev) => {
      const otherColTasks = prev.filter((t) => t.column_id !== targetColId && t.id !== activeId);
      return [...otherColTasks, ...reorderedColTasks];
    });

    try {
      await api.tasks.reorder(currentProject.id, targetColId, reorderedTaskIds);
    } catch (err) {
      console.error('Failed to persist task reorder:', err);
      loadBoardData();
    }
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-[#70786D] text-[13.5px]">
        Select a project from the sidebar to view its board.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F7F4EC] animate-view-in">
      {/* Project Context Header (Pickolab reference-inspired) */}
      <div className="px-6 md:px-8 pt-5 pb-0 border-b border-[#DED8CB] bg-[#F7F4EC] shrink-0">
        {/* 1. Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[12px] text-[#70786D] mb-2">
          <span>Projects</span>
          <span aria-hidden="true">/</span>
          <span className="text-[#33382F] font-medium">{currentProject.name}</span>
        </div>

        {/* 2. Project Title, Status Chip, and Contextual Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#33382F] leading-[1.2] tracking-tight">
                {currentProject.name}
              </h1>
              {projectStats.blocked > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('blockers')}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-[6px] bg-[#F3E7DD] text-[#A46F5C] hover:bg-[#EBDDD0] transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A46F5C]" />
                  <span>{projectStats.blocked} Blocked</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-[6px] bg-[#E3EBDD] text-[#465A44]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#596D56]" />
                  <span>Active</span>
                </span>
              )}
            </div>
            {currentProject.description && (
              <p className="text-[13.5px] text-[#5D655A] line-clamp-2 max-w-2xl">
                {currentProject.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenInvite && (
              <button
                type="button"
                onClick={onOpenInvite}
                className="px-3 py-2 btn-secondary flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#5D655A]" />
                <span>Invite</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              className="px-3 py-2 btn-secondary flex items-center gap-1.5 cursor-pointer"
              title="View or restore archived completed tasks"
            >
              <Archive className="w-3.5 h-3.5 text-[#5D655A]" />
              <span>Archive</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetColumnForCreate(columns[0]?.id);
                setIsCreateModalOpen(true);
              }}
              className="px-3.5 py-2 btn-primary flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add task</span>
            </button>
          </div>
        </div>

        {/* 3. Compact Metadata Row: Team Members & Task Progress */}
        <div className="flex flex-wrap items-center gap-6 mt-3.5 pb-3.5 text-[12px] text-[#5D655A]">
          {/* Members overlapping stack */}
          {workspaceMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[#70786D]">Members</span>
              <div className="flex items-center -space-x-1.5">
                {workspaceMembers.slice(0, 6).map((m) => (
                  <span
                    key={m.user_id}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ring-2 ring-[#F7F4EC] ${getAvatarColor(
                      m.name
                    )}`}
                    title={`${m.name} (${m.role.toLowerCase()})`}
                  >
                    {getInitials(m.name)}
                  </span>
                ))}
                {workspaceMembers.length > 6 && (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-[#EDE7DA] text-[#33382F] ring-2 ring-[#F7F4EC]">
                    +{workspaceMembers.length - 6}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Task completion progress track (only when real tasks exist) */}
          {projectStats.total > 0 && (
            <div className="flex items-center gap-2.5">
              <span className="text-[#70786D]">Progress</span>
              <div className="w-24 h-1.5 bg-[#EAE4D8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#596D56] rounded-full transition-all duration-200"
                  style={{ width: `${projectStats.pct}%` }}
                />
              </div>
              <span className="text-[#33382F] font-medium" data-tabular-nums="true">
                {projectStats.completed}/{projectStats.total} completed
              </span>
            </div>
          )}
        </div>

        {/* 4. View Switcher Tabs & Local Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#EAE4D8]">
          {/* View Tabs */}
          <div className="flex items-center gap-1 -mb-px">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] border-b-2 transition-colors cursor-pointer ${
                viewMode === 'board'
                  ? 'border-[#596D56] text-[#33382F] font-semibold'
                  : 'border-transparent text-[#5D655A] hover:text-[#33382F]'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('swimlanes')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] border-b-2 transition-colors cursor-pointer ${
                viewMode === 'swimlanes'
                  ? 'border-[#596D56] text-[#33382F] font-semibold'
                  : 'border-transparent text-[#5D655A] hover:text-[#33382F]'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              <span>Swimlanes</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] border-b-2 transition-colors cursor-pointer ${
                viewMode === 'timeline'
                  ? 'border-[#596D56] text-[#33382F] font-semibold'
                  : 'border-transparent text-[#5D655A] hover:text-[#33382F]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>

            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('blockers')}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] border-b-2 border-transparent text-[#5D655A] hover:text-[#33382F] transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#A46F5C]" />
                  <span>Blockers</span>
                  {projectStats.blocked > 0 && (
                    <span className="text-[11px] px-1.5 py-0.2 rounded-[4px] bg-[#F3E7DD] text-[#A46F5C] font-semibold" data-tabular-nums="true">
                      {projectStats.blocked}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('decisions')}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] border-b-2 border-transparent text-[#5D655A] hover:text-[#33382F] transition-colors cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-[#596D56]" />
                  <span>Decisions</span>
                </button>
              </>
            )}
          </div>

          {/* Local Filter Controls */}
          <div className="flex items-center gap-2 py-1.5 flex-wrap">
            {viewMode === 'swimlanes' && (
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className="text-[#70786D] font-medium">Group by:</span>
                <select
                  value={swimlaneGroupBy}
                  onChange={(e) => setSwimlaneGroupBy(e.target.value as SwimlaneGroupBy)}
                  className="motion-input px-2 py-1 text-[12px] font-medium cursor-pointer"
                >
                  <option value="assignee">Team Member</option>
                  <option value="priority">Priority</option>
                </select>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#70786D] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tasks..."
                className="text-[12.5px] motion-input pl-8 pr-2.5 py-1 w-36 focus:w-48 transition-all"
              />
            </div>

            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="text-[12.5px] motion-input px-2.5 py-1 cursor-pointer"
            >
              <option value="all">Assignee: All</option>
              {workspaceMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="text-[12.5px] motion-input px-2.5 py-1 cursor-pointer"
            >
              <option value="all">Priority: All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <button
              type="button"
              onClick={() => setOnlyBlocked((prev) => !prev)}
              className={`text-[12.5px] px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1.5 font-medium cursor-pointer ${
                onlyBlocked
                  ? 'bg-[#F3E7DD] text-[#A46F5C] border-[#DFC7B8]'
                  : 'bg-[#FFFCF6] text-[#5D655A] border-[#DED8CB] hover:bg-[#EDE7DA]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#A46F5C]" />
              <span>Blocked</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[12px] text-[#985C51] hover:underline px-1.5 py-1 flex items-center gap-1 cursor-pointer font-medium"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Notice */}
      {hasActiveFilters && (
        <div className="px-6 md:px-8 py-2 bg-[#F3EFE5] border-b border-[#DED8CB] flex items-center justify-between text-[12px] text-[#5D655A] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Showing <strong className="text-[#33382F]">{filteredTasks.length}</strong> of{' '}
              <strong className="text-[#33382F]">{tasks.length}</strong> tasks
            </span>
            {searchQuery && (
              <span className="bg-[#FFFCF6] px-2 py-0.5 rounded-[5px] border border-[#DED8CB] text-[#33382F] font-medium">
                &ldquo;{searchQuery}&rdquo;
              </span>
            )}
            {selectedPriority !== 'all' && (
              <span className="bg-[#FFFCF6] px-2 py-0.5 rounded-[5px] border border-[#DED8CB] text-[#33382F] font-medium">
                Priority: {selectedPriority}
              </span>
            )}
            {selectedAssignee !== 'all' && (
              <span className="bg-[#FFFCF6] px-2 py-0.5 rounded-[5px] border border-[#DED8CB] text-[#33382F] font-medium">
                Assignee: {workspaceMembers.find((m) => m.user_id === selectedAssignee)?.name || selectedAssignee}
              </span>
            )}
            {onlyBlocked && (
              <span className="bg-[#F3E7DD] text-[#A46F5C] px-2 py-0.5 rounded-[5px] font-medium">
                Blocked only
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="text-[12px] font-medium text-[#596D56] hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear filters</span>
          </button>
        </div>
      )}

      {/* Main Content Area based on View Mode */}
      {viewMode === 'timeline' ? (
        <TimelineGanttView
          tasks={filteredTasks}
          columns={columns}
          onOpenDetail={handleOpenDetail}
        />
      ) : viewMode === 'swimlanes' ? (
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-5 space-y-5 animate-view-in">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {swimlanes.map((lane) => {
              const isCollapsed = !!collapsedSwimlanes[lane.id];
              return (
                <div
                  key={lane.id}
                  className="bg-[#FFFCF6] rounded-[12px] overflow-hidden border border-[#DED8CB]"
                >
                  <div
                    onClick={() => toggleSwimlaneCollapse(lane.id)}
                    className="px-4 py-3 bg-[#F3EFE5] hover:bg-[#EDE7DA] border-b border-[#DED8CB] flex items-center justify-between cursor-pointer transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        className="p-0.5 rounded-[4px] text-[#5D655A] hover:text-[#33382F]"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {lane.avatarName ? (
                        <span
                          className={`w-6 h-6 rounded-full text-[10.5px] font-semibold flex items-center justify-center ${getAvatarColor(
                            lane.avatarName
                          )}`}
                        >
                          {getInitials(lane.avatarName)}
                        </span>
                      ) : (
                        <Flag className="w-4 h-4 text-[#596D56]" />
                      )}

                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-[#33382F]">
                          {lane.title}
                        </h3>
                        <span
                          className="text-[11.5px] font-medium text-[#5D655A] bg-[#FFFCF6] px-2 py-0.2 rounded-[5px] border border-[#DED8CB]"
                          data-tabular-nums="true"
                        >
                          {lane.tasks.length}
                        </span>
                        {lane.subtitle && (
                          <span className="text-[12px] text-[#70786D] capitalize">
                            · {lane.subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-4 overflow-x-auto bg-[#F7F4EC]">
                      <div className="flex items-start gap-4 min-w-max">
                        {columns.map((col) => {
                          const colTasks = lane.tasks.filter((t) => t.column_id === col.id);
                          return (
                            <KanbanColumn
                              key={col.id}
                              column={col}
                              tasks={colTasks}
                              allColumns={columns}
                              onOpenDetail={handleOpenDetail}
                              onMoveToColumn={handleMoveToColumn}
                              onQuickAddTask={handleQuickAddTask}
                              onTaskUpdated={loadBoardData}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <DragOverlay dropAnimation={null}>
              {activeDragTask ? (
                <div className="w-[296px]">
                  <TaskCard
                    task={activeDragTask}
                    columns={columns}
                    isDragOverlay={true}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : (
        /* Standard Kanban Board Track */
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 md:px-8 py-5 animate-view-in">
          {loading && columns.length === 0 ? (
            <div className="p-8 text-[13.5px] text-[#70786D]">Loading project board...</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-start gap-4 h-full min-w-max pb-2">
                {columns.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.column_id === col.id);
                  return (
                    <KanbanColumn
                      key={col.id}
                      column={col}
                      tasks={colTasks}
                      allColumns={columns}
                      onOpenDetail={handleOpenDetail}
                      onMoveToColumn={handleMoveToColumn}
                      onQuickAddTask={handleQuickAddTask}
                      onTaskUpdated={loadBoardData}
                    />
                  );
                })}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeDragTask ? (
                  <div className="w-[296px]">
                    <TaskCard
                      task={activeDragTask}
                      columns={columns}
                      isDragOverlay={true}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {/* Archive Drawer */}
      <ArchiveDrawer
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        tasks={tasks}
        columns={columns}
        onTaskRestored={loadBoardData}
        onOpenDetail={(taskId) => {
          setIsArchiveOpen(false);
          handleOpenDetail(taskId);
        }}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        projectId={currentProject.id}
        columns={columns}
        defaultColumnId={targetColumnForCreate}
        members={workspaceMembers}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadBoardData}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        columns={columns}
        members={workspaceMembers}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTaskId(null);
        }}
        onTaskUpdated={loadBoardData}
      />
    </div>
  );
}
