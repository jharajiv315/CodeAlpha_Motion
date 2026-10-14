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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#E7E9ED] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E9ED] bg-[#F8F9FB]">
          <div className="flex items-center gap-1.5 text-[#20242B] font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-[#B97828]" />
            <span>Mark as Blocked</span>
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
            <label htmlFor="blocker-reason" className="block font-medium text-[#20242B] mb-1">
              What is preventing progress? <span className="text-[#C54D4D]">*</span>
            </label>
            <textarea
              id="blocker-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Waiting on production Stripe webhook secret and sandbox credentials..."
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2.5 focus:outline-hidden focus:border-[#5965D8] text-[#20242B] placeholder-[#9CA3AF] resize-none"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="waiting-on-user" className="block font-medium text-[#20242B] mb-1">
              Who can help unblock this? <span className="text-[#9CA3AF] font-normal">(Optional)</span>
            </label>
            <select
              id="waiting-on-user"
              value={waitingOnUserId}
              onChange={(e) => setWaitingOnUserId(e.target.value)}
              className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 bg-white text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
            >
              <option value="">No specific individual / Whole team</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} {m.title ? `(${m.title})` : ''}
                </option>
              ))}
            </select>
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
              {submitting ? 'Marking...' : 'Confirm Blocker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
