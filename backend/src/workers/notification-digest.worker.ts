import { Worker } from 'bullmq';
import { config } from '../config/env';
import { query } from '../db/pool';
import { emailService } from '../services/email.service';
import { logger } from '../config/logger';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

const buildDigestHtml = (notifications: any[]) => {
  const items = notifications
    .map(
      (n) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${n.type || 'Notification'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${n.title || ''}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${n.message || ''}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(n.created_at).toLocaleString()}</td>
    </tr>
  `
    )
    .join('');

  return `
    <h2>Your Sourcecorp Notification Digest</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; text-align: left;">Type</th>
          <th style="padding: 8px; text-align: left;">Title</th>
          <th style="padding: 8px; text-align: left;">Message</th>
          <th style="padding: 8px; text-align: left;">Time</th>
        </tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>
    <p style="margin-top: 16px;">
      <a href="${config.cors.origin}/crm/notifications">View all notifications</a>
    </p>
  `;
};

export const notificationDigestWorker = new Worker(
  'notification_digest_queue',
  async (job) => {
    const { userId, frequency } = job.data;

    try {
      // Get user email
      const userResult = await query(
        `SELECT email, first_name, last_name FROM auth_schema.users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        logger.warn(`Digest worker: user ${userId} not found`);
        return;
      }

      const user = userResult.rows[0];

      // Determine time window
      const now = new Date();
      const fromDate = frequency === 'DAILY'
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get unread notifications in window
      const notificationsResult = await query(
        `SELECT * FROM crm_schema.case_notifications
         WHERE scheduled_for = $1 AND is_read = false AND created_at >= $2
         ORDER BY created_at DESC`,
        [userId, fromDate]
      );

      if (notificationsResult.rows.length === 0) {
        logger.info(`No notifications for ${frequency} digest of user ${userId}`);
        return;
      }

      await emailService.sendEmail({
        to: user.email,
        subject: `Your ${frequency.toLowerCase()} notification digest`,
        html: buildDigestHtml(notificationsResult.rows),
        text: `You have ${notificationsResult.rows.length} unread notifications. View them at ${config.cors.origin}/crm/notifications`,
      });

      logger.info(`Sent ${frequency} digest to ${user.email}`);
    } catch (error) {
      logger.error('Failed to process notification digest', error);
      throw error;
    }
  },
  { connection }
);

notificationDigestWorker.on('failed', (job, err) => {
  logger.error(`Notification digest job ${job?.id} failed`, err);
});

logger.info('Notification digest worker started');
