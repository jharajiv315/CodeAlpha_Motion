import React, { useState } from 'react';
import type { WorkspaceMember } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { removeEmojis } from '../../lib/utils.ts';
import { AlertTriangle, X } from 'lucide-react';

interface BlockerModalProps {
  taskId: string;
  taskTitle: string;
  members: WorkspaceMember[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BlockerModal({ taskId, taskTitle, members, isOpen, onClose, onSuccess }: BlockerModalProps) {
  const [reason, setReason] = useState('');
  const [waitingOnUserId, setWaitingOnUserId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please describe what is preventing progress.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.blockers.markBlocked(taskId, {
        reason: removeEmojis(reason),
        waitingOnUserId: waitingOnUserId || null,
      });
      setReason('');
      setWaitingOnUserId('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark task as blocked');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/20 p-4">
      <div className="motion-modal rounded-[12px] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#F3E7DD]/60">
          <div className="flex items-center gap-2 text-[#33382F] font-semibold text-[15px]">
            <AlertTriangle className="w-4 h-4 text-[#A46F5C]" />
            <h2>Mark Task Blocked</h2>
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
            <label htmlFor="blocker-reason" className="block font-semibold text-[#33382F] mb-1.5">
              What is blocking progress? <span className="text-[#985C51]">*</span>
            </label>
            <textarea
              id="blocker-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Waiting on production Stripe webhook secret and sandbox credentials..."
              className="w-full text-[13px] motion-input rounded-[9px] p-3 resize-none"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="waiting-on-user" className="block font-semibold text-[#33382F] mb-1.5">
              Waiting on <span className="text-[#70786D] font-normal">(Optional)</span>
            </label>
            <select
              id="waiting-on-user"
              value={waitingOnUserId}
              onChange={(e) => setWaitingOnUserId(e.target.value)}
              className="w-full text-[13px] motion-input rounded-[9px] p-2.5 cursor-pointer"
            >
              <option value="">No specific person / Team triage</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} {m.title ? `(${m.title})` : ''}
                </option>
              ))}
            </select>
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
              className="px-4 py-2 text-[12.5px] bg-[#A46F5C] hover:bg-[#8E5D4B] text-[#FFFCF6] font-semibold rounded-[9px] transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Mark Blocked'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
