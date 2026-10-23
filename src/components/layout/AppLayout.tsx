import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { useSearch } from '../../contexts/SearchContext.tsx';
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
import {
  KeyboardShortcutsModal,
  type ShortcutCommand,
} from '../shortcuts/KeyboardShortcutsModal.tsx';
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
  Keyboard,
  Search,
  RotateCcw,
  FolderPlus,
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
  const { activeViewers, triggerRefresh } = useRealtime();
  const { setOnlyBlocked, resetFilters } = useSearch();

  const [activeTab, setActiveTab] = useState<'board' | 'blockers' | 'decisions' | 'mywork'>('board');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
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

  const wsDropdownRef = useRef<HTMLDivElement>(null);
  const demoUserMenuRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showWsDropdown && !showDemoUserMenu && !showUserDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showWsDropdown && wsDropdownRef.current && !wsDropdownRef.current.contains(target)) {
        setShowWsDropdown(false);
      }
      if (showDemoUserMenu && demoUserMenuRef.current && !demoUserMenuRef.current.contains(target)) {
        setShowDemoUserMenu(false);
      }
      if (showUserDropdown && userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWsDropdown, showDemoUserMenu, showUserDropdown]);

  useEffect(() => {
    api.auth.getDemoUsers().then((res) => setDemoUsers(res.users)).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentProject) {
      api.projects.getColumns(currentProject.id).then((res) => setProjectColumns(res.columns)).catch(() => {});
    }
  }, [currentProject]);

  const focusGlobalSearch = useCallback(() => {
    setActiveTab('board');
    setTimeout(() => {
      const searchEl = document.getElementById('global-task-search-input') as HTMLInputElement | null;
      searchEl?.focus();
      searchEl?.select();
    }, 30);
  }, []);

  const openQuickNewTask = useCallback(() => {
    if (currentProject) {
      setIsHeaderCreateTaskOpen(true);
    }
  }, [currentProject]);

  const shortcutCommands = useMemo<ShortcutCommand[]>(
    () => [
      {
        id: 'search-tasks',
        title: 'Search tasks & notes',
        description: 'Focus the global search bar to filter tasks by title, assignee, or blocker',
        category: 'Quick Actions',
        keys: ['⌘', 'K'],
        aliases: ['cmd+k', 'ctrl+k', 'search', 'find', '/'],
        icon: <Search className="w-3.5 h-3.5" />,
        action: focusGlobalSearch,
      },
      {
        id: 'new-task-note',
        title: 'Create new task / note',
        description: 'Open the quick task & note composer in the active project',
        category: 'Quick Actions',
        keys: ['⌘', 'N'],
        aliases: ['cmd+n', 'ctrl+n', 'new note', 'new task', 'create', 'add'],
        icon: <Plus className="w-3.5 h-3.5" />,
        action: openQuickNewTask,
      },
      {
        id: 'new-project',
        title: 'Create new project',
        description: 'Start a new project board in the current workspace',
        category: 'Quick Actions',
        keys: ['⌘', 'J'],
        aliases: ['cmd+j', 'ctrl+j', 'project'],
        icon: <FolderPlus className="w-3.5 h-3.5" />,
        action: () => setShowProjectModal(true),
      },
      {
        id: 'invite-teammates',
        title: 'Invite teammates & members',
        description: 'Generate shareable workspace invite links or manage members',
        category: 'Quick Actions',
        keys: ['⌘', 'I'],
        aliases: ['cmd+i', 'ctrl+i', 'invite', 'team', 'members'],
        icon: <Users className="w-3.5 h-3.5" />,
        action: () => setIsInviteModalOpen(true),
      },
      {
        id: 'daily-digest',
        title: 'Open Daily Digest',
        description: 'Preview or send automated daily email summaries and blocker reports',
        category: 'Quick Actions',
        keys: ['⌘', 'M'],
        aliases: ['cmd+m', 'ctrl+m', 'digest', 'email', 'report'],
        icon: <Mail className="w-3.5 h-3.5" />,
        action: () => setIsDigestModalOpen(true),
      },
      {
        id: 'nav-board',
        title: 'Go to Project Board',
        description: 'Switch to the main Kanban board, swimlanes, and timeline view',
        category: 'Navigation',
        keys: ['1'],
        aliases: ['board', 'kanban', 'tasks'],
        icon: <Kanban className="w-3.5 h-3.5" />,
        action: () => setActiveTab('board'),
      },
      {
        id: 'nav-mywork',
        title: 'Go to My Work',
        description: 'View tasks assigned to you and blockers awaiting your input',
        category: 'Navigation',
        keys: ['2'],
        aliases: ['my work', 'assigned', 'personal'],
        icon: <CheckSquare className="w-3.5 h-3.5" />,
        action: () => setActiveTab('mywork'),
      },
      {
        id: 'nav-blockers',
        title: 'Go to Blockers',
        description: 'Inspect active project blockers and resolution history',
        category: 'Navigation',
        keys: ['3'],
        aliases: ['blockers', 'radar', 'blocked', 'cmd+b'],
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        action: () => setActiveTab('blockers'),
      },
      {
        id: 'nav-decisions',
        title: 'Go to Decision Notes',
        description: 'Browse recorded architectural decisions and task agreements',
        category: 'Navigation',
        keys: ['4'],
        aliases: ['decisions', 'notes', 'agreements', 'cmd+d'],
        icon: <FileCheck className="w-3.5 h-3.5" />,
        action: () => setActiveTab('decisions'),
      },
      {
        id: 'filter-blocked',
        title: 'Toggle Blocked Tasks filter',
        description: 'Filter the project board to show only blocked tasks',
        category: 'Filtering & Search',
        keys: ['⇧', 'B'],
        aliases: ['shift+b', 'filter blocked'],
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        action: () => {
          setActiveTab('board');
          setOnlyBlocked((prev) => !prev);
        },
      },
      {
        id: 'reset-filters',
        title: 'Reset all active filters',
        description: 'Clear search query, assignee, priority, and blocked filters',
        category: 'Filtering & Search',
        keys: ['⇧', 'R'],
        aliases: ['shift+r', 'clear filters', 'reset'],
        icon: <RotateCcw className="w-3.5 h-3.5" />,
        action: () => {
          resetFilters();
        },
      },
      {
        id: 'open-shortcuts',
        title: 'Keyboard Shortcuts Manager',
        description: 'Display this command reference and keyboard shortcut guide',
        category: 'General',
        keys: ['⌘', '/'],
        aliases: ['?', 'help', 'shortcuts', 'commands'],
        icon: <Keyboard className="w-3.5 h-3.5" />,
        action: () => setIsShortcutsModalOpen(true),
      },
    ],
    [focusGlobalSearch, openQuickNewTask, setOnlyBlocked, resetFilters]
  );

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const hasMod = e.metaKey || e.ctrlKey;
      const keyLower = e.key.toLowerCase();

      // ⌘/ or Ctrl+/ toggles Keyboard Shortcuts modal from anywhere
      if (hasMod && e.key === '/') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // ⌘K or Ctrl+K focuses search (and closes shortcuts modal if open)
      if (hasMod && keyLower === 'k') {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        focusGlobalSearch();
        return;
      }

      // ⌘N or Ctrl+N opens New Task / Note modal
      if (hasMod && keyLower === 'n') {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        openQuickNewTask();
        return;
      }

      // ⌘J or Ctrl+J opens Create New Project modal
      if (hasMod && keyLower === 'j') {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        setShowProjectModal(true);
        return;
      }

      // ⌘I or Ctrl+I opens Invite & Members modal
      if (hasMod && keyLower === 'i') {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        setIsInviteModalOpen(true);
        return;
      }

      // ⌘M or Ctrl+M opens Daily Digest modal
      if (hasMod && keyLower === 'm') {
        e.preventDefault();
        setIsShortcutsModalOpen(false);
        setIsDigestModalOpen(true);
        return;
      }

      // Do not intercept plain single-key shortcuts when typing in an input or when Shortcuts modal is open
      if (isEditable || isShortcutsModalOpen || hasMod || e.altKey) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.key === '1' && !e.shiftKey) {
        e.preventDefault();
        setActiveTab('board');
      } else if (e.key === '2' && !e.shiftKey) {
        e.preventDefault();
        setActiveTab('mywork');
      } else if (e.key === '3' && !e.shiftKey) {
        e.preventDefault();
        setActiveTab('blockers');
      } else if (e.key === '4' && !e.shiftKey) {
        e.preventDefault();
        setActiveTab('decisions');
      } else if (e.shiftKey && keyLower === 'b') {
        e.preventDefault();
        setActiveTab('board');
        setOnlyBlocked((prev) => !prev);
      } else if (e.shiftKey && keyLower === 'r') {
        e.preventDefault();
        resetFilters();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    focusGlobalSearch,
    openQuickNewTask,
    isShortcutsModalOpen,
    setOnlyBlocked,
    resetFilters,
  ]);

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
          <div ref={wsDropdownRef} className="p-3 border-b border-[#DED8CB] relative">
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
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-[9px] text-[13px] transition-colors cursor-pointer ${
                  activeTab === 'mywork'
                    ? 'bg-[#E3EBDD] text-[#33382F] font-semibold'
                    : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className={`w-4 h-4 shrink-0 ${activeTab === 'mywork' ? 'text-[#596D56]' : 'text-[#70786D]'}`} />
                  <span>My Work</span>
                </div>
                <span className="text-[10.5px] font-mono text-[#70786D]">2</span>
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
                <span className="text-[10.5px] font-mono text-[#70786D]">⌘M</span>
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
                  title="Create new project (⌘J)"
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
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[12.5px] transition-colors cursor-pointer ${
                            activeTab === 'board'
                              ? 'text-[#33382F] font-semibold bg-[#EDE7DA]/80'
                              : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Kanban className="w-3.5 h-3.5 text-[#596D56]" />
                            <span>Board</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#70786D]">1</span>
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
                          <span className="text-[10px] font-mono text-[#70786D]">3</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('decisions');
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-[12.5px] transition-colors cursor-pointer ${
                            activeTab === 'decisions'
                              ? 'text-[#33382F] font-semibold bg-[#EDE7DA]/80'
                              : 'text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA]/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileCheck className="w-3.5 h-3.5 text-[#596D56]" />
                            <span>Decisions</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#70786D]">4</span>
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

          {/* Sidebar Footer: Workspace Members & Keyboard Shortcuts */}
          <div className="p-3 border-t border-[#DED8CB] space-y-1">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-[9px] text-[13px] font-medium text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-[#70786D]" />
                <span>Members &amp; Invites</span>
              </div>
              <span className="text-[10.5px] font-mono text-[#70786D]">⌘I</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-[9px] text-[13px] font-medium text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-[#70786D]" />
                <span>Keyboard Shortcuts</span>
              </div>
              <span className="text-[10.5px] font-mono text-[#70786D]">?</span>
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

          {/* Center/Right: Compact Search, Shortcuts Button, Presence, Account Switcher, Notifications, Avatar */}
          <div className="flex items-center gap-2.5 shrink-0">
            <HeaderSearchBar onSearchFocus={() => setActiveTab('board')} />

            {/* Keyboard Shortcuts Manager Trigger */}
            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-[#5D655A] hover:text-[#33382F] bg-[#F3EFE5] hover:bg-[#EDE7DA] border border-[#DED8CB] rounded-[6px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Keyboard Shortcuts & Commands (⌘/ or ?)"
              aria-label="Open keyboard shortcuts manager"
            >
              <Keyboard className="w-3.5 h-3.5 text-[#70786D]" />
              <span className="hidden lg:inline font-medium">Shortcuts</span>
              <kbd className="px-1.5 py-0.2 text-[10.5px] font-mono font-semibold text-[#33382F] bg-[#FFFCF6] border border-[#DED8CB] rounded-[4px]">
                ⌘/
              </kbd>
            </button>

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
              <div ref={demoUserMenuRef} className="relative">
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
            <div ref={userDropdownRef} className="relative">
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
                <div className="absolute right-0 top-10 z-50 motion-popover py-1.5 w-52 text-[12.5px]">
                  <div className="px-3.5 py-2 border-b border-[#EAE4D8]">
                    <p className="font-semibold text-[#33382F] leading-tight truncate">{user?.name}</p>
                    <p className="text-[11px] text-[#70786D] leading-tight truncate mt-0.5">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      setIsShortcutsModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[#5D655A] hover:text-[#33382F] hover:bg-[#EDE7DA] flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-[#70786D]" />
                      <span>Keyboard Shortcuts</span>
                    </span>
                    <span className="text-[10.5px] font-mono text-[#70786D]">?</span>
                  </button>
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

      {/* Header / Shortcut Quick Task & Note Modal (CMD+N) */}
      {currentProject && (
        <CreateTaskModal
          projectId={currentProject.id}
          columns={projectColumns}
          members={workspaceMembers}
          isOpen={isHeaderCreateTaskOpen}
          onClose={() => setIsHeaderCreateTaskOpen(false)}
          onSuccess={() => {
            triggerRefresh();
          }}
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
        <div
          onClick={() => setShowWorkspaceModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/25 backdrop-blur-[1px] p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="motion-modal max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
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
        <div
          onClick={() => setShowProjectModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/25 backdrop-blur-[1px] p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="motion-modal max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
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

      {/* Global Keyboard Shortcuts Manager Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        commands={shortcutCommands}
      />
    </div>
  );
}
