import React, { useState, useEffect } from 'react';
import type { BoardColumn, WorkspaceMember, PriorityLevel, Task } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { removeEmojis } from '../../lib/utils.ts';
import { X, Link2 } from 'lucide-react';

interface CreateTaskModalProps {
  projectId: string;
  columns: BoardColumn[];
  defaultColumnId?: string;
  members: WorkspaceMember[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTaskModal({
  projectId,
  columns,
  defaultColumnId,
  members,
  isOpen,
  onClose,
  onSuccess,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState(defaultColumnId || (columns[0]?.id ?? ''));
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [existingTasks, setExistingTasks] = useState<Task[]>([]);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      api.tasks.listByProject(projectId).then((res) => {
        setExistingTasks(res.tasks || []);
      }).catch(() => {});
    }
  }, [isOpen, projectId]);

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
        title: removeEmojis(title),
        description: removeEmojis(description),
        columnId: columnId || columns[0].id,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#E7E9ED] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E9ED] bg-[#F8F9FB]">
          <h2 className="text-xs font-bold text-[#20242B]">New Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#20242B] p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label htmlFor="create-task-title" className="block font-medium text-[#20242B] mb-1">
              Title <span className="text-[#C54D4D]">*</span>
            </label>
            <input
              id="create-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audit API rate limits and response codes"
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#5965D8]"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="create-task-desc" className="block font-medium text-[#20242B] mb-1">
              Description <span className="text-[#9CA3AF] font-normal">(Optional)</span>
            </label>
            <textarea
              id="create-task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key requirements or context..."
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] placeholder-[#9CA3AF] resize-none focus:outline-hidden focus:border-[#5965D8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-task-col" className="block font-medium text-[#20242B] mb-1">
                Column
              </label>
              <select
                id="create-task-col"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full text-xs border border-[#E7E9ED] rounded-lg p-1.5 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="create-task-priority" className="block font-medium text-[#20242B] mb-1">
                Priority
              </label>
              <select
                id="create-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full text-xs border border-[#E7E9ED] rounded-lg p-1.5 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-task-due" className="block font-medium text-[#20242B] mb-1">
                Due Date <span className="text-[#9CA3AF] font-normal">(Optional)</span>
              </label>
              <input
                id="create-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs border border-[#E7E9ED] rounded-lg p-1.5 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
              />
            </div>

            <div>
              <label htmlFor="create-task-estimate" className="block font-medium text-[#20242B] mb-1">
                Estimated Effort <span className="text-[#9CA3AF] font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  id="create-task-estimate"
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="e.g. 4.0"
                  className="w-full text-xs font-mono border border-[#E7E9ED] rounded-lg p-1.5 pr-8 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
                />
                <span className="absolute right-2.5 top-1.5 text-[11px] text-[#9CA3AF]">
                  hrs
                </span>
              </div>
            </div>
          </div>

          <div>
            <span className="block font-medium text-[#20242B] mb-1.5">
              Assign Teammates
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 border border-[#E7E9ED] rounded-lg">
              {members.map((m) => {
                const selected = selectedAssignees.includes(m.user_id);
                return (
                  <button
                    type="button"
                    key={m.user_id}
                    onClick={() => toggleAssignee(m.user_id)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 cursor-pointer ${
                      selected
                        ? 'bg-[#20242B] text-white border-[#20242B]'
                        : 'bg-white text-[#6D7480] border-[#E7E9ED] hover:border-[#D1D5DB]'
                    }`}
                  >
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prerequisites (Task Dependencies) */}
          {existingTasks.length > 0 && (
            <div>
              <span className="block font-medium text-[#20242B] mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3 h-3 text-[#EA580C]" />
                <span>Prerequisites / Blocked by (Optional)</span>
              </span>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 border border-[#E7E9ED] rounded-lg bg-[#FAF8F5]/60">
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
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 cursor-pointer truncate max-w-full ${
                        selected
                          ? 'bg-[#EA580C] text-white border-[#EA580C]'
                          : 'bg-white text-[#6D7480] border-[#E7E9ED] hover:border-[#D1D5DB]'
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

          {error && <div className="p-2.5 text-xs bg-[#FEE2E2] text-[#991B1B] rounded-lg">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F4F5F7]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs text-[#6D7480] hover:text-[#20242B] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs bg-[#20242B] hover:bg-[#323842] text-white font-medium rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
