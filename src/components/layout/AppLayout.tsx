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
  Folder,
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

  // Quick Task Creation Modal from header button
  const [isHeaderCreateTaskOpen, setIsHeaderCreateTaskOpen] = useState(false);
  const [projectColumns, setProjectColumns] = useState<BoardColumn[]>([]);

  // Demo users
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [showDemoUserMenu, setShowDemoUserMenu] = useState(false);

  // Workspace/Project modals
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  // Dropdown & Mobile sidebar state
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

  // Other active teammates currently online (excluding self)
  const otherActiveViewers = activeViewers.filter((v) => v.userId !== user?.id);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FB] text-[#20242B] font-sans antialiased">
      {/* Sidebar: 240px desktop width, calm #F4F5F7 surface */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#F4F5F7] border-r border-[#E7E9ED] flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Workspace Switcher Header */}
          <div className="p-3 border-b border-[#E7E9ED]/60 relative">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowWsDropdown((p) => !p)}
                className="w-full flex items-center justify-between p-1.5 hover:bg-[#EAECEF] rounded-lg transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-[#20242B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {currentWorkspace?.name ? currentWorkspace.name[0].toUpperCase() : 'M'}
                  </div>
                  <span className="text-xs font-semibold text-[#20242B] truncate">
                    {currentWorkspace?.name || 'Workspace'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#6D7480] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden p-1 text-[#6D7480]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Workspace Dropdown */}
            {showWsDropdown && (
              <div className="absolute left-3 right-3 top-12 z-50 bg-white border border-[#E7E9ED] rounded-xl shadow-lg py-1 text-xs">
                <div className="px-3 py-1 font-medium text-[10px] text-[#6D7480] uppercase tracking-wider">
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
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#F8F9FB] ${
                      ws.id === currentWorkspace?.id ? 'font-semibold text-[#20242B]' : 'text-[#6D7480]'
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[10px] text-[#9CA3AF] capitalize">{ws.role.toLowerCase()}</span>
                  </button>
                ))}
                <div className="border-t border-[#E7E9ED] mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWsDropdown(false);
                      setShowWorkspaceModal(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#20242B] hover:bg-[#F8F9FB] flex items-center gap-1.5 font-medium"
                  >
                    <Plus className="w-3 h-3 text-[#6D7480]" />
                    <span>New Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="p-3 space-y-5 flex-1">
            {/* MY WORK */}
            <div className="space-y-0.5">
              <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-[#6D7480] uppercase">
                My Work
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('mywork');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'mywork'
                    ? 'bg-[#EAECEF] text-[#20242B] font-semibold'
                    : 'text-[#6D7480] hover:text-[#20242B] hover:bg-[#EAECEF]/60'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span>My Tasks</span>
              </button>
            </div>

            {/* PROJECTS */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-[10px] font-semibold tracking-wider text-[#6D7480] uppercase">
                  Projects
                </span>
                <button
                  type="button"
                  onClick={() => setShowProjectModal(true)}
                  className="p-0.5 text-[#6D7480] hover:text-[#20242B] rounded transition-colors"
                  title="Create new project"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {projects.map((p) => {
                const isSelected = p.id === currentProject?.id;
                return (
                  <div key={p.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentProject(p);
                        if (activeTab === 'mywork') setActiveTab('board');
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                        isSelected && activeTab !== 'mywork'
                          ? 'text-[#20242B] font-semibold'
                          : 'text-[#6D7480] hover:text-[#20242B] hover:bg-[#EAECEF]/60'
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5 shrink-0 text-[#6D7480]" />
                      <span className="truncate flex-1">{p.name}</span>
                      {p.blocked_count && p.blocked_count > 0 ? (
                        <span className="text-[10px] text-[#B97828] font-semibold">
                          {p.blocked_count}b
                        </span>
                      ) : null}
                    </button>

                    {/* Nested views under active project */}
                    {isSelected && activeTab !== 'mywork' && (
                      <div className="pl-6 space-y-0.5 border-l border-[#E7E9ED] ml-3.5 my-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('board');
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors ${
                            activeTab === 'board'
                              ? 'bg-white text-[#20242B] font-semibold shadow-2xs'
                              : 'text-[#6D7480] hover:text-[#20242B]'
                          }`}
                        >
                          <Kanban className="w-3 h-3" />
                          <span>Board</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('blockers');
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-xs transition-colors ${
                            activeTab === 'blockers'
                              ? 'bg-white text-[#20242B] font-semibold shadow-2xs'
                              : 'text-[#6D7480] hover:text-[#20242B]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3 text-[#B97828]" />
                            <span>Blocker Radar</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('decisions');
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors ${
                            activeTab === 'decisions'
                              ? 'bg-white text-[#20242B] font-semibold shadow-2xs'
                              : 'text-[#6D7480] hover:text-[#20242B]'
                          }`}
                        >
                          <FileCheck className="w-3 h-3 text-[#5965D8]" />
                          <span>Decision Notes</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Team Pulse Widget */}
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

          {/* Sidebar Footer: Team Members & Invites, Daily Digest */}
          <div className="p-3 border-t border-[#E7E9ED]/60 space-y-1">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6D7480] hover:text-[#20242B] hover:bg-[#EAECEF] transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team &amp; Invites</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDigestModalOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6D7480] hover:text-[#20242B] hover:bg-[#EAECEF] transition-colors cursor-pointer"
              title="Daily Digest email summaries of completed tasks and deadlines"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#5965D8]" />
                <span>Daily Digest</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" title="Scheduler active" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Quiet Header */}
        <header className="h-12 bg-white border-b border-[#E7E9ED] px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-30">
          {/* Left: Mobile Toggle & Context Breadcrumb */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1 text-[#6D7480] hover:text-[#20242B]"
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6D7480]">
              <span className="font-medium text-[#20242B] truncate max-w-[100px] sm:max-w-[140px]">
                {currentWorkspace?.name || 'Workspace'}
              </span>
              <span className="text-[#9CA3AF]">/</span>
              <span className="text-[#6D7480] truncate max-w-[100px] sm:max-w-[140px]">
                {activeTab === 'mywork' ? 'My Work' : currentProject?.name || 'Project'}
              </span>
              {activeTab !== 'mywork' && (
                <>
                  <span className="text-[#9CA3AF]">/</span>
                  <span className="font-semibold text-[#20242B] capitalize hidden sm:inline">
                    {activeTab === 'board'
                      ? 'Board'
                      : activeTab === 'blockers'
                      ? 'Blocker Radar'
                      : 'Decision Notes'}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Center: Search Bar in App Header */}
          <div className="flex-1 flex justify-center max-w-sm sm:max-w-md lg:max-w-lg mx-2">
            <HeaderSearchBar onSearchFocus={() => setActiveTab('board')} />
          </div>

          {/* Right: Presence, Switch User, Notifications, Avatar, + New Task */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Real Teammate Presence (Genuine Socket Presence, quiet text) */}
            {otherActiveViewers.length > 0 && (
              <div
                className="hidden lg:flex items-center gap-1.5 text-xs text-[#238565] bg-[#E6F4EA]/60 px-2 py-0.5 rounded-md"
                title={otherActiveViewers.map((v) => v.name).join(', ')}
              >
                <Circle className="w-2 h-2 fill-current" />
                <span className="text-[11px] font-medium">
                  {otherActiveViewers[0].name.split(' ')[0]}
                  {otherActiveViewers.length > 1 ? ` +${otherActiveViewers.length - 1}` : ''} online
                </span>
              </div>
            )}

            {/* Quick Demo Switcher (Quiet, dignified) */}
            {demoUsers.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDemoUserMenu((p) => !p)}
                  className="text-xs px-2 py-1 text-[#6D7480] hover:text-[#20242B] hover:bg-[#F4F5F7] rounded-md transition-colors flex items-center gap-1"
                  title="Switch user perspective for real-time collaboration verification"
                >
                  <span className="hidden sm:inline text-[11px]">As:</span>
                  <span className="font-medium text-[11px] text-[#20242B]">
                    {user?.name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
                </button>

                {showDemoUserMenu && (
                  <div className="absolute right-0 top-8 z-50 bg-white border border-[#E7E9ED] rounded-xl shadow-lg py-1 w-52 text-xs">
                    <div className="px-3 py-1 font-medium text-[10px] text-[#9CA3AF] uppercase tracking-wider">
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
                        className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#F8F9FB] ${
                          du.id === user?.id ? 'font-semibold text-[#20242B] bg-[#F4F5F7]' : 'text-[#6D7480]'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ${getAvatarColor(
                            du.name
                          )}`}
                        >
                          {getInitials(du.name)}
                        </span>
                        <div className="truncate">
                          <p className="leading-tight truncate">{du.name}</p>
                          <p className="text-[10px] text-[#9CA3AF] leading-tight truncate">{du.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notifications */}
            <NotificationPopover onSelectTask={(id) => setSelectedNotificationTaskId(id)} />

            {/* Daily Digest Modal Trigger Button */}
            <button
              type="button"
              onClick={() => setIsDigestModalOpen(true)}
              className="p-1 text-[#6D7480] hover:text-[#20242B] hover:bg-[#F4F5F7] rounded-md transition-colors relative cursor-pointer"
              title="Daily Digest Email & Schedule Settings"
              aria-label="Daily Digest Email & Schedule Settings"
            >
              <Mail className="w-4 h-4 text-[#5965D8]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] absolute top-0.5 right-0.5" title="Daily digest scheduler active" />
            </button>

            {/* User Avatar Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown((p) => !p)}
                className="p-0.5 rounded-full hover:ring-1 hover:ring-[#E7E9ED] transition-all"
                aria-label="User account menu"
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(
                    user?.name || ''
                  )}`}
                >
                  {getInitials(user?.name || '')}
                </span>
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-8 z-50 bg-white border border-[#E7E9ED] rounded-xl shadow-lg py-1 w-44 text-xs">
                  <div className="px-3 py-1.5 border-b border-[#E7E9ED]">
                    <p className="font-semibold text-[#20242B] leading-tight truncate">{user?.name}</p>
                    <p className="text-[10px] text-[#9CA3AF] leading-tight truncate">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      setIsInviteModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#6D7480] hover:text-[#20242B] hover:bg-[#F8F9FB] flex items-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Workspace Team</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#C54D4D] hover:bg-[#FEE2E2]/40 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Single Primary Action */}
            {currentProject && activeTab !== 'mywork' && (
              <button
                type="button"
                onClick={() => setIsHeaderCreateTaskOpen(true)}
                className="text-xs font-semibold bg-[#20242B] hover:bg-[#323842] text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Task</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Work Surface */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'board' && <KanbanBoard />}
          {activeTab === 'blockers' && <BlockerRadarView />}
          {activeTab === 'decisions' && <DecisionsView />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-lg border border-[#E7E9ED] max-w-sm w-full p-5 space-y-3">
            <h2 className="text-sm font-bold text-[#20242B]">Create Workspace</h2>
            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label htmlFor="ws-name-input" className="block text-xs font-medium text-[#6D7480] mb-1">
                  Workspace Name
                </label>
                <input
                  id="ws-name-input"
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Acme Studio"
                  className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceModal(false)}
                  className="px-3 py-1.5 text-xs text-[#6D7480] hover:text-[#20242B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-[#20242B] text-white rounded-lg"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-lg border border-[#E7E9ED] max-w-sm w-full p-5 space-y-3">
            <h2 className="text-sm font-bold text-[#20242B]">Create Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label htmlFor="proj-name-input" className="block text-xs font-medium text-[#6D7480] mb-1">
                  Project Name
                </label>
                <input
                  id="proj-name-input"
                  type="text"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="e.g. Webhook Pipeline"
                  className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="proj-desc-input" className="block text-xs font-medium text-[#6D7480] mb-1">
                  Description
                </label>
                <textarea
                  id="proj-desc-input"
                  rows={2}
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  placeholder="Goals, deliverables..."
                  className="w-full text-xs border border-[#E7E9ED] rounded-lg p-2 text-[#20242B] resize-none focus:outline-hidden focus:border-[#5965D8]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-3 py-1.5 text-xs text-[#6D7480] hover:text-[#20242B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-[#20242B] text-white rounded-lg"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Digest & Email Reports Modal */}
      <DailyDigestModal
        isOpen={isDigestModalOpen}
        onClose={() => setIsDigestModalOpen(false)}
      />
    </div>
  );
}
