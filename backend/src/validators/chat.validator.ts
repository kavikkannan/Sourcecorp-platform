import { z } from 'zod';

export const createChannelSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).nullable().optional(),
    type: z.enum(['GLOBAL', 'ROLE', 'TEAM', 'GROUP', 'DM']),
    other_user_id: z.string().uuid().optional(),
    target_role_id: z.string().uuid().optional(),
    target_team_id: z.string().uuid().optional(),
    requested_members: z.array(z.string().uuid()).optional(),
  }),
});

export const createChannelRequestSchema = z.object({
  body: z.object({
    channel_name: z.string().min(1).max(255),
    channel_type: z.enum(['GLOBAL', 'ROLE', 'TEAM', 'GROUP']),
    target_role_id: z.string().uuid().optional(),
    target_team_id: z.string().uuid().optional(),
    requested_members: z.array(z.string().uuid()).optional(),
  }),
});

export const approveChannelRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    review_notes: z.string().optional(),
  }),
});

export const rejectChannelRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    review_notes: z.string().min(1),
  }),
});

export const startDMSchema = z.object({
  body: z.object({
    other_user_id: z.string().uuid(),
  }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    channel_id: z.string().uuid(),
    content: z.string().min(1),
    message_type: z.enum(['TEXT', 'FILE', 'IMAGE']).optional(),
  }),
});

