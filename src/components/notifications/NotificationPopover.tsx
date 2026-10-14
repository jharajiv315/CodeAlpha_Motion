import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { NotificationItem } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { useRealtime } from '../../contexts/RealtimeContext.tsx';
import { formatRelativeTime } from '../../lib/utils.ts';
import { Bell, CheckCheck, AlertTriangle, UserCheck, MessageSquare, Check } from 'lucide-react';

interface NotificationPopoverProps {
  onSelectTask: (taskId: string) => void;
}

export function NotificationPopover({ onSelectTask }: NotificationPopoverProps) {
  const { refreshKey } = useRealtime();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.notifications.list();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, refreshKey]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.is_read) {
      api.notifications.markRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.entity_type === 'TASK') {
      onSelectTask(n.entity_id);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative text-[#6D7480] hover:text-[#20242B] p-1.5 rounded-lg hover:bg-[#F4F5F7] transition-colors"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B97828] ring-1 ring-white" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 w-80 sm:w-88 bg-white border border-[#E7E9ED] rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#E7E9ED] bg-[#F8F9FB]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#20242B]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] text-[#92400E] bg-[#FEF3C7] font-semibold px-1.5 py-0.2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-[#6D7480] hover:text-[#20242B] font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#F4F5F7]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9CA3AF]">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 flex items-start gap-2.5 hover:bg-[#F8F9FB] transition-colors cursor-pointer text-left ${
                    !n.is_read ? 'bg-[#FAF8F5]/60' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'BLOCKER_ASSIGNED' ? (
                      <span className="p-1 bg-[#FEF3C7] text-[#92400E] rounded inline-block">
                        <AlertTriangle className="w-3 h-3 text-[#B97828]" />
                      </span>
                    ) : n.type === 'TASK_ASSIGNED' ? (
                      <span className="p-1 bg-[#F4F5F7] text-[#20242B] rounded inline-block">
                        <UserCheck className="w-3 h-3 text-[#6D7480]" />
                      </span>
                    ) : (
                      <span className="p-1 bg-[#F4F5F7] text-[#20242B] rounded inline-block">
                        <MessageSquare className="w-3 h-3 text-[#6D7480]" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-0.5 min-w-0">
                    <p className={`text-xs ${!n.is_read ? 'font-semibold text-[#20242B]' : 'font-medium text-[#4B5563]'}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-[#6D7480] line-clamp-2 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-[#9CA3AF] pt-0.5 font-mono" data-tabular-nums="true">
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </div>

                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkRead(n.id, e)}
                      className="text-[#9CA3AF] hover:text-[#20242B] p-0.5 shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
