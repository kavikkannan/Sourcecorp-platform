import { Response } from 'express';
import { AuthRequest } from '../types';
import { ChatService } from '../services/chat.service';
import { query } from '../db/pool';
import fs from 'fs/promises';
import path from 'path';

// Get WebSocket service instance (will be set by index.ts)
let webSocketService: any = null;
export const setWebSocketService = (service: any) => {
  webSocketService = service;
};

export class ChatController {
  // ============================================
  // CHANNEL MANAGEMENT
  // ============================================

  static async createChannel(req: AuthRequest, res: Response) {
    try {
      const { name, type, other_user_id } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Type is required' });
      }

      if (!['GLOBAL', 'ROLE', 'TEAM', 'GROUP', 'DM'].includes(type)) {
        return res.status(400).json({ error: 'Invalid channel type' });
      }

      // For DM channels, other_user_id is required
      if (type === 'DM' && !other_user_id) {
        return res.status(400).json({ error: 'other_user_id is required for DM channels' });
      }

      // For DM channels, name should be null
      let channelName = name;
      if (type === 'DM') {
        channelName = null; // DM channels don't have names
      }

      const { target_role_id, target_team_id, requested_members } = req.body;

      const channel = await ChatService.createChannel(
        {
          name: channelName,
          type,
          created_by: req.user!.userId,
          other_user_id: type === 'DM' ? other_user_id : undefined,
          target_role_id,
          target_team_id,
          requested_members,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json(channel);
    } catch (error: any) {
      throw error;
    }
  }

  static async getUsersForDM(req: AuthRequest, res: Response) {
    try {
      const result = await query(
        `SELECT id, email, first_name, last_name, is_active
         FROM auth_schema.users
         WHERE id != $1 AND is_active = true
         ORDER BY first_name, last_name`,
        [req.user!.userId]
      );

      res.json(result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
      })));
    } catch (error: any) {
      throw error;
    }
  }

  static async getChannels(req: AuthRequest, res: Response) {
    try {
      const channels = await ChatService.getChannelsForUser(req.user!.userId);
      res.json(channels);
    } catch (error: any) {
      throw error;
    }
  }

  static async getChannel(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const channel = await ChatService.getChannelById(id, req.user!.userId);

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found or access denied' });
      }

      res.json(channel);
    } catch (error: any) {
      throw error;
    }
  }

  // ============================================
  // MESSAGE MANAGEMENT
  // ============================================

  static async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { channel_id, content, message_type } = req.body;

      if (!channel_id || !content) {
        return res.status(400).json({ error: 'Channel ID and content are required' });
      }

      const type = message_type || 'TEXT';
      if (!['TEXT', 'FILE', 'IMAGE'].includes(type)) {
        return res.status(400).json({ error: 'Invalid message type' });
      }

      const message = await ChatService.sendMessage(
        {
          channel_id,
          sender_id: req.user!.userId,
          message_type: type,
          content,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      // Broadcast message via WebSocket
      if (webSocketService) {
        // Get full message with sender info
        const messages = await ChatService.getMessages(channel_id, req.user!.userId, 1, 0);
        if (messages.length > 0) {
          await webSocketService.broadcastMessage(channel_id, messages[0]);
        }
      }

      res.status(201).json(message);
    } catch (error: any) {
      if (error.message === 'Access denied to channel') {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }

  static async getMessages(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await ChatService.getMessages(channelId, req.user!.userId, limit, offset);
      res.json(messages);
    } catch (error: any) {
      if (error.message === 'Access denied to channel') {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }

  // ============================================
  // FILE MANAGEMENT
  // ============================================

  static async uploadFile(req: AuthRequest, res: Response) {
    try {
      const { channel_id, content } = req.body;

      if (!channel_id) {
        return res.status(400).json({ error: 'Channel ID is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Verify user can access channel
      const canAccess = await ChatService.canUserAccessChannel(channel_id, req.user!.userId);
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to channel' });
      }

      // Ensure upload directory exists
      const uploadDir = path.join(process.cwd(), 'uploads', 'chat');
      await fs.mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${req.file.originalname}`;
      const filepath = path.join(uploadDir, filename);

      // Save file
      await fs.writeFile(filepath, req.file.buffer);

      // Determine message type based on mime type
      const isImage = req.file.mimetype.startsWith('image/');
      const messageType = isImage ? 'IMAGE' : 'FILE';

      // Create message first
      const message = await ChatService.sendMessage(
        {
          channel_id,
          sender_id: req.user!.userId,
          message_type: messageType,
          content: content || req.file.originalname,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      // Add attachment
      const attachment = await ChatService.addAttachment(
        {
          message_id: message.id,
          file_name: req.file.originalname,
          file_path: filepath,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          uploaded_by: req.user!.userId,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      // Broadcast message via WebSocket
      if (webSocketService) {
        // Get full message with sender info and attachment
        const messages = await ChatService.getMessages(channel_id, req.user!.userId, 1, 0);
        if (messages.length > 0) {
          await webSocketService.broadcastMessage(channel_id, messages[0]);
        }
      }

      res.status(201).json({
        message,
        attachment: {
          id: attachment.id,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          file_size: attachment.file_size,
          uploaded_at: attachment.uploaded_at,
        },
      });
    } catch (error: any) {
      throw error;
    }
  }

  static async uploadMultipleFiles(req: AuthRequest, res: Response) {
    try {
      const { channel_id, content } = req.body;

      if (!channel_id) {
        return res.status(400).json({ error: 'Channel ID is required' });
      }

      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Verify user can access channel
      const canAccess = await ChatService.canUserAccessChannel(channel_id, req.user!.userId);
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to channel' });
      }

      // Ensure upload directory exists
      const uploadDir = path.join(process.cwd(), 'uploads', 'chat');
      await fs.mkdir(uploadDir, { recursive: true });

      const files = Array.isArray(req.files) ? req.files : [req.files];
      const hasImages = files.some((f: any) => f.mimetype.startsWith('image/'));
      const messageType = hasImages ? 'IMAGE' : 'FILE';

      // Create single message for all files
      const message = await ChatService.sendMessage(
        {
          channel_id,
          sender_id: req.user!.userId,
          message_type: messageType,
          content: content || `${files.length} file${files.length > 1 ? 's' : ''}`,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      // Process all files
      const attachments = await Promise.all(
        files.map(async (file: any) => {
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const filename = `${timestamp}-${random}-${file.originalname}`;
          const filepath = path.join(uploadDir, filename);

          // Save file
          await fs.writeFile(filepath, file.buffer);

          return {
            file_name: file.originalname,
            file_path: filepath,
            mime_type: file.mimetype,
            file_size: file.size,
            uploaded_by: req.user!.userId,
          };
        })
      );

      // Add all attachments to the message
      const savedAttachments = await ChatService.addAttachments(
        message.id,
        attachments,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      // Broadcast message via WebSocket
      if (webSocketService) {
        // Get full message with sender info and attachments
        const messages = await ChatService.getMessages(channel_id, req.user!.userId, 1, 0);
        if (messages.length > 0) {
          await webSocketService.broadcastMessage(channel_id, messages[0]);
        }
      }

      res.status(201).json({
        message,
        attachments: savedAttachments.map((att) => ({
          id: att.id,
          file_name: att.file_name,
          mime_type: att.mime_type,
          file_size: att.file_size,
          uploaded_at: att.uploaded_at,
        })),
      });
    } catch (error: any) {
      throw error;
    }
  }

  static async downloadFile(req: AuthRequest, res: Response) {
    try {
      const { fileId } = req.params;

      const attachment = await ChatService.getAttachment(fileId, req.user!.userId);

      if (!attachment) {
        return res.status(404).json({ error: 'File not found or access denied' });
      }

      // Check if file exists and read it
      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.readFile(attachment.file_path);
      } catch {
        return res.status(404).json({ error: 'File not found on disk' });
      }

      // Audit log for download
      const { AuditService } = await import('../services/audit.service');
      await AuditService.createLog({
        userId: req.user!.userId,
        action: 'chat.file.download',
        resourceType: 'attachment',
        resourceId: attachment.id,
        details: { file_name: attachment.file_name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Send file
      res.setHeader('Content-Type', attachment.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
      res.send(fileBuffer);
    } catch (error: any) {
      throw error;
    }
  }

  // ============================================
  // CHANNEL CREATION REQUESTS
  // ============================================

  static async createChannelRequest(req: AuthRequest, res: Response) {
    try {
      const { channel_name, channel_type, target_role_id, target_team_id, requested_members } = req.body;

      if (!channel_name || !channel_type) {
        return res.status(400).json({ error: 'channel_name and channel_type are required' });
      }

      if (!['GLOBAL', 'ROLE', 'TEAM', 'GROUP'].includes(channel_type)) {
        return res.status(400).json({ error: 'Invalid channel type for requests' });
      }

      const request = await ChatService.createChannelRequest(
        {
          requested_by: req.user!.userId,
          channel_name,
          channel_type,
          target_role_id,
          target_team_id,
          requested_members,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json(request);
    } catch (error: any) {
      if (error.message.includes('permission') || error.message.includes('required')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }

  static async approveChannelRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { review_notes } = req.body;

      const channel = await ChatService.approveChannelRequest(
        id,
        req.user!.userId,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
        review_notes
      );

      res.json({ channel, message: 'Channel request approved and channel created' });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('already')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Insufficient hierarchy')) {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }

  static async rejectChannelRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { review_notes } = req.body;

      if (!review_notes || review_notes.trim().length === 0) {
        return res.status(400).json({ error: 'review_notes are required when rejecting a request' });
      }

      await ChatService.rejectChannelRequest(
        id,
        req.user!.userId,
        review_notes,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.json({ message: 'Channel request rejected' });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('already')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Insufficient hierarchy')) {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }

  static async getChannelRequests(req: AuthRequest, res: Response) {
    try {
      const userId = req.query.user_id as string | undefined;
      const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;

      // If no userId specified, default to current user's requests
      // Managers/admins can see all requests by not specifying userId
      const requests = await ChatService.getChannelRequests(
        userId || (req.query.all !== 'true' ? req.user!.userId : undefined),
        status
      );

      res.json(requests);
    } catch (error: any) {
      throw error;
    }
  }

  static async startDM(req: AuthRequest, res: Response) {
    try {
      const { other_user_id } = req.body;

      if (!other_user_id) {
        return res.status(400).json({ error: 'other_user_id is required' });
      }

      if (other_user_id === req.user!.userId) {
        return res.status(400).json({ error: 'Cannot start DM with yourself' });
      }

      // Verify other user exists
      const userResult = await query(
        'SELECT id FROM auth_schema.users WHERE id = $1 AND is_active = true',
        [other_user_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found or inactive' });
      }

      const channel = await ChatService.createChannel(
        {
          name: null,
          type: 'DM',
          created_by: req.user!.userId,
          other_user_id,
        },
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json(channel);
    } catch (error: any) {
      throw error;
    }
  }
}

