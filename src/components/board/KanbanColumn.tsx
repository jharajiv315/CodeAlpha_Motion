import React from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { TaskCard } from './TaskCard.tsx';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getColumnSemanticStyle } from '../../lib/utils.ts';

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
  const semantic = getColumnSemanticStyle(column.name);

  return (
    <div
      ref={setNodeRef}
      className={`w-[296px] shrink-0 flex flex-col max-h-full rounded-[12px] p-2.5 transition-all duration-150 border ${
        isOver
          ? 'bg-[#E3EBDD]/65 border-[#596D56] border-dashed scale-[1.005]'
          : 'bg-[#F3EFE5] border-[#EAE4D8]'
      }`}
    >
      {/* Column Header: status dot, title, task count, + icon button */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-1.5 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: semantic.dotColor }}
            aria-hidden="true"
          />
          <h2 className="text-[13.5px] font-semibold text-[#33382F]">
            {column.name}
          </h2>
          <span
            className="text-[12px] font-medium text-[#5D655A] bg-[#EDE7DA] px-1.5 py-0.2 rounded-[5px]"
            data-tabular-nums="true"
          >
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onQuickAddTask(column.id)}
          className="text-[#5D655A] hover:text-[#33382F] p-1 hover:bg-[#EDE7DA] rounded-[6px] transition-colors cursor-pointer"
          title={`Add task to ${column.name}`}
          aria-label={`Add task to ${column.name}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tasks Stack */}
      <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[120px] p-0.5">
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
          <button
            type="button"
            onClick={() => onQuickAddTask(column.id)}
            className="w-full py-9 px-4 border border-dashed border-[#DED8CB] hover:border-[#596D56] hover:bg-[#FFFCF6]/60 rounded-[9px] text-center text-[12px] text-[#70786D] hover:text-[#33382F] transition-colors cursor-pointer flex flex-col items-center justify-center gap-1"
          >
            <span>No tasks in {column.name}</span>
            <span className="text-[11px] font-medium text-[#596D56] inline-flex items-center gap-1">
              <Plus className="w-3 h-3" />
              <span>Add task</span>
            </span>
          </button>
        )}
      </div>

      {/* Subtle Bottom Add Task Action */}
      {tasks.length > 0 && (
        <button
          type="button"
          onClick={() => onQuickAddTask(column.id)}
          className="mt-2 w-full px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]/80 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-[#596D56]" />
          <span>Add task</span>
        </button>
      )}
    </div>
  );
}
