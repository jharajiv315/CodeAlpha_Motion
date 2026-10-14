import React from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { TaskCard } from './TaskCard.tsx';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface KanbanColumnProps {
  column: BoardColumn;
  tasks: Task[];
  allColumns: BoardColumn[];
  onOpenDetail: (taskId: string) => void;
  onMoveToColumn: (taskId: string, targetColId: string) => void;
  onQuickAddTask: (columnId: string) => void;
  onTaskUpdated?: () => void;
}

export function KanbanColumn({
  column,
  tasks,
  allColumns,
  onOpenDetail,
  onMoveToColumn,
  onQuickAddTask,
  onTaskUpdated,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      columnId: column.id,
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col max-h-full rounded-xl p-2 transition-colors duration-150 ${
        isOver ? 'bg-[#EAECEF] ring-2 ring-[#5965D8]/40' : 'bg-[#F4F5F7]/80'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-1 select-none">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xs font-semibold text-[#20242B]">
            {column.name}
          </h2>
          <span className="text-[11px] font-mono text-[#6D7480] bg-white px-1.5 py-0.5 rounded-full border border-[#E7E9ED]" data-tabular-nums="true">
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onQuickAddTask(column.id)}
          className="text-[#9CA3AF] hover:text-[#20242B] p-0.5 hover:bg-white rounded transition-colors cursor-pointer"
          title={`Add task to ${column.name}`}
          aria-label={`Add task to ${column.name}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tasks Stack with SortableContext */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[140px] p-0.5">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columns={allColumns}
              onOpenDetail={onOpenDetail}
              onMoveToColumn={onMoveToColumn}
              onTaskUpdated={onTaskUpdated}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-28 border border-dashed border-[#D1D5DB] rounded-xl flex flex-col items-center justify-center text-[11px] text-[#9CA3AF] bg-white/40">
            <span>No tasks in {column.name.toLowerCase()}</span>
            <span className="text-[10px] text-[#9CA3AF]/70 mt-0.5">Drop tasks here</span>
          </div>
        )}
      </div>
    </div>
  );
}
