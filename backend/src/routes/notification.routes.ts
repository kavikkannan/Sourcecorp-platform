import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { NotificationController } from '../controllers/notification.controller';
import * as validators from '../validators/notification.validator';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

// List & count
router.get(
  '/',
  requirePermission('crm.case.view'),
  validate(validators.getUserNotificationsSchema),
  NotificationController.getNotifications
);

router.get(
  '/unread-count',
  requirePermission('crm.case.view'),
  NotificationController.getUnreadCount
);

// Mark read/unread
router.patch(
  '/:id/read',
  requirePermission('crm.case.view'),
  validate(validators.markNotificationReadSchema),
  NotificationController.markRead
);

router.patch(
  '/:id/unread',
  requirePermission('crm.case.view'),
  validate(validators.notificationIdSchema),
  NotificationController.markUnread
);

router.post(
  '/mark-all-read',
  requirePermission('crm.case.view'),
  NotificationController.markAllAsRead
);

// Mark completion status
router.patch(
  '/:id/completion',
  requirePermission('crm.case.view'),
  validate(validators.markNotificationCompletionSchema),
  NotificationController.markCompletion
);

// Delete notification
router.delete(
  '/:id',
  requirePermission('crm.case.view'),
  validate(validators.notificationIdSchema),
  NotificationController.deleteNotification
);

// Real-time SSE stream
router.get(
  '/stream',
  requirePermission('crm.case.view'),
  NotificationController.stream
);

// Preferences
router.get(
  '/preferences',
  requirePermission('crm.case.view'),
  NotificationController.getPreferences
);

router.put(
  '/preferences',
  requirePermission('crm.case.view'),
  validate(validators.updateNotificationPreferenceSchema),
  NotificationController.updatePreference
);

export default router;
