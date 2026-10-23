import React, { useState, useEffect } from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import {
  Archive,
  RotateCcw,
  X,
  CheckCircle2,
  Clock,
  Search,
} from 'lucide-react';
import { formatDate } from '../../lib/utils.ts';

interface ArchiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  columns: BoardColumn[];
  onTaskRestored?: () => void;
  onOpenDetail?: (taskId: string) => void;
}

export function ArchiveDrawer({
  isOpen,
  onClose,
  tasks,
  columns,
  onTaskRestored,
  onOpenDetail,
}: ArchiveDrawerProps) {
  const [search, setSearch] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const completedOrArchivedTasks = tasks.filter(
    (t) =>
      !!t.completed_at ||
      (t as any).is_archived ||
      columns.find((c) => c.id === t.column_id)?.name.toLowerCase().includes('done')
  );

  const displayedTasks = completedOrArchivedTasks.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  });

  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    try {
      const firstActiveColumn = columns[0]?.id;
      if (firstActiveColumn) {
        await api.tasks.move(taskId, firstActiveColumn, 0);
      }
      onTaskRestored?.();
    } catch (err) {
      console.error('Failed to restore task:', err);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-[#33382F]/25 animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FFFDF9] h-full shadow-xl flex flex-col p-6 space-y-4 border-l border-[#DED8CB] animate-drawer-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EAE4D8]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px] bg-[#F3EFE5] border border-[#DED8CB] flex items-center justify-center text-[#5D655A]">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[#33382F]">Completed &amp; Archived</h2>
              <p className="text-[12px] text-[#70786D]" data-tabular-nums="true">
                {completedOrArchivedTasks.length} items resolved
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#70786D] hover:text-[#33382F] rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
            aria-label="Close archive drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#70786D] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search completed tasks..."
            className="w-full text-[13px] motion-input rounded-[9px] pl-8 pr-3 py-2"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {displayedTasks.map((t) => (
            <div
              key={t.id}
              className="motion-card rounded-[9px] p-3.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={t.priority} showLabel={false} />
                    <button
                      type="button"
                      onClick={() => onOpenDetail?.(t.id)}
                      className="text-[13.5px] font-semibold text-[#33382F] truncate hover:text-[#596D56] transition-colors text-left cursor-pointer"
                    >
                      {t.title}
                    </button>
                  </div>
                  {t.completed_at && (
                    <div className="flex items-center gap-1.5 text-[11.5px] text-[#62866B] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completed {formatDate(t.completed_at)}</span>
                    </div>
                  )}
                </div>

                {/* Restore button */}
                <button
                  type="button"
                  disabled={restoringId === t.id}
                  onClick={() => handleRestore(t.id)}
                  className="btn-secondary px-2.5 py-1 text-[12px] rounded-[6px] flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  title="Restore task back to active board"
                >
                  <RotateCcw className={`w-3 h-3 ${restoringId === t.id ? 'animate-spin' : ''}`} />
                  <span>Restore</span>
                </button>
              </div>

              {t.time_spent_hours ? (
                <div className="flex items-center gap-1 text-[11.5px] text-[#70786D]" data-tabular-nums="true">
                  <Clock className="w-3 h-3" />
                  <span>{t.time_spent_hours}h logged</span>
                </div>
              ) : null}
            </div>
          ))}

          {displayedTasks.length === 0 && (
            <div className="py-16 text-center text-[#70786D] text-[13px]">
              No completed or archived tasks found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
