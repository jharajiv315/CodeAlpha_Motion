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
        className="relative text-[#5D655A] hover:text-[#33382F] p-2 rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#A46F5C] ring-2 ring-[#FFFCF6]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-80 sm:w-88 motion-popover overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAE4D8] bg-[#F3EFE5]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[13px] text-[#33382F]">Inbox</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-[#E3EBDD] text-[#33382F] px-2 py-0.5 rounded-[5px]" data-tabular-nums="true">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11.5px] text-[#596D56] hover:text-[#465A44] flex items-center gap-1 font-medium cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#EAE4D8]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-[12.5px] text-[#70786D]">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                let icon = <Bell className="w-3.5 h-3.5 text-[#5D655A]" />;
                if (n.type.includes('BLOCKER')) {
                  icon = <AlertTriangle className="w-3.5 h-3.5 text-[#A46F5C]" />;
                } else if (n.type.includes('ASSIGNED')) {
                  icon = <UserCheck className="w-3.5 h-3.5 text-[#596D56]" />;
                } else if (n.type.includes('COMMENT')) {
                  icon = <MessageSquare className="w-3.5 h-3.5 text-[#596D56]" />;
                }

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 hover:bg-[#EDE7DA] transition-colors cursor-pointer flex items-start justify-between gap-2.5 text-[12.5px] ${
                      !n.is_read ? 'bg-[#F3EFE5]/70' : 'bg-[#FFFDF9]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-snug ${!n.is_read ? 'font-semibold text-[#33382F]' : 'text-[#5D655A]'}`}>
                        {n.title}
                      </p>
                      <p className="text-[12px] text-[#5D655A] truncate mt-0.5">
                        {n.body}
                      </p>
                      <span className="text-[11px] text-[#70786D] mt-1 block" data-tabular-nums="true">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="text-[#70786D] hover:text-[#33382F] p-1 rounded-[4px] hover:bg-[#EDE7DA] shrink-0"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
