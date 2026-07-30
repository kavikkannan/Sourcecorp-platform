import { api } from './api';

export type NotificationType =
  | 'CASE_REMINDER'
  | 'CHANGE_REQUEST'
  | 'CASE_ASSIGNMENT'
  | 'STATUS_CHANGE'
  | 'SYSTEM';

export interface NotificationUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface NotificationDocument {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
}

export interface AppNotification {
  id: string;
  case_id: string;
  case_number?: string;
  case_customer_name?: string;
  case_status?: string;
  scheduled_for: string;
  scheduled_by: string;
  scheduled_by_user?: NotificationUser;
  message?: string;
  title?: string;
  scheduled_at: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  is_read: boolean;
  completion_status: 'ONGOING' | 'COMPLETED';
  type: NotificationType;
  action_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  document?: NotificationDocument | null;
  change_request_id?: string;
  change_request_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  change_request_changes?: Record<string, any>;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  in_app: boolean;
  email: boolean;
  push: boolean;
  digest_mode: 'IMMEDIATE' | 'DAILY' | 'WEEKLY';
  created_at: string;
  updated_at: string;
}

export interface NotificationFilters {
  is_read?: boolean;
  completion_status?: 'ONGOING' | 'COMPLETED';
  type?: NotificationType;
  due_date_from?: string;
  due_date_to?: string;
  limit?: number;
  offset?: number;
}

export const notificationService = {
  async getNotifications(
    filters?: NotificationFilters
  ): Promise<{ notifications: AppNotification[]; total: number }> {
    const response = await api.get('/notifications', { params: filters });
    return response.data;
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  async markAsRead(notificationId: string): Promise<AppNotification> {
    const response = await api.patch(`/notifications/${notificationId}/read`, {
      is_read: true,
    });
    return response.data;
  },

  async markAsUnread(notificationId: string): Promise<AppNotification> {
    const response = await api.patch(`/notifications/${notificationId}/unread`);
    return response.data;
  },

  async markAllAsRead(): Promise<{ updated: number }> {
    const response = await api.post('/notifications/mark-all-read');
    return response.data;
  },

  async markCompletion(
    notificationId: string,
    completionStatus: 'ONGOING' | 'COMPLETED'
  ): Promise<{ id: string; completion_status: 'ONGOING' | 'COMPLETED' }> {
    const response = await api.patch(`/notifications/${notificationId}/completion`, {
      completion_status: completionStatus,
    });
    return response.data;
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await api.delete(`/notifications/${notificationId}`);
  },

  async getPreferences(): Promise<{ preferences: NotificationPreference[] }> {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  async updatePreference(
    notificationType: NotificationType,
    data: Partial<Omit<NotificationPreference, 'id' | 'user_id' | 'notification_type' | 'created_at' | 'updated_at'>>
  ): Promise<{ preference: NotificationPreference }> {
    const response = await api.put('/notifications/preferences', {
      notification_type: notificationType,
      ...data,
    });
    return response.data;
  },
};
