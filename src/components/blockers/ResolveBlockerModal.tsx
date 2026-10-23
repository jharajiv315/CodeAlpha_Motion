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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/20 p-4">
      <div className="motion-modal rounded-[12px] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#E6EEE4]/60">
          <div className="flex items-center gap-2 text-[#33382F] font-semibold text-[15px]">
            <CheckCircle2 className="w-4 h-4 text-[#62866B]" />
            <h2>Resolve Blocker</h2>
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

          {blockerReason && (
            <div className="bg-[#F3E7DD] border border-[#DFC2B0] rounded-[9px] p-3 text-[12.5px] text-[#7B4B3A] space-y-1">
              <span className="font-semibold block text-[11px] uppercase tracking-[0.04em]">
                Current Blocker
              </span>
              <p className="leading-relaxed text-[#33382F]">{blockerReason}</p>
            </div>
          )}

          <div>
            <label htmlFor="resolution-note" className="block font-semibold text-[#33382F] mb-1.5">
              Resolution Note <span className="text-[#985C51]">*</span>
            </label>
            <textarea
              id="resolution-note"
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Credentials configured in environment variables and verified."
              className="w-full text-[13px] motion-input rounded-[9px] p-3 resize-none"
              autoFocus
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
              {submitting ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
