import React, { useState, useEffect } from 'react';
import type { BoardColumn, WorkspaceMember, PriorityLevel, Task } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { removeEmojis } from '../../lib/utils.ts';
import { X, Link2, Check } from 'lucide-react';

interface CreateTaskModalProps {
  projectId: string;
  columns: BoardColumn[];
  members: WorkspaceMember[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialColumnId?: string;
  defaultColumnId?: string;
}

export function CreateTaskModal({
  projectId,
  columns,
  members,
  isOpen,
  onClose,
  onSuccess,
  initialColumnId,
  defaultColumnId,
}: CreateTaskModalProps) {
  const effectiveColId = defaultColumnId || initialColumnId;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState(effectiveColId || columns[0]?.id || '');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);
  const [existingTasks, setExistingTasks] = useState<Task[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveColId) {
      setColumnId(effectiveColId);
    } else if (columns.length > 0 && !columnId) {
      setColumnId(columns[0].id);
    }
  }, [effectiveColId, columns, columnId]);

  useEffect(() => {
    if (isOpen && projectId) {
      api.tasks.listByProject(projectId).then((res) => {
        setExistingTasks(res.tasks || []);
      }).catch(console.error);
    }
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.tasks.create(projectId, {
        columnId,
        title: removeEmojis(title.trim()),
        description: removeEmojis(description.trim()),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        assigneeIds: selectedAssignees,
        dependsOnTaskIds: selectedDependencies,
      });

      setTitle('');
      setDescription('');
      setDueDate('');
      setEstimatedHours('');
      setSelectedAssignees([]);
      setSelectedDependencies([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/25 backdrop-blur-[1px] p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="motion-modal rounded-[12px] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#FFFCF6]">
          <h2 className="text-[16px] font-semibold text-[#33382F]">Add Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#70786D] hover:text-[#33382F] p-1 rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-[13px]">
          <div>
            <label htmlFor="create-task-title" className="block font-semibold text-[#33382F] mb-1.5">
              Title <span className="text-[#985C51]">*</span>
            </label>
            <input
              id="create-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audit API rate limits and response codes"
              className="w-full text-[13.5px] motion-input rounded-[9px] px-3 py-2"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="create-task-desc" className="block font-semibold text-[#33382F] mb-1.5">
              Description <span className="text-[#70786D] font-normal">(Optional)</span>
            </label>
            <textarea
              id="create-task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add deliverables, acceptance criteria, or context..."
              className="w-full text-[13px] motion-input rounded-[9px] px-3 py-2 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-task-col" className="block font-semibold text-[#33382F] mb-1.5">
                Column
              </label>
              <select
                id="create-task-col"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full text-[13px] motion-input rounded-[9px] px-3 py-2 cursor-pointer"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="create-task-priority" className="block font-semibold text-[#33382F] mb-1.5">
                Priority
              </label>
              <select
                id="create-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full text-[13px] motion-input rounded-[9px] px-3 py-2 cursor-pointer"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-task-due" className="block font-semibold text-[#33382F] mb-1.5">
                Due Date
              </label>
              <input
                id="create-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-[13px] motion-input rounded-[9px] px-3 py-1.5"
              />
            </div>

            <div>
              <label htmlFor="create-task-estimate" className="block font-semibold text-[#33382F] mb-1.5">
                Estimate (hrs)
              </label>
              <input
                id="create-task-estimate"
                type="number"
                step="0.5"
                min="0.1"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g. 4.0"
                className="w-full text-[13px] motion-input rounded-[9px] px-3 py-1.5"
              />
            </div>
          </div>

          <div>
            <span className="block font-semibold text-[#33382F] mb-1.5">
              Assignees
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px]">
              {members.map((m) => {
                const selected = selectedAssignees.includes(m.user_id);
                return (
                  <button
                    type="button"
                    key={m.user_id}
                    onClick={() => toggleAssignee(m.user_id)}
                    className={`text-[12px] px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      selected
                        ? 'bg-[#E3EBDD] text-[#33382F] border-[#C8D8C1] font-semibold'
                        : 'bg-[#FFFCF6] text-[#5D655A] border-[#DED8CB] hover:bg-[#EDE7DA]'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3 text-[#596D56]" />}
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {existingTasks.length > 0 && (
            <div>
              <span className="block font-semibold text-[#33382F] mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-[#70786D]" />
                <span>Prerequisites (Optional)</span>
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px]">
                {existingTasks.map((t) => {
                  const selected = selectedDependencies.includes(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() =>
                        setSelectedDependencies((prev) =>
                          prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        )
                      }
                      className={`text-[12px] px-2.5 py-1 rounded-[6px] border transition-colors flex items-center gap-1 cursor-pointer truncate max-w-full ${
                        selected
                          ? 'bg-[#F3E7DD] text-[#7B4B3A] border-[#DFC2B0] font-semibold'
                          : 'bg-[#FFFCF6] text-[#5D655A] border-[#DED8CB] hover:bg-[#EDE7DA]'
                      }`}
                      title={t.title}
                    >
                      <span className="truncate">{t.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 text-[12.5px] bg-[#F3E7DD] text-[#985C51] border border-[#DFC2B0] rounded-[9px]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE4D8]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-tertiary px-3.5 py-1.5 text-[12.5px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-4 py-2 text-[12.5px] rounded-[9px] cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
