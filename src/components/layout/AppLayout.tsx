import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { KanbanBoard } from '../board/KanbanBoard.tsx';
import { BlockerRadarView } from '../blockers/BlockerRadarView.tsx';
import { DecisionsView } from '../decisions/DecisionsView.tsx';
import { MyWorkView } from '../mywork/MyWorkView.tsx';
import { NotificationPopover } from '../notifications/NotificationPopover.tsx';
import { InviteModal } from '../invites/InviteModal.tsx';
import { TaskDetailModal } from '../task/TaskDetailModal.tsx';
import { CreateTaskModal } from '../task/CreateTaskModal.tsx';
import { DailyDigestModal } from '../digest/DailyDigestModal.tsx';
import { TeamPulseWidget } from '../team/TeamPulseWidget.tsx';
import { HeaderSearchBar } from './HeaderSearchBar.tsx';
import { PrismLogo } from '../ui/PrismLogo.tsx';
import { api } from '../../lib/api.ts';
import type { User, BoardColumn } from '../../types/index.ts';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';
import {
  Kanban,
  AlertTriangle,
  FileCheck,
  CheckSquare,
  Users,
  ChevronDown,
  Plus,
  LogOut,
  Circle,
  Menu,
  X,
  Mail,
} from 'lucide-react';

