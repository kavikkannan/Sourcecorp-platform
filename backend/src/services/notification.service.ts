import { query } from '../db/pool';
import { redisClient } from '../db/redis';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { NotificationType, NotificationWithDetails, NotificationPreference, User } from '../types';
import { emailService } from './email.service';
import { notificationDigestQueue } from './queue.service';

export interface CreateNotificationData {
  case_id: string;
  scheduled_for: string;
  scheduled_by: string;
  message?: string;
  title?: string;
  scheduled_at?: Date;
  type?: NotificationType;
  action_url?: string;
  metadata?: Record<string, any>;
  document_id?: string | null;
  change_request_id?: string | null;
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

export class NotificationService {
  /**
   * Create a notification and optionally emit it in real-time.
   */
  static async createNotification(data: CreateNotificationData): Promise<NotificationWithDetails> {
    const scheduledAt = data.scheduled_at || new Date();
    const type = data.type || NotificationType.CASE_REMINDER;
    const metadata = data.metadata || {};

    const result = await query(
      `INSERT INTO crm_schema.case_notifications
       (case_id, scheduled_for, scheduled_by, message, title, scheduled_at, status, type, action_url, metadata, document_id, change_request_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.case_id,
        data.scheduled_for,
        data.scheduled_by,
        data.message || null,
        data.title || null,
        scheduledAt,
        type,
        data.action_url || null,
        JSON.stringify(metadata),
        data.document_id || null,
        data.change_request_id || null,
      ]
    );

    const notification = await this.getNotificationById(result.rows[0].id);

    if (notification) {
      await this.emitNotification(data.scheduled_for, notification);
      await this.dispatchNotification(data.scheduled_for, notification);
    }

    return notification!;
  }

  /**
   * Dispatch notification to configured channels (email, push) based on user preferences.
   */
  private static async dispatchNotification(
    userId: string,
    notification: NotificationWithDetails
  ): Promise<void> {
    try {
      await this.ensureDefaultPreferences(userId);
      const preferences = await this.getUserPreferences(userId);
      const preference = preferences.find((p) => p.notification_type === notification.type);

      if (!preference || !preference.email) {
        return;
      }

      // Get user email
      const userResult = await query(
        `SELECT email, first_name, last_name FROM auth_schema.users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) return;
      const user = userResult.rows[0];

      if (preference.digest_mode === 'IMMEDIATE') {
        const actionUrl = notification.action_url || `${config.cors.origin}/crm/notifications`;
        await emailService.sendEmail({
          to: user.email,
          subject: notification.title || 'Sourcecorp Notification',
          html: `
            <p>Hello ${user.first_name},</p>
            <p>${notification.message || ''}</p>
            ${notification.case_number ? `<p>Case: ${notification.case_number}</p>` : ''}
            <p><a href="${actionUrl}">View notification</a></p>
          `,
          text: `${notification.message || ''}\nView: ${actionUrl}`,
        });
      } else {
        // Queue digest job (deduplicated by user + frequency)
        const jobId = `digest:${preference.digest_mode.toLowerCase()}:${userId}`;
        const existingJob = await notificationDigestQueue.getJob(jobId);
        if (!existingJob) {
          await notificationDigestQueue.add(
            'send_digest',
            { userId, frequency: preference.digest_mode },
            {
              jobId,
              delay: preference.digest_mode === 'DAILY' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
            }
          );
        }
      }
    } catch (error) {
      logger.error('Failed to dispatch notification', { userId, notificationId: notification.id, error });
    }
  }

  /**
   * Publish a notification to the user's real-time channel.
   */
  static async emitNotification(userId: string, notification: NotificationWithDetails): Promise<void> {
    try {
      await redisClient.publish(`notifications:${userId}`, JSON.stringify(notification));
    } catch (error) {
      logger.error('Failed to publish notification', { userId, notificationId: notification.id, error });
    }
  }

