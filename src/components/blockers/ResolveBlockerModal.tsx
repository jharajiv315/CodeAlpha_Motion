import React, { useState } from 'react';
import { api } from '../../lib/api.ts';
import { CheckCircle2, X } from 'lucide-react';

interface ResolveBlockerModalProps {
  taskId: string;
  taskTitle: string;
  blockerReason?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResolveBlockerModal({
  taskId,
  taskTitle,
  blockerReason,
  isOpen,
  onClose,
  onSuccess,
}: ResolveBlockerModalProps) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      setError('Please provide a brief resolution note.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.blockers.resolve(taskId, resolutionNote.trim());
      setResolutionNote('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve blocker');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#E7E9ED] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E9ED] bg-[#F8F9FB]">
          <div className="flex items-center gap-1.5 text-[#20242B] font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4 text-[#238565]" />
            <span>Resolve Blocker</span>
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
            <p className="font-semibold text-[#20242B]">{taskTitle}</p>
          </div>

          {blockerReason && (
            <div className="bg-[#FAF8F5] border border-[#EFE9DF] rounded-lg p-2.5 text-xs text-[#78350F] space-y-0.5">
              <span className="font-semibold block text-[10px] uppercase text-[#92400E]">Obstacle:</span>
              <p>{blockerReason}</p>
            </div>
          )}

          <div>
            <label htmlFor="resolution-note" className="block font-medium text-[#20242B] mb-1">
              Resolution Note <span className="text-[#C54D4D]">*</span>
            </label>
            <textarea
              id="resolution-note"
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Credentials received and configured in environment variables. Webhook verified."
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2.5 focus:outline-hidden focus:border-[#5965D8] text-[#20242B] placeholder-[#9CA3AF] resize-none"
              autoFocus
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
              className="px-3 py-1.5 text-xs bg-[#238565] hover:bg-[#1E7357] text-white font-medium rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
