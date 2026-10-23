import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { removeEmojis } from '../../lib/utils.ts';
import { FileCheck, X } from 'lucide-react';

interface DecisionModalProps {
  taskId: string;
  taskTitle: string;
  defaultSummary?: string;
  sourceCommentId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DecisionModal({
  taskId,
  taskTitle,
  defaultSummary = '',
  sourceCommentId,
  isOpen,
  onClose,
  onSuccess,
}: DecisionModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState(defaultSummary);
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultSummary) {
      setSummary(defaultSummary);
      if (!title) {
        setTitle(defaultSummary.slice(0, 40) + (defaultSummary.length > 40 ? '...' : ''));
      }
    }
  }, [defaultSummary]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setError('Please provide a decision title and summary.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.decisions.record(taskId, {
        title: removeEmojis(title),
        summary: removeEmojis(summary),
        rationale: rationale ? removeEmojis(rationale) : undefined,
        sourceCommentId: sourceCommentId,
      });
      setTitle('');
      setSummary('');
      setRationale('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/20 p-4">
      <div className="motion-modal rounded-[12px] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#FFFCF6]">
          <div className="flex items-center gap-2 text-[#33382F] font-semibold text-[15px]">
            <FileCheck className="w-4 h-4 text-[#596D56]" />
            <h2>Record Decision</h2>
          </div>
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
            <span className="text-[11.5px] font-semibold text-[#70786D] block mb-1">Task</span>
            <p className="font-semibold text-[#33382F] bg-[#F3EFE5] p-2.5 rounded-[9px] border border-[#DED8CB]">
              {taskTitle}
            </p>
          </div>

          <div>
            <label htmlFor="decision-title" className="block font-semibold text-[#33382F] mb-1.5">
              Decision Title <span className="text-[#985C51]">*</span>
            </label>
            <input
              id="decision-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standardize on PostgreSQL as primary database"
              className="w-full text-[13px] motion-input rounded-[9px] p-2.5"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="decision-summary" className="block font-semibold text-[#33382F] mb-1.5">
              What was decided? <span className="text-[#985C51]">*</span>
            </label>
            <textarea
              id="decision-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Standardize on PostgreSQL with relational schemas and indexes."
              className="w-full text-[13px] motion-input rounded-[9px] p-2.5 resize-none"
            />
          </div>

          <div>
            <label htmlFor="decision-rationale" className="block font-semibold text-[#33382F] mb-1.5">
              Rationale <span className="text-[#70786D] font-normal">(Optional)</span>
            </label>
            <textarea
              id="decision-rationale"
              rows={2}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. Transactional consistency, multi-tenant isolation, team familiarity."
              className="w-full text-[13px] motion-input rounded-[9px] p-2.5 resize-none"
            />
          </div>

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
              {submitting ? 'Recording...' : 'Record Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
