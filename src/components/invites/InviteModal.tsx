import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';
import { X, Copy, Check, Users, Link2 } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const { currentWorkspace, workspaceMembers, reloadMembers } = useWorkspace();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentWorkspace) return null;

  const handleGenerateInvite = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.workspaces.createInvite(currentWorkspace.id, 'MEMBER');
      const fullUrl = `${window.location.origin}?invite=${res.invite.token}`;
      setInviteUrl(fullUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;

    let token = inviteTokenInput.trim();
    if (token.includes('invite=')) {
      const match = token.match(/invite=([a-zA-Z0-9_-]+)/);
      if (match) token = match[1];
    }

    setJoining(true);
    setError(null);
    setJoinMessage(null);
    try {
      await api.workspaces.acceptInvite(token);
      setJoinMessage('Successfully joined workspace!');
      setInviteTokenInput('');
      await reloadMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setJoining(false);
    }
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#FFFCF6]">
          <div className="flex items-center gap-2 text-[#33382F] font-semibold text-[15px]">
            <Users className="w-4 h-4 text-[#596D56]" />
            <span>Team &amp; Invitations</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#70786D] hover:text-[#33382F] p-1 rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-[13px]">
          {/* Generate Link */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#33382F]">Shareable Invite Link</h3>
                <p className="text-[12px] text-[#70786D]">
                  Invite teammates to {currentWorkspace.name}.
                </p>
              </div>
              {!inviteUrl && (
                <button
                  type="button"
                  onClick={handleGenerateInvite}
                  disabled={generating}
                  className="btn-primary px-3 py-1.5 text-[12.5px] rounded-[9px] flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{generating ? 'Creating...' : 'Generate Link'}</span>
                </button>
              )}
            </div>

            {inviteUrl && (
              <div className="flex items-center gap-2 p-1.5 bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px]">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 text-[12px] bg-transparent border-none text-[#33382F] focus:outline-hidden select-all px-2"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-secondary px-2.5 py-1 text-[12px] rounded-[6px] flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#62866B]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Accept invite from link / token */}
          <form onSubmit={handleAcceptInvite} className="pt-4 border-t border-[#EAE4D8] space-y-2">
            <span className="text-[12px] font-semibold text-[#33382F] block">
              Join another workspace via invite token
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteTokenInput}
                onChange={(e) => setInviteTokenInput(e.target.value)}
                placeholder="Paste token or invite link..."
                className="flex-1 text-[13px] motion-input rounded-[9px] px-3 py-1.5"
              />
              <button
                type="submit"
                disabled={joining || !inviteTokenInput.trim()}
                className="btn-primary px-3.5 py-1.5 text-[12.5px] rounded-[9px] disabled:opacity-50 cursor-pointer"
              >
                {joining ? 'Joining...' : 'Join'}
              </button>
            </div>
            {joinMessage && <p className="text-[12px] text-[#35513A] font-semibold">{joinMessage}</p>}
          </form>

          {/* Member List */}
          <div className="pt-4 border-t border-[#EAE4D8] space-y-2.5">
            <span className="text-[12px] font-semibold text-[#70786D] block">
              Workspace Members ({workspaceMembers.length})
            </span>

            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {workspaceMembers.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-2 rounded-[9px] bg-[#F7F4EC] border border-[#EAE4D8]"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(
                        m.name
                      )}`}
                    >
                      {getInitials(m.name)}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#33382F] leading-tight">{m.name}</p>
                      <p className="text-[11px] text-[#70786D] leading-tight">{m.email}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-[#5D655A] bg-[#F3EFE5] border border-[#DED8CB] px-2 py-0.5 rounded-[6px] capitalize">
                    {m.role.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 text-[12.5px] bg-[#F3E7DD] border border-[#DFC2B0] text-[#985C51] rounded-[9px]">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