  /**
   * Get a single notification by ID with related details.
   */
  static async getNotificationById(notificationId: string): Promise<NotificationWithDetails | null> {
    const result = await query(
      `SELECT
        n.*,
        c.case_number,
        c.customer_name,
        c.current_status as case_status,
        scheduled_by_user.email as scheduled_by_email,
        scheduled_by_user.first_name as scheduled_by_first_name,
        scheduled_by_user.last_name as scheduled_by_last_name,
        scheduled_by_user.created_at as scheduled_by_user_created_at,
        scheduled_by_user.updated_at as scheduled_by_user_updated_at,
        d.id as document_id,
        d.file_name as document_file_name,
        d.mime_type as document_mime_type,
        d.file_size as document_file_size,
        cr.id as change_request_id,
        cr.status as change_request_status,
        cr.requested_changes as change_request_changes
       FROM crm_schema.case_notifications n
       LEFT JOIN crm_schema.cases c ON n.case_id = c.id
       LEFT JOIN auth_schema.users scheduled_by_user ON n.scheduled_by = scheduled_by_user.id
       LEFT JOIN crm_schema.documents d ON n.document_id = d.id
       LEFT JOIN crm_schema.customer_detail_change_requests cr ON n.change_request_id = cr.id
       WHERE n.id = $1`,
      [notificationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapNotificationRow(result.rows[0]);
  }

  /**
   * Get all notifications for a user with optional filters.
   */
  static async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<{ notifications: NotificationWithDetails[]; total: number }> {
    const {
      is_read,
      completion_status,
      type,
      due_date_from,
      due_date_to,
      limit = 50,
      offset = 0,
    } = filters;

    let whereClause = 'WHERE n.scheduled_for = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (is_read !== undefined) {
      whereClause += ` AND n.is_read = $${paramIndex}`;
      params.push(is_read);
      paramIndex++;
    }

    if (completion_status) {
      whereClause += ` AND n.completion_status = $${paramIndex}`;
      params.push(completion_status);
      paramIndex++;
    }

    if (type) {
      whereClause += ` AND n.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (due_date_from) {
      whereClause += ` AND n.scheduled_at >= $${paramIndex}`;
      params.push(due_date_from);
      paramIndex++;
    }

    if (due_date_to) {
      whereClause += ` AND n.scheduled_at <= $${paramIndex}`;
      params.push(due_date_to);
      paramIndex++;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT
        n.*,
        c.case_number,
        c.customer_name,
        c.current_status as case_status,
        scheduled_by_user.email as scheduled_by_email,
        scheduled_by_user.first_name as scheduled_by_first_name,
        scheduled_by_user.last_name as scheduled_by_last_name,
        scheduled_by_user.created_at as scheduled_by_user_created_at,
        scheduled_by_user.updated_at as scheduled_by_user_updated_at,
        d.id as document_id,
        d.file_name as document_file_name,
        d.mime_type as document_mime_type,
        d.file_size as document_file_size,
        cr.id as change_request_id,
        cr.status as change_request_status,
        cr.requested_changes as change_request_changes
       FROM crm_schema.case_notifications n
       LEFT JOIN crm_schema.cases c ON n.case_id = c.id
       LEFT JOIN auth_schema.users scheduled_by_user ON n.scheduled_by = scheduled_by_user.id
       LEFT JOIN crm_schema.documents d ON n.document_id = d.id
       LEFT JOIN crm_schema.customer_detail_change_requests cr ON n.change_request_id = cr.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM crm_schema.case_notifications n
       ${whereClause}`,
      params.slice(0, -2)
    );

    const notifications = result.rows.map(row => this.mapNotificationRow(row));

    return {
      notifications,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Get all notifications for a specific case.
   */
  static async getCaseNotifications(caseId: string): Promise<NotificationWithDetails[]> {
    const result = await query(
      `SELECT
        n.*,
        scheduled_for_user.email as scheduled_for_email,
        scheduled_for_user.first_name as scheduled_for_first_name,
        scheduled_for_user.last_name as scheduled_for_last_name,
        scheduled_by_user.email as scheduled_by_email,
        scheduled_by_user.first_name as scheduled_by_first_name,
        scheduled_by_user.last_name as scheduled_by_last_name,
        scheduled_by_user.created_at as scheduled_by_user_created_at,
        scheduled_by_user.updated_at as scheduled_by_user_updated_at,
        d.id as document_id,
        d.file_name as document_file_name,
        d.mime_type as document_mime_type,
        d.file_size as document_file_size,
        cr.id as change_request_id,
        cr.status as change_request_status,
        cr.requested_changes as change_request_changes
       FROM crm_schema.case_notifications n
       LEFT JOIN auth_schema.users scheduled_for_user ON n.scheduled_for = scheduled_for_user.id
       LEFT JOIN auth_schema.users scheduled_by_user ON n.scheduled_by = scheduled_by_user.id
       LEFT JOIN crm_schema.documents d ON n.document_id = d.id
       LEFT JOIN crm_schema.customer_detail_change_requests cr ON n.change_request_id = cr.id
       WHERE n.case_id = $1
       ORDER BY n.scheduled_at DESC`,
      [caseId]
    );

    return result.rows.map(row => this.mapNotificationRow(row));
  }

  /**
   * Get unread notification count for a user.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM crm_schema.case_notifications
       WHERE scheduled_for = $1 AND is_read = false`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mark a notification as read or unread.
   */
  static async markReadStatus(
    notificationId: string,
    userId: string,
    isRead: boolean
  ): Promise<NotificationWithDetails> {
    const checkResult = await query(
      `SELECT id FROM crm_schema.case_notifications
       WHERE id = $1 AND scheduled_for = $2`,
      [notificationId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    const result = await query(
      `UPDATE crm_schema.case_notifications
       SET is_read = $1,
           status = CASE WHEN $1 = true AND status = 'PENDING' THEN 'SENT' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [isRead, notificationId]
    );

    return (await this.getNotificationById(result.rows[0].id))!;
  }

  /**
   * Mark all notifications as read for a user.
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const result = await query(
      `UPDATE crm_schema.case_notifications
       SET is_read = true,
           status = CASE WHEN status = 'PENDING' THEN 'SENT' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE scheduled_for = $1 AND is_read = false`,
      [userId]
    );

    return result.rowCount || 0;
  }

  /**
   * Update notification completion status.
   */
  static async markCompletionStatus(
    notificationId: string,
    userId: string,
    completionStatus: 'ONGOING' | 'COMPLETED'
  ): Promise<NotificationWithDetails> {
    const checkResult = await query(
      `SELECT id FROM crm_schema.case_notifications
       WHERE id = $1 AND scheduled_for = $2`,
      [notificationId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    const result = await query(
      `UPDATE crm_schema.case_notifications
       SET completion_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [completionStatus, notificationId]
    );

    return (await this.getNotificationById(result.rows[0].id))!;
  }

  /**
   * Delete/archive a notification (soft delete not implemented; hard delete for now).
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const checkResult = await query(
      `SELECT id FROM crm_schema.case_notifications
       WHERE id = $1 AND scheduled_for = $2`,
      [notificationId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    await query(
      `DELETE FROM crm_schema.case_notifications WHERE id = $1`,
      [notificationId]
    );
  }

  // ============================================
  // PREFERENCES
  // ============================================

  static async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    const result = await query(
      `SELECT * FROM crm_schema.notification_preferences
       WHERE user_id = $1
       ORDER BY notification_type`,
      [userId]
    );

    return result.rows;
  }

  static async ensureDefaultPreferences(userId: string): Promise<NotificationPreference[]> {
    const existing = await this.getUserPreferences(userId);
    const existingTypes = new Set(existing.map(p => p.notification_type));

    for (const type of Object.values(NotificationType)) {
      if (!existingTypes.has(type)) {
        await query(
          `INSERT INTO crm_schema.notification_preferences
           (user_id, notification_type, in_app, email, push, digest_mode)
           VALUES ($1, $2, true, false, false, 'IMMEDIATE')`,
          [userId, type]
        );
      }
    }

    return this.getUserPreferences(userId);
  }

  static async updatePreference(
    userId: string,
    notificationType: NotificationType,
    data: Partial<Omit<NotificationPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<NotificationPreference> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.in_app !== undefined) {
      fields.push(`in_app = $${paramIndex++}`);
      values.push(data.in_app);
    }
    if (data.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }
    if (data.push !== undefined) {
      fields.push(`push = $${paramIndex++}`);
      values.push(data.push);
    }
    if (data.digest_mode !== undefined) {
      fields.push(`digest_mode = $${paramIndex++}`);
      values.push(data.digest_mode);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(userId, notificationType);

    const result = await query(
      `UPDATE crm_schema.notification_preferences
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $${paramIndex++} AND notification_type = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Preference not found');
    }

    return result.rows[0];
  }

  // ============================================
  // MAPPING
  // ============================================

  private static mapNotificationRow(row: any): NotificationWithDetails {
    return {
      id: row.id,
      case_id: row.case_id,
      scheduled_for: row.scheduled_for,
      scheduled_by: row.scheduled_by,
      message: row.message,
      title: row.title,
      scheduled_at: row.scheduled_at,
      status: row.status,
      is_read: row.is_read || false,
      completion_status: row.completion_status || 'ONGOING',
      type: row.type as NotificationType,
      action_url: row.action_url,
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      case_number: row.case_number,
      case_customer_name: row.customer_name,
      case_status: row.case_status,
      scheduled_by_user: row.scheduled_by_email
        ? {
            id: row.scheduled_by,
            email: row.scheduled_by_email,
            first_name: row.scheduled_by_first_name,
            last_name: row.scheduled_by_last_name,
            is_active: true,
            created_at: row.scheduled_by_user_created_at || row.created_at,
            updated_at: row.scheduled_by_user_updated_at || row.updated_at,
          } as User
        : undefined,
      document: row.document_id
        ? {
            id: row.document_id,
            case_id: row.case_id,
            file_name: row.document_file_name,
            file_path: '',
            mime_type: row.document_mime_type,
            file_size: row.document_file_size,
            uploaded_by: row.scheduled_by,
            uploaded_at: row.created_at,
          }
        : undefined,
      change_request_id: row.change_request_id,
      change_request_status: row.change_request_status,
      change_request_changes: row.change_request_changes,
    };
  }
}
