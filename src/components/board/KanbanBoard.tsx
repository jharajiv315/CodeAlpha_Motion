import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { useSearch } from '../../contexts/SearchContext.tsx';
import { KanbanColumn } from './KanbanColumn.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import { CreateTaskModal } from '../task/CreateTaskModal.tsx';
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
} from 'lucide-react';

export function KanbanBoard() {
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

  // Modals
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

  // Filter tasks across all columns by keyword, assignee, or priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Keyword search (matches title, description, assignee name, priority label, or blocker details)
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

      // 2. Specific Assignee filter
      if (selectedAssignee !== 'all') {
        const hasAssignee = t.assignees?.some(
          (a) => a.user_id === selectedAssignee
        );
        if (!hasAssignee) return false;
      }

      // 3. Specific Priority filter
      if (selectedPriority !== 'all') {
        const normPriority = (t.priority || 'MEDIUM').toUpperCase();
        if (normPriority !== selectedPriority) {
          return false;
        }
      }

      // 4. Blocked only filter
      if (onlyBlocked && !t.is_blocked) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedAssignee, selectedPriority, onlyBlocked]);

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
    // Optimistic update
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

    // Moving between columns during hover
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

    // Get ordered tasks in target column
    const colTasks = tasks.filter((t) => t.column_id === targetColId);
    const oldIndex = colTasks.findIndex((t) => t.id === activeId);
    let newIndex = overTask ? colTasks.findIndex((t) => t.id === overId) : colTasks.length - 1;
    if (newIndex < 0) newIndex = 0;

    let reorderedColTasks = colTasks;
    if (oldIndex !== -1 && oldIndex !== newIndex) {
      reorderedColTasks = arrayMove(colTasks, oldIndex, newIndex);
    }

    const reorderedTaskIds = reorderedColTasks.map((t) => t.id);

    // Optimistically update positions in local state
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
      <div className="flex-1 flex items-center justify-center p-8 text-[#6D7480] text-xs">
        Select a project from the sidebar to view its board.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8F9FB]">
      {/* Quiet Board Toolbar */}
      <div className="px-6 py-2.5 bg-white border-b border-[#E7E9ED] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg pl-8 pr-2.5 py-1 text-[#20242B] placeholder-[#9CA3AF] focus:bg-white focus:outline-hidden focus:border-[#5965D8] w-40 transition-colors"
            />
          </div>

          {/* Assignee Filter */}
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg px-2.5 py-1 text-[#6D7480] hover:text-[#20242B] transition-colors cursor-pointer"
          >
            <option value="all">Assignee: All</option>
            {workspaceMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg px-2.5 py-1 text-[#6D7480] hover:text-[#20242B] transition-colors cursor-pointer"
          >
            <option value="all">Priority: All</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Blocker Filter Toggle */}
          <button
            type="button"
            onClick={() => setOnlyBlocked((prev) => !prev)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 font-medium cursor-pointer ${
              onlyBlocked
                ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                : 'bg-[#F8F9FB] text-[#6D7480] border-[#E7E9ED] hover:text-[#20242B]'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-[#B97828]" />
            <span>Blocked</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-[#6D7480] hover:text-[#20242B] p-1 flex items-center gap-1 cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Add Task */}
        <button
          type="button"
          onClick={() => {
            setTargetColumnForCreate(columns[0]?.id);
            setIsCreateModalOpen(true);
          }}
          className="text-xs font-semibold bg-[#20242B] hover:bg-[#323842] text-white px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* Active Filter Notice Banner across all columns */}
      {hasActiveFilters && (
        <div className="px-6 py-1.5 bg-[#EEF0FF] border-b border-[#DDE1FF] flex items-center justify-between text-xs text-[#434DB7] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              Filtered across all columns: <strong className="text-[#20242B]">{filteredTasks.length}</strong> of{' '}
              <strong className="text-[#20242B]">{tasks.length}</strong> tasks visible
            </span>
            {searchQuery && (
              <span className="bg-white px-1.5 py-0.5 rounded text-[11px] border border-[#CBD2FB] text-[#20242B]">
                Keyword: &quot;{searchQuery}&quot;
              </span>
            )}
            {selectedPriority !== 'all' && (
              <span className="bg-white px-1.5 py-0.5 rounded text-[11px] border border-[#CBD2FB] text-[#20242B]">
                Priority: {selectedPriority}
              </span>
            )}
            {selectedAssignee !== 'all' && (
              <span className="bg-white px-1.5 py-0.5 rounded text-[11px] border border-[#CBD2FB] text-[#20242B]">
                Assignee: {workspaceMembers.find((m) => m.user_id === selectedAssignee)?.name || selectedAssignee}
              </span>
            )}
            {onlyBlocked && (
              <span className="bg-[#FEF3C7] text-[#92400E] px-1.5 py-0.5 rounded text-[11px] border border-[#FDE68A]">
                Blocked only
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] font-semibold text-[#434DB7] hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear filters</span>
          </button>
        </div>
      )}

      {/* Kanban Board Track with Drag & Drop */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-3.5 h-full min-w-max pb-2">
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
              <div className="w-72">
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

      {/* Modals */}
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

      <CreateTaskModal
        projectId={currentProject.id}
        columns={columns}
        defaultColumnId={targetColumnForCreate}
        members={workspaceMembers}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadBoardData}
      />
    </div>
  );
}
