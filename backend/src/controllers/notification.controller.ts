import { Response } from 'express';
import { AuthRequest } from '../types';
import { NotificationService } from '../services/notification.service';
import { redisClient } from '../db/redis';
import { logger } from '../config/logger';

// Keep track of active SSE subscribers per user
const userSubscribers = new Map<string, Set<Response>>();

export class NotificationController {
  // ============================================
  // LIST & COUNT
  // ============================================

  static async getNotifications(req: AuthRequest, res: Response) {
    try {
      const { is_read, completion_status, type, due_date_from, due_date_to, limit = '50', offset = '0' } = req.query;

      const result = await NotificationService.getUserNotifications(req.user!.userId, {
        is_read: is_read === 'true' ? true : is_read === 'false' ? false : undefined,
        completion_status: completion_status as 'ONGOING' | 'COMPLETED' | undefined,
        type: type as any,
        due_date_from: due_date_from as string | undefined,
        due_date_to: due_date_to as string | undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  static async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const count = await NotificationService.getUnreadCount(req.user!.userId);
      res.json({ count });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // READ STATUS
  // ============================================

  static async markRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.markReadStatus(id, req.user!.userId, true);
      res.json({ id: notification.id, is_read: notification.is_read });
    } catch (error: any) {
      if (error.message?.includes('Notification not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  static async markUnread(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.markReadStatus(id, req.user!.userId, false);
      res.json({ id: notification.id, is_read: notification.is_read });
    } catch (error: any) {
      if (error.message?.includes('Notification not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  static async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const updated = await NotificationService.markAllAsRead(req.user!.userId);
      res.json({ updated });
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // COMPLETION STATUS
  // ============================================

  static async markCompletion(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { completion_status } = req.body;

      const notification = await NotificationService.markCompletionStatus(
        id,
        req.user!.userId,
        completion_status
      );

      res.json({ id: notification.id, completion_status: notification.completion_status });
    } catch (error: any) {
      if (error.message?.includes('Notification not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  // ============================================
  // DELETE
  // ============================================

  static async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await NotificationService.deleteNotification(id, req.user!.userId);
      res.json({ message: 'Notification deleted' });
    } catch (error: any) {
      if (error.message?.includes('Notification not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  // ============================================
  // SSE STREAM
  // ============================================

  static async stream(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable NGINX buffering for SSE
      res.status(200);

      // Send initial connection ack
      res.write('event: connected\n');
      res.write(`data: ${JSON.stringify({ userId })}\n\n`);

      // Subscribe to Redis channel for this user
      const channel = `notifications:${userId}`;
      const redisSubscriber = redisClient.duplicate();
      await redisSubscriber.subscribe(channel);

      const sendNotification = (message: string) => {
        try {
          res.write('event: notification\n');
          res.write(`data: ${message}\n\n`);
        } catch (error) {
          logger.error('Failed to write SSE message', error);
        }
      };

      redisSubscriber.on('message', (chan, message) => {
        if (chan === channel) {
          sendNotification(message);
        }
      });

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          res.write('event: heartbeat\n');
          res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
        } catch (error) {
          logger.error('Failed to write SSE heartbeat', error);
        }
      }, 30000);

      // Track subscriber for potential broadcast usage
      if (!userSubscribers.has(userId)) {
        userSubscribers.set(userId, new Set());
      }
      userSubscribers.get(userId)!.add(res);

      req.on('close', () => {
        clearInterval(heartbeatInterval);
        redisSubscriber.unsubscribe(channel).catch(() => {});
        redisSubscriber.quit().catch(() => {});
        userSubscribers.get(userId)?.delete(res);
        if (userSubscribers.get(userId)?.size === 0) {
          userSubscribers.delete(userId);
        }
      });

      req.on('error', () => {
        clearInterval(heartbeatInterval);
        redisSubscriber.unsubscribe(channel).catch(() => {});
        redisSubscriber.quit().catch(() => {});
        userSubscribers.get(userId)?.delete(res);
      });
    } catch (error) {
      logger.error('SSE stream error', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to establish notification stream' });
      }
    }
  }

  // ============================================
  // PREFERENCES
  // ============================================

  static async getPreferences(req: AuthRequest, res: Response) {
    try {
      await NotificationService.ensureDefaultPreferences(req.user!.userId);
      const preferences = await NotificationService.getUserPreferences(req.user!.userId);
      res.json({ preferences });
    } catch (error) {
      throw error;
    }
  }

  static async updatePreference(req: AuthRequest, res: Response) {
    try {
      const { notification_type, in_app, email, push, digest_mode } = req.body;

      const preference = await NotificationService.updatePreference(req.user!.userId, notification_type, {
        in_app,
        email,
        push,
        digest_mode,
      });

      res.json({ preference });
    } catch (error: any) {
      if (error.message?.includes('No fields to update')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message?.includes('Preference not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }
}