export function AppLayout() {
  const { user, logout, switchUserFast } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    projects,
    currentProject,
    setCurrentProject,
    workspaceMembers,
    createWorkspace,
    createProject,
  } = useWorkspace();
  const { activeViewers } = useRealtime();

  const [activeTab, setActiveTab] = useState<'board' | 'blockers' | 'decisions' | 'mywork'>('board');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [selectedNotificationTaskId, setSelectedNotificationTaskId] = useState<string | null>(null);

  const [isHeaderCreateTaskOpen, setIsHeaderCreateTaskOpen] = useState(false);
  const [projectColumns, setProjectColumns] = useState<BoardColumn[]>([]);

  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [showDemoUserMenu, setShowDemoUserMenu] = useState(false);

  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  const [showWsDropdown, setShowWsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    api.auth.getDemoUsers().then((res) => setDemoUsers(res.users)).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentProject) {
      api.projects.getColumns(currentProject.id).then((res) => setProjectColumns(res.columns)).catch(() => {});
    }
  }, [currentProject]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      await createWorkspace(newWsName.trim());
      setNewWsName('');
      setShowWorkspaceModal(false);
    } catch (err) {
      console.error('Failed to create workspace:', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    try {
      await createProject(newProjName.trim(), newProjDesc.trim());
      setNewProjName('');
      setNewProjDesc('');
      setShowProjectModal(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const otherActiveViewers = activeViewers.filter((v) => v.userId !== user?.id);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7F4EC] text-[#33382F] antialiased">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#33382F]/20 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar: 226px desktop width, warm oatmeal surface (#F1EBDD) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[226px] bg-[#F1EBDD] border-r border-[#DED8CB] flex flex-col justify-between transition-transform duration-150 md:static md:translate-x-0 shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Workspace Switcher */}
          <div className="p-3 border-b border-[#DED8CB] relative">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setShowWsDropdown((p) => !p)}
                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-[#EDE7DA] rounded-[9px] transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PrismLogo size="sm" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13.5px] font-semibold text-[#33382F] truncate leading-tight">
                      {currentWorkspace?.name || 'Workspace'}
                    </span>
                    <span className="text-[11px] text-[#70786D] font-medium capitalize">
                      {currentWorkspace?.role?.toLowerCase() || 'member'}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[#70786D] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden p-1.5 text-[#5D655A] hover:text-[#33382F] rounded-[6px]"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showWsDropdown && (
              <div className="absolute left-3 right-3 top-15 z-50 motion-popover py-1.5 text-[12.5px]">
                <div className="px-3 py-1 font-semibold text-[11px] text-[#70786D] uppercase tracking-wider">
                  Workspaces
                </div>
                {workspaces.map((ws) => (
                  <button
                    type="button"
                    key={ws.id}
                    onClick={() => {
                      setCurrentWorkspace(ws);
                      setShowWsDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#EDE7DA] transition-colors cursor-pointer ${
                      ws.id === currentWorkspace?.id
                        ? 'font-semibold text-[#33382F] bg-[#E3EBDD]/70'
                        : 'text-[#5D655A]'
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[11px] text-[#70786D] capitalize">
                      {ws.role.toLowerCase()}
                    </span>
                  </button>
                ))}
                <div className="border-t border-[#EAE4D8] mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWsDropdown(false);
                      setShowWorkspaceModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-[#596D56] hover:bg-[#EDE7DA] flex items-center gap-2 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="p-3 space-y-5 flex-1">
            {/* MY SPACE */}
            <div className="space-y-1">
              <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-[#70786D] uppercase">
                My Space
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('mywork');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-[13px] transition-colors cursor-pointer ${
                  activeTab === 'mywork'
                    ? 'bg-[#E3EBDD] text-[#33382F] font-semibold'
                    : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]'
                }`}
              >
                <CheckSquare className={`w-4 h-4 shrink-0 ${activeTab === 'mywork' ? 'text-[#596D56]' : 'text-[#70786D]'}`} />
                <span>My Work</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDigestModalOpen(true);
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-[9px] text-[13px] font-medium text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#70786D] shrink-0" />
                  <span>Daily Digest</span>
                </div>
              </button>
            </div>

            {/* PROJECTS */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2.5 pb-1">
                <span className="text-[11px] font-semibold tracking-wider text-[#70786D] uppercase">
                  Projects
                </span>
                <button
                  type="button"
                  onClick={() => setShowProjectModal(true)}
                  className="p-1 text-[#70786D] hover:text-[#33382F] rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
                  title="Create new project"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {projects.map((p) => {
                const isSelected = p.id === currentProject?.id;
                const hasBlockers = (p.blocked_count || 0) > 0;
                return (
                  <div key={p.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentProject(p);
                        if (activeTab === 'mywork') setActiveTab('board');
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-[13px] transition-colors text-left cursor-pointer ${
                        isSelected && activeTab !== 'mywork'
                          ? 'bg-[#E3EBDD] text-[#33382F] font-semibold'
                          : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: hasBlockers
                            ? '#A46F5C'
                            : isSelected
                            ? '#596D56'
                            : '#B9A27C',
                        }}
                      />
                      <span className="truncate flex-1">{p.name}</span>
                      {hasBlockers && (
                        <span
                          className="text-[11px] text-[#A46F5C] bg-[#F3E7DD] px-1.5 py-0.2 rounded-[4px] font-medium"
                          data-tabular-nums="true"
                          title={`${p.blocked_count} active blocker(s)`}
                        >
                          {p.blocked_count}
                        </span>
                      )}
                    </button>

                    {isSelected && activeTab !== 'mywork' && (
                      <div className="pl-5 space-y-0.5 border-l border-[#DED8CB] ml-3.5 my-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('board');
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-[12.5px] transition-colors cursor-pointer ${
                            activeTab === 'board'
                              ? 'text-[#33382F] font-semibold bg-[#EDE7DA]/80'
                              : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]/50'
                          }`}
                        >
                          <Kanban className="w-3.5 h-3.5 text-[#596D56]" />
                          <span>Board</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('blockers');
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[12.5px] transition-colors cursor-pointer ${
                            activeTab === 'blockers'
                              ? 'text-[#33382F] font-semibold bg-[#EDE7DA]/80'
                              : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#A46F5C]" />
                            <span>Blockers</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('decisions');
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-[12.5px] transition-colors cursor-pointer ${
                            activeTab === 'decisions'
                              ? 'text-[#33382F] font-semibold bg-[#EDE7DA]/80'
                              : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]/50'
                          }`}
                        >
                          <FileCheck className="w-3.5 h-3.5 text-[#596D56]" />
                          <span>Decisions</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowProjectModal(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[9px] text-[12.5px] font-medium text-[#596D56] hover:bg-[#EDE7DA] transition-colors cursor-pointer mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            </div>

            {/* Compact Team Members & Presence */}
            <TeamPulseWidget
              onSelectTask={(taskId) => {
                setSelectedNotificationTaskId(taskId);
                setMobileSidebarOpen(false);
              }}
              onFilterUser={() => {
                setActiveTab('board');
                setMobileSidebarOpen(false);
              }}
            />
          </div>

          {/* Sidebar Footer: Workspace Members / Settings */}
          <div className="p-3 border-t border-[#DED8CB]">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-[13px] font-medium text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#70786D]" />
              <span>Members &amp; Invites</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F7F4EC]">
        {/* Global Header: 60px tall, light warm-white surface (#FFFCF6) with bottom divider (#DED8CB) */}
        <header className="h-[60px] bg-[#FFFCF6] border-b border-[#DED8CB] px-4 md:px-7 flex items-center justify-between gap-4 shrink-0 z-30">
          {/* Left: Mobile Toggle & MOTION mark + workspace context */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA] rounded-[6px] cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-[13px] min-w-0">
              <span className="font-bold text-[#33382F] tracking-tight">MOTION</span>
              <span className="text-[#DED8CB]" aria-hidden="true">/</span>
              <span className="text-[#5D655A] font-medium truncate">
                {currentWorkspace?.name || 'Workspace'}
              </span>
            </div>
          </div>

          {/* Center/Right: Compact Search, Presence, Account Switcher, Notifications, Avatar */}
          <div className="flex items-center gap-2.5 shrink-0">
            <HeaderSearchBar onSearchFocus={() => setActiveTab('board')} />

            {/* Real Teammate Presence (only when genuine other viewers exist) */}
            {otherActiveViewers.length > 0 && (
              <div
                className="hidden lg:flex items-center gap-1.5 text-[12px] text-[#33382F] bg-[#E6EEE4] px-2.5 py-1 rounded-[6px]"
                title={otherActiveViewers.map((v) => v.name).join(', ')}
              >
                <Circle className="w-2 h-2 fill-[#62866B] text-[#62866B]" />
                <span className="font-medium">
                  {otherActiveViewers[0].name.split(' ')[0]}
                  {otherActiveViewers.length > 1 ? ` +${otherActiveViewers.length - 1}` : ''} active
                </span>
              </div>
            )}

            {/* Quick Account Switcher */}
            {demoUsers.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDemoUserMenu((p) => !p)}
                  className="text-[12px] px-2.5 py-1.5 text-[#5D655A] hover:text-[#33382F] bg-[#F3EFE5] hover:bg-[#EDE7DA] border border-[#DED8CB] rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Switch active user account"
                >
                  <span className="hidden sm:inline text-[#70786D]">Account:</span>
                  <span className="font-semibold text-[#33382F]">
                    {user?.name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[#70786D]" />
                </button>

                {showDemoUserMenu && (
                  <div className="absolute right-0 top-10 z-50 motion-popover py-1.5 w-56 text-[12.5px]">
                    <div className="px-3.5 py-1 font-semibold text-[11px] text-[#70786D] uppercase tracking-wider">
                      Switch Active Account
                    </div>
                    {demoUsers.map((du) => (
                      <button
                        type="button"
                        key={du.id}
                        onClick={() => {
                          switchUserFast(du);
                          setShowDemoUserMenu(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 hover:bg-[#EDE7DA] transition-colors cursor-pointer ${
                          du.id === user?.id ? 'font-semibold text-[#33382F] bg-[#E3EBDD]/70' : 'text-[#5D655A]'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${getAvatarColor(
                            du.name
                          )}`}
                        >
                          {getInitials(du.name)}
                        </span>
                        <div className="truncate">
                          <p className="leading-tight truncate font-semibold text-[#33382F]">{du.name}</p>
                          <p className="text-[11px] text-[#70786D] leading-tight truncate">{du.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <NotificationPopover onSelectTask={(id) => setSelectedNotificationTaskId(id)} />

            {/* User Avatar Menu (32px) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown((p) => !p)}
                className="rounded-full focus:outline-hidden cursor-pointer"
                aria-label="User account menu"
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[11.5px] font-semibold ${getAvatarColor(
                    user?.name || ''
                  )}`}
                >
                  {getInitials(user?.name || '')}
                </span>
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-10 z-50 motion-popover py-1.5 w-48 text-[12.5px]">
                  <div className="px-3.5 py-2 border-b border-[#EAE4D8]">
                    <p className="font-semibold text-[#33382F] leading-tight truncate">{user?.name}</p>
                    <p className="text-[11px] text-[#70786D] leading-tight truncate mt-0.5">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      setIsInviteModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA] flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-[#70786D]" />
                    <span>Members &amp; Invites</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      logout();
                    }}
                    className="w-full text-left px-3.5 py-2 text-[#985C51] hover:bg-[#F3E7DD]/60 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Work Surface */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F7F4EC]">
          {activeTab === 'board' && (
            <KanbanBoard
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenInvite={() => setIsInviteModalOpen(true)}
            />
          )}
          {activeTab === 'blockers' && (
            <BlockerRadarView onNavigateTab={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'decisions' && (
            <DecisionsView onNavigateTab={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'mywork' && <MyWorkView />}
        </main>
      </div>

      {/* Invite Modal */}
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />

      {/* Header Quick Task Modal */}
      {currentProject && (
        <CreateTaskModal
          projectId={currentProject.id}
          columns={projectColumns}
          members={workspaceMembers}
          isOpen={isHeaderCreateTaskOpen}
          onClose={() => setIsHeaderCreateTaskOpen(false)}
          onSuccess={() => {}}
        />
      )}

      {/* Notification Click Task Detail Modal */}
      {selectedNotificationTaskId && (
        <TaskDetailModal
          taskId={selectedNotificationTaskId}
          columns={projectColumns}
          members={workspaceMembers}
          isOpen={!!selectedNotificationTaskId}
          onClose={() => setSelectedNotificationTaskId(null)}
        />
      )}

      {/* Create Workspace Modal */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/25 p-4">
          <div className="motion-modal max-w-sm w-full p-6 space-y-4">
            <h2 className="text-[17px] font-semibold text-[#33382F]">Create Workspace</h2>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label htmlFor="ws-name-input" className="block text-[12.5px] font-medium text-[#5D655A] mb-1.5">
                  Workspace Name
                </label>
                <input
                  id="ws-name-input"
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Acme Studio"
                  className="w-full text-[13.5px] motion-input px-3 py-2"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceModal(false)}
                  className="px-3.5 py-2 btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 btn-primary cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/25 p-4">
          <div className="motion-modal max-w-sm w-full p-6 space-y-4">
            <h2 className="text-[17px] font-semibold text-[#33382F]">Create Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label htmlFor="proj-name-input" className="block text-[12.5px] font-medium text-[#5D655A] mb-1.5">
                  Project Name
                </label>
                <input
                  id="proj-name-input"
                  type="text"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="e.g. Atlas Dashboard"
                  className="w-full text-[13.5px] motion-input px-3 py-2"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="proj-desc-input" className="block text-[12.5px] font-medium text-[#5D655A] mb-1.5">
                  Description
                </label>
                <textarea
                  id="proj-desc-input"
                  rows={2}
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  placeholder="Short project summary or current focus..."
                  className="w-full text-[13.5px] motion-input p-3 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-3.5 py-2 btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 btn-primary cursor-pointer"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Digest Modal */}
      <DailyDigestModal
        isOpen={isDigestModalOpen}
        onClose={() => setIsDigestModalOpen(false)}
      />
    </div>
  );
}
