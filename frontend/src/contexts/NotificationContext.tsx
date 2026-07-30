'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  notificationService,
  AppNotification,
  NotificationFilters,
} from '@/lib/notifications';
import { API_URL } from '@/lib/api';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markComplete: (id: string, status: 'ONGOING' | 'COMPLETED') => Promise<void>;
  removeNotification: (id: string) => void;
  selectedIds: string[];
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  bulkMarkAsRead: () => Promise<void>;
  bulkMarkAsUnread: () => Promise<void>;
  bulkMarkComplete: (status: 'ONGOING' | 'COMPLETED') => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const LIMIT = 20;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await notificationService.getUnreadCount();
      setUnreadCount(result.count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  const fetchNotifications = useCallback(async (reset = false) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const currentOffset = reset ? 0 : offset;
      const result = await notificationService.getNotifications({
        limit: LIMIT,
        offset: currentOffset,
      });

      setNotifications((prev) => (reset ? result.notifications : [...prev, ...result.notifications]));
      setTotal(result.total);
      if (reset) {
        setOffset(LIMIT);
      } else {
        setOffset(currentOffset + LIMIT);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user, offset]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchNotifications(true), fetchUnreadCount()]);
  }, [fetchNotifications, fetchUnreadCount]);

  const loadMore = useCallback(async () => {
    if (notifications.length < total && !loading) {
      await fetchNotifications(false);
    }
  }, [notifications.length, total, loading, fetchNotifications]);

  // Initial load
  useEffect(() => {
    if (user) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // SSE real-time updates
  useEffect(() => {
    if (!user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const connect = () => {
      try {
        const url = `${API_URL}/notifications/stream`;
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.addEventListener('connected', () => {
          console.log('Notification stream connected');
        });

        es.addEventListener('notification', (event) => {
          try {
            const notification: AppNotification = JSON.parse(event.data);
            setNotifications((prev) => {
              const exists = prev.find((n) => n.id === notification.id);
              if (exists) {
                return prev.map((n) => (n.id === notification.id ? notification : n));
              }
              return [notification, ...prev];
            });
            setUnreadCount((prev) => (notification.is_read ? prev : prev + 1));

            // Optional toast for high-priority types
            if (notification.type === 'CHANGE_REQUEST' || notification.type === 'CASE_ASSIGNMENT') {
              toast.info(notification.title || 'New notification', {
                description: notification.message,
                action: {
                  label: 'View',
                  onClick: () => {
                    window.location.href = notification.action_url || '/crm/notifications';
                  },
                },
              });
            }
          } catch (err) {
            console.error('Failed to parse notification stream data:', err);
          }
        });

        es.addEventListener('heartbeat', () => {
          // Connection alive
        });

        es.onerror = () => {
          console.warn('Notification stream error, reconnecting...');
          es.close();
          eventSourceRef.current = null;
          // Reconnect after delay
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error('Failed to connect to notification stream:', err);
      }
    };

    connect();

    // Fallback polling if SSE is not supported or fails
    const fallbackInterval = setInterval(() => {
      fetchUnreadCount();
    }, 60000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      clearInterval(fallbackInterval);
    };
  }, [user, fetchUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await notificationService.markAsRead(id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark as read');
      await refresh();
    }
  }, [refresh]);

  const markAsUnread = useCallback(async (id: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      setUnreadCount((prev) => prev + 1);
      await notificationService.markAsUnread(id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark as unread');
      await refresh();
    }
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await notificationService.markAllAsRead();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark all as read');
      await refresh();
    }
  }, [refresh]);

  const markComplete = useCallback(async (id: string, status: 'ONGOING' | 'COMPLETED') => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, completion_status: status } : n))
      );
      await notificationService.markCompletion(id, status);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update completion status');
      await refresh();
    }
  }, [refresh]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const bulkMarkAsRead = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      setNotifications((prev) =>
        prev.map((n) => (selectedIds.includes(n.id) ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - selectedIds.filter((id) => {
        const n = notifications.find((n) => n.id === id);
        return n && !n.is_read;
      }).length));
      await Promise.all(selectedIds.map((id) => notificationService.markAsRead(id)));
      clearSelection();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark as read');
      await refresh();
    }
  }, [selectedIds, notifications, refresh, clearSelection]);

  const bulkMarkAsUnread = useCallback(async () => {
    // No bulk unread endpoint; update one by one
    await Promise.all(selectedIds.map((id) => markAsUnread(id)));
    clearSelection();
  }, [selectedIds, markAsUnread, clearSelection]);

  const bulkMarkComplete = useCallback(async (status: 'ONGOING' | 'COMPLETED') => {
    await Promise.all(selectedIds.map((id) => markComplete(id, status)));
    clearSelection();
  }, [selectedIds, markComplete, clearSelection]);

  const hasMore = notifications.length < total;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        markComplete,
        removeNotification,
        selectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        bulkMarkAsRead,
        bulkMarkAsUnread,
        bulkMarkComplete,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
