'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Clock, Loader2, X } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    markComplete,
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleItemClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    setOpen(false);
    if (notification.case_id) {
      router.push(`/crm/cases/${notification.case_id}`);
    } else {
      router.push('/crm/notifications');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'CHANGE_REQUEST':
        return <span className="w-2 h-2 rounded-full bg-yellow-500" />;
      case 'CASE_ASSIGNMENT':
        return <span className="w-2 h-2 rounded-full bg-blue-500" />;
      case 'STATUS_CHANGE':
        return <span className="w-2 h-2 rounded-full bg-purple-500" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[20px] h-5 px-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => router.push('/crm/notifications')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                View all
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <>
                {notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.is_read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleItemClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5">{getIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.title || 'Notification'}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                          {notification.case_number && (
                            <span className="text-xs text-gray-400">
                              • {notification.case_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notification.is_read) {
                              // markAsUnread(notification.id); // Optional
                            } else {
                              markAsRead(notification.id);
                            }
                          }}
                          className={`p-1 rounded transition-colors ${
                            notification.is_read
                              ? 'text-gray-300 cursor-default'
                              : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                          }`}
                          title={notification.is_read ? 'Read' : 'Mark as read'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <button
                    onClick={() => loadMore()}
                    disabled={loading}
                    className="w-full py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      'Load more'
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
