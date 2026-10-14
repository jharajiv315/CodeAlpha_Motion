import React, { useState } from 'react';
import type { WorkspaceMember } from '../../types/index.ts';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#E7E9ED] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E9ED] bg-[#F8F9FB]">
          <div className="flex items-center gap-1.5 text-[#20242B] font-semibold text-xs">
            <Users className="w-4 h-4 text-[#6D7480]" />
            <span>Team &amp; Invitations</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#20242B] p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs">
          {/* Generate Link */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#20242B]">Shareable Invite Link</h3>
                <p className="text-[11px] text-[#6D7480]">
                  Collaborate in {currentWorkspace.name} with your team.
                </p>
              </div>
              {!inviteUrl && (
                <button
                  type="button"
                  onClick={handleGenerateInvite}
                  disabled={generating}
                  className="px-2.5 py-1 text-xs bg-[#20242B] hover:bg-[#323842] text-white font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Link2 className="w-3 h-3" />
                  <span>{generating ? 'Creating...' : 'Generate Link'}</span>
                </button>
              )}
            </div>

            {inviteUrl && (
              <div className="flex items-center gap-2 p-1.5 bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 text-xs bg-transparent border-none text-[#20242B] focus:outline-hidden select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2 py-0.5 text-xs bg-white border border-[#E7E9ED] text-[#20242B] font-medium rounded shadow-2xs hover:border-[#D1D5DB] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-[#238565]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Accept invite from link / token */}
          <form onSubmit={handleAcceptInvite} className="pt-3 border-t border-[#F4F5F7] space-y-1.5">
            <span className="text-[11px] font-medium text-[#6D7480] block">
              Join another workspace via link or token
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteTokenInput}
                onChange={(e) => setInviteTokenInput(e.target.value)}
                placeholder="Paste token or invite link..."
                className="flex-1 text-xs border border-[#E7E9ED] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-[#5965D8] text-[#20242B]"
              />
              <button
                type="submit"
                disabled={joining || !inviteTokenInput.trim()}
                className="px-3 py-1.5 text-xs bg-[#F4F5F7] hover:bg-[#EAECEF] disabled:opacity-50 text-[#20242B] font-medium rounded-lg transition-colors cursor-pointer"
              >
                {joining ? 'Joining...' : 'Join'}
              </button>
            </div>
            {joinMessage && <p className="text-[11px] text-[#238565] font-medium">{joinMessage}</p>}
          </form>

          {/* Member List */}
          <div className="pt-3 border-t border-[#F4F5F7] space-y-2">
            <span className="text-[11px] font-medium text-[#6D7480] block">
              Workspace Members ({workspaceMembers.length})
            </span>

            <div className="max-h-40 overflow-y-auto space-y-2 divide-y divide-[#F8F9FB]">
              {workspaceMembers.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between pt-1.5 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(
                        m.name
                      )}`}
                    >
                      {getInitials(m.name)}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-[#20242B] leading-tight">{m.name}</p>
                      <p className="text-[10px] text-[#9CA3AF] leading-tight">{m.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#6D7480] bg-[#F4F5F7] px-1.5 py-0.5 rounded capitalize">
                    {m.role.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="p-2 text-xs bg-[#FEE2E2] text-[#991B1B] rounded-lg">{error}</div>}
        </div>
      </div>
    </div>
  );
}
