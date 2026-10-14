import React, { useState } from 'react';
import { api } from '../../lib/api.ts';
import { removeEmojis } from '../../lib/utils.ts';
import { FileCheck, X } from 'lucide-react';

interface DecisionModalProps {
  taskId: string;
  taskTitle: string;
  sourceCommentId?: string | null;
  defaultSummary?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DecisionModal({
  taskId,
  taskTitle,
  sourceCommentId,
  defaultSummary = '',
  isOpen,
  onClose,
  onSuccess,
}: DecisionModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState(defaultSummary);
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setError('Both decision title and summary are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.decisions.record(taskId, {
        title: removeEmojis(title),
        summary: removeEmojis(summary),
        rationale: removeEmojis(rationale) || undefined,
        sourceCommentId: sourceCommentId || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#E7E9ED] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E9ED] bg-[#F8F9FB]">
          <div className="flex items-center gap-1.5 text-[#20242B] font-semibold text-xs">
            <FileCheck className="w-4 h-4 text-[#5965D8]" />
            <span>Record Decision Note</span>
          </div>
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
            <span className="text-[11px] font-medium text-[#6D7480] block mb-1">Target Task</span>
            <p className="font-semibold text-[#20242B] bg-[#F8F9FB] p-2 rounded-lg border border-[#E7E9ED]">
              {taskTitle}
            </p>
          </div>

          <div>
            <label htmlFor="decision-title" className="block font-medium text-[#20242B] mb-1">
              Decision Title <span className="text-[#C54D4D]">*</span>
            </label>
            <input
              id="decision-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Use PostgreSQL as primary database"
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#5965D8]"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="decision-summary" className="block font-medium text-[#20242B] mb-1">
              What was decided? <span className="text-[#C54D4D]">*</span>
            </label>
            <textarea
              id="decision-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Standardize on PostgreSQL with relational schemas and indexes."
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#5965D8] resize-none"
            />
          </div>

          <div>
            <label htmlFor="decision-rationale" className="block font-medium text-[#20242B] mb-1">
              Why was this chosen? <span className="text-[#9CA3AF] font-normal">(Rationale)</span>
            </label>
            <textarea
              id="decision-rationale"
              rows={2}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. Transactional consistency, relational multi-tenant isolation, team experience."
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#5965D8] resize-none"
            />
          </div>

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
              className="px-3 py-1.5 text-xs bg-[#20242B] hover:bg-[#323842] text-white font-medium rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Record Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
