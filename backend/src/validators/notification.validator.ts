import { z } from 'zod';
import { NotificationType } from '../types';

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
  body: z.object({
    is_read: z.boolean(),
  }),
});

export const markNotificationCompletionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification ID'),
  }),
  body: z.object({
    completion_status: z.enum(['ONGOING', 'COMPLETED']),
  }),
});

export const getUserNotificationsSchema = z.object({
  query: z.object({
    is_read: z.string().optional(),
    completion_status: z.enum(['ONGOING', 'COMPLETED']).optional(),
    type: z.nativeEnum(NotificationType).optional(),
    due_date_from: z.string().optional(),
    due_date_to: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
  }),
});

export const updateNotificationPreferenceSchema = z.object({
  body: z.object({
    notification_type: z.nativeEnum(NotificationType),
    in_app: z.boolean().optional(),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    digest_mode: z.enum(['IMMEDIATE', 'DAILY', 'WEEKLY']).optional(),
  }),
});
