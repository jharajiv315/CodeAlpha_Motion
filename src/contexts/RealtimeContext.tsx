import React, { createContext, useContext, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ActiveViewer } from '../types/index.ts';
import { getSocket } from '../lib/socket.ts';
import { useAuth } from './AuthContext.tsx';
import { useWorkspace } from './WorkspaceContext.tsx';

interface RealtimeNotificationToast {
  id: string;
  type: 'info' | 'blocker' | 'decision' | 'task';
  message: string;
  subtext?: string;
}

interface RealtimeContextType {
  activeViewers: ActiveViewer[];
  toasts: RealtimeNotificationToast[];
  removeToast: (id: string) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentProject } = useWorkspace();
  const [activeViewers, setActiveViewers] = useState<ActiveViewer[]>([]);
  const [toasts, setToasts] = useState<RealtimeNotificationToast[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const addToast = (toast: Omit<RealtimeNotificationToast, 'id'>) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    if (currentProject) {
      socket.emit('join:project', { projectId: currentProject.id });
    }

    const onPresence = (data: { projectId: string; viewers: ActiveViewer[] }) => {
      if (currentProject && data.projectId === currentProject.id) {
        setActiveViewers(data.viewers);
      }
    };

    const onTaskCreated = (data: any) => {
      if (currentProject && data.task?.project_id === currentProject.id) {
        triggerRefresh();
        if (data.task?.creator_id !== user?.id) {
          addToast({
            type: 'task',
            message: `New task added: "${data.task.title}"`,
            subtext: `Created by ${data.task.creator_name || 'teammate'}`,
          });
        }
      }
    };

    const onTaskUpdated = (data: any) => {
      if (currentProject && data.task?.project_id === currentProject.id) {
        triggerRefresh();
      }
    };

    const onTaskMoved = (data: any) => {
      if (currentProject && data.projectId === currentProject.id) {
        triggerRefresh();
      }
    };

    const onTaskDeleted = (data: any) => {
      if (currentProject && data.projectId === currentProject.id) {
        triggerRefresh();
      }
    };

    const onBlockerCreated = (data: any) => {
      if (currentProject && data.projectId === currentProject.id) {
        triggerRefresh();
        addToast({
          type: 'blocker',
          message: 'Task marked as Blocked',
          subtext: data.blocker?.reason ? `"${data.blocker.reason.substring(0, 60)}..."` : undefined,
        });
      }
    };

    const onBlockerResolved = (data: any) => {
      if (currentProject && data.projectId === currentProject.id) {
        triggerRefresh();
        addToast({
          type: 'info',
          message: 'Blocker Resolved',
          subtext: `${data.resolvedByName} resolved the blocker`,
        });
      }
    };

    const onDecisionCreated = (data: any) => {
      if (currentProject && data.projectId === currentProject.id) {
        triggerRefresh();
        addToast({
          type: 'decision',
          message: `Decision recorded: "${data.decision?.title}"`,
          subtext: `By ${data.decision?.author_name}`,
        });
      }
    };

    const onNotificationCreated = (notif: any) => {
      triggerRefresh();
      addToast({
        type: 'info',
        message: notif.title,
        subtext: notif.body,
      });
    };

    socket.on('presence:update', onPresence);
    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:moved', onTaskMoved);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('blocker:created', onBlockerCreated);
    socket.on('blocker:resolved', onBlockerResolved);
    socket.on('decision:created', onDecisionCreated);
    socket.on('notification:created', onNotificationCreated);

    return () => {
      if (currentProject) {
        socket.emit('leave:project', { projectId: currentProject.id });
      }
      socket.off('presence:update', onPresence);
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:moved', onTaskMoved);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('blocker:created', onBlockerCreated);
      socket.off('blocker:resolved', onBlockerResolved);
      socket.off('decision:created', onDecisionCreated);
      socket.off('notification:created', onNotificationCreated);
    };
  }, [currentProject, user?.id]);

  return (
    <RealtimeContext.Provider
      value={{
        activeViewers,
        toasts,
        removeToast,
        refreshKey,
        triggerRefresh,
      }}
    >
      {children}
      {/* Realtime collaborative toast display */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto p-3 bg-white border border-[#E7E9ED] rounded-xl shadow-md text-xs transition-all duration-150 animate-in slide-in-from-bottom-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-semibold text-[10px] text-[#6D7480] uppercase tracking-wider block">
                  {t.type === 'blocker' ? 'Blocker Radar' : t.type === 'decision' ? 'Decision' : 'Update'}
                </span>
                <p className="font-medium text-[#20242B] text-xs mt-0.5 truncate">{t.message}</p>
                {t.subtext && <p className="text-[11px] text-[#6D7480] mt-0.5 line-clamp-1">{t.subtext}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-[#9CA3AF] hover:text-[#20242B] p-0.5 rounded transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextType {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
