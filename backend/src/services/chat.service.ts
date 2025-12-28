import { query } from '../db/pool';
import { AuditService } from './audit.service';
import { HierarchyService } from './hierarchy.service';
import { logger } from '../config/logger';
import { Channel, Message, Attachment, ChannelCreationRequest } from '../types';

export class ChatService {
  // ============================================
  // HIERARCHY VALIDATION HELPERS
  // ============================================

  /**
   * Check if user has admin role
   */
  static async isAdmin(userId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM auth_schema.user_roles ur
       JOIN auth_schema.roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1 AND r.name IN ('admin', 'super_admin')`,
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if user is at top of hierarchy (has no manager)
   */
  static async isTopHierarchy(userId: string): Promise<boolean> {
    const manager = await HierarchyService.getManager(userId);
    return manager === null;
  }

  /**
   * Check if user is a manager (has subordinates)
   */
  static async isManager(userId: string): Promise<boolean> {
    const subordinates = await HierarchyService.getSubordinates(userId);
    return subordinates.length > 0;
  }

  /**
   * Check if user can create channel type based on hierarchy
   */
  static async canCreateChannelType(
    userId: string,
    channelType: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP'
  ): Promise<boolean> {
    const isAdminUser = await this.isAdmin(userId);
    const isTopLevel = await this.isTopHierarchy(userId);
    const isManagerUser = await this.isManager(userId);

    switch (channelType) {
      case 'GLOBAL':
        return isAdminUser || isTopLevel;
      case 'ROLE':
        return isAdminUser || isTopLevel;
      case 'TEAM':
        return isAdminUser || isManagerUser;
      case 'GROUP':
        // GROUP channels require approval, so lower hierarchy can request
        return true; // But will need approval
      default:
        return false;
    }
  }

  // ============================================
  // CHANNEL MANAGEMENT
  // ============================================

  static async createChannel(
    data: {
      name: string | null;
      type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP' | 'DM';
      created_by: string;
      other_user_id?: string; // For DM channels
      status?: 'ACTIVE' | 'PENDING';
      requested_members?: string[]; // For GROUP channels
      target_role_id?: string; // For ROLE channels
      target_team_id?: string; // For TEAM channels
    },
    auditData: { ipAddress?: string; userAgent?: string }
  ): Promise<Channel> {
    // Validate hierarchy for non-DM channels
    if (data.type !== 'DM') {
      const canCreate = await this.canCreateChannelType(data.created_by, data.type);
      if (!canCreate) {
        // GROUP channels can be created by admins/managers when approving requests
        // But regular users must use the request flow
        if (data.type === 'GROUP' && data.status === 'ACTIVE') {
          // This is an approval flow, allow it
        } else {
          throw new Error(`Insufficient hierarchy level to create ${data.type} channels. Use the request endpoint instead.`);
        }
      }
    }

    // For DM channels, check if one already exists between these two users
    if (data.type === 'DM' && data.other_user_id) {
      const existingDM = await query(
        `SELECT c.* FROM chat_schema.channels c
         JOIN chat_schema.channel_members cm1 ON c.id = cm1.channel_id
         JOIN chat_schema.channel_members cm2 ON c.id = cm2.channel_id
         WHERE c.type = 'DM'
         AND ((cm1.user_id = $1 AND cm2.user_id = $2) OR (cm1.user_id = $2 AND cm2.user_id = $1))
         LIMIT 1`,
        [data.created_by, data.other_user_id]
      );

      if (existingDM.rows.length > 0) {
        return existingDM.rows[0];
      }

      // Create DM channel with both users as members (no name for DM)
      const result = await query(
        `INSERT INTO chat_schema.channels (name, type, created_by, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         RETURNING *`,
        [null, 'DM', data.created_by]
      );

      const channel = result.rows[0];

      // Add both users as members
      await query(
        `INSERT INTO chat_schema.channel_members (channel_id, user_id)
         VALUES ($1, $2), ($1, $3)
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channel.id, data.created_by, data.other_user_id]
      );

      await AuditService.createLog({
        userId: data.created_by,
        action: 'chat.channel.create',
        resourceType: 'channel',
        resourceId: channel.id,
        details: { name: data.name, type: data.type, other_user_id: data.other_user_id },
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
      });

      return channel;
    }

    const status = data.status || 'ACTIVE';
    const result = await query(
      `INSERT INTO chat_schema.channels (name, type, created_by, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.type, data.created_by, status]
    );

    const channel = result.rows[0];

    // For GLOBAL channels, add all active users as members
    if (data.type === 'GLOBAL') {
      await query(
        `INSERT INTO chat_schema.channel_members (channel_id, user_id)
         SELECT $1, id
         FROM auth_schema.users
         WHERE is_active = true
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channel.id]
      );
    }

    // For ROLE channels, add users with the matching role
    if (data.type === 'ROLE' && data.target_role_id) {
      await query(
        `INSERT INTO chat_schema.channel_members (channel_id, user_id)
         SELECT $1, ur.user_id
         FROM auth_schema.user_roles ur
         WHERE ur.role_id = $2
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channel.id, data.target_role_id]
      );
    }

    // For TEAM channels, add users in the matching team
    if (data.type === 'TEAM' && data.target_team_id) {
      await query(
        `INSERT INTO chat_schema.channel_members (channel_id, user_id)
         SELECT $1, tm.user_id
         FROM auth_schema.team_members tm
         WHERE tm.team_id = $2
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channel.id, data.target_team_id]
      );
    }

    // For GROUP channels, add explicitly requested members
    if (data.type === 'GROUP' && data.requested_members && data.requested_members.length > 0) {
      const values = data.requested_members.map((userId, index) => 
        `($1, $${index + 2})`
      ).join(', ');
      await query(
        `INSERT INTO chat_schema.channel_members (channel_id, user_id)
         VALUES ${values}
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channel.id, ...data.requested_members]
      );
    }

    // Audit log
    await AuditService.createLog({
      userId: data.created_by,
      action: 'chat.channel.create',
      resourceType: 'channel',
      resourceId: channel.id,
      details: { name: data.name, type: data.type },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return channel;
  }

  static async getChannelsForUser(userId: string): Promise<Channel[]> {
    // Get all channels user can access:
    // 1. GLOBAL channels (all users)
    // 2. ROLE channels (user has the role)
    // 3. TEAM channels (user is team member)
    // 4. DM channels (user is a member)
    // 5. Channels where user is explicitly a member

    const result = await query(
      `SELECT c.*, 
              COUNT(DISTINCT cm.user_id) as member_count,
              CASE c.type 
                WHEN 'DM' THEN 1
                WHEN 'GLOBAL' THEN 2
                WHEN 'ROLE' THEN 3
                WHEN 'TEAM' THEN 4
                WHEN 'GROUP' THEN 5
              END as type_order,
              c.created_at
       FROM chat_schema.channels c
       LEFT JOIN chat_schema.channel_members cm ON c.id = cm.channel_id
       WHERE (
         -- Only show ACTIVE channels
         c.status = 'ACTIVE'
         AND (
           -- GLOBAL channels
           c.type = 'GLOBAL'
           OR
           -- ROLE channels: user has the role matching channel name
           (c.type = 'ROLE' AND EXISTS (
             SELECT 1 FROM auth_schema.user_roles ur
             JOIN auth_schema.roles r ON ur.role_id = r.id
             WHERE ur.user_id = $1 AND r.name = c.name
           ))
           OR
           -- TEAM channels: user is member of team matching channel name
           (c.type = 'TEAM' AND EXISTS (
             SELECT 1 FROM auth_schema.team_members tm
             JOIN auth_schema.teams t ON tm.team_id = t.id
             WHERE tm.user_id = $1 AND t.name = c.name
           ))
           OR
           -- GROUP channels: user is explicitly a member
           (c.type = 'GROUP' AND EXISTS (
             SELECT 1 FROM chat_schema.channel_members cm4
             WHERE cm4.channel_id = c.id AND cm4.user_id = $1
           ))
           OR
           -- DM channels: user is a member
           (c.type = 'DM' AND EXISTS (
             SELECT 1 FROM chat_schema.channel_members cm3
             WHERE cm3.channel_id = c.id AND cm3.user_id = $1
           ))
           OR
           -- Explicitly added as member (fallback)
           EXISTS (
             SELECT 1 FROM chat_schema.channel_members cm2
             WHERE cm2.channel_id = c.id AND cm2.user_id = $1
           )
         )
       )
       GROUP BY c.id, c.created_at
       ORDER BY type_order, c.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      ...row,
      member_count: parseInt(row.member_count, 10),
    }));
  }

  static async getChannelById(channelId: string, userId: string): Promise<Channel | null> {
    // First check if user has access
    const accessCheck = await query(
      `SELECT c.*
       FROM chat_schema.channels c
       WHERE c.id = $1 AND c.status = 'ACTIVE' AND (
         c.type = 'GLOBAL'
         OR (c.type = 'ROLE' AND EXISTS (
           SELECT 1 FROM auth_schema.user_roles ur
           JOIN auth_schema.roles r ON ur.role_id = r.id
           WHERE ur.user_id = $2 AND r.name = c.name
         ))
         OR (c.type = 'TEAM' AND EXISTS (
           SELECT 1 FROM auth_schema.team_members tm
           JOIN auth_schema.teams t ON tm.team_id = t.id
           WHERE tm.user_id = $2 AND t.name = c.name
         ))
         OR (c.type = 'GROUP' AND EXISTS (
           SELECT 1 FROM chat_schema.channel_members cm
           WHERE cm.channel_id = c.id AND cm.user_id = $2
         ))
         OR (c.type = 'DM' AND EXISTS (
           SELECT 1 FROM chat_schema.channel_members cm
           WHERE cm.channel_id = c.id AND cm.user_id = $2
         ))
         OR EXISTS (
           SELECT 1 FROM chat_schema.channel_members cm
           WHERE cm.channel_id = c.id AND cm.user_id = $2
         )
       )`,
      [channelId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return null;
    }

    const channel = accessCheck.rows[0];

    // Get member count
    const memberCountResult = await query(
      `SELECT COUNT(*) as count FROM chat_schema.channel_members WHERE channel_id = $1`,
      [channelId]
    );

    return {
      ...channel,
      member_count: parseInt(memberCountResult.rows[0].count, 10),
    };
  }

  static async canUserAccessChannel(channelId: string, userId: string): Promise<boolean> {
    const channel = await this.getChannelById(channelId, userId);
    return channel !== null;
  }

  // ============================================
  // MESSAGE MANAGEMENT
  // ============================================

  static async sendMessage(
    data: {
      channel_id: string;
      sender_id: string;
      message_type: 'TEXT' | 'FILE' | 'IMAGE';
      content: string;
    },
    auditData: { ipAddress?: string; userAgent?: string }
  ): Promise<Message> {
    // Verify user can access channel
    const canAccess = await this.canUserAccessChannel(data.channel_id, data.sender_id);
    if (!canAccess) {
      throw new Error('Access denied to channel');
    }

    const result = await query(
      `INSERT INTO chat_schema.messages (channel_id, sender_id, message_type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.channel_id, data.sender_id, data.message_type, data.content]
    );

    const message = result.rows[0];

    // Audit log
    await AuditService.createLog({
      userId: data.sender_id,
      action: 'chat.message.send',
      resourceType: 'message',
      resourceId: message.id,
      details: { channel_id: data.channel_id, message_type: data.message_type },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return message;
  }

  static async getMessages(
    channelId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    // Verify user can access channel
    const canAccess = await this.canUserAccessChannel(channelId, userId);
    if (!canAccess) {
      throw new Error('Access denied to channel');
    }

    const result = await query(
      `SELECT m.*, 
              u.id as sender_id, u.email as sender_email, 
              u.first_name as sender_first_name, u.last_name as sender_last_name
       FROM chat_schema.messages m
       JOIN auth_schema.users u ON m.sender_id = u.id
       WHERE m.channel_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [channelId, limit, offset]
    );

    // Get attachments for each message
    const messages = await Promise.all(
      result.rows.map(async (row) => {
        const attachmentsResult = await query(
          `SELECT a.*, 
                  u.id as uploader_id, u.email as uploader_email,
                  u.first_name as uploader_first_name, u.last_name as uploader_last_name
           FROM chat_schema.attachments a
           JOIN auth_schema.users u ON a.uploaded_by = u.id
           WHERE a.message_id = $1`,
          [row.id]
        );

        return {
          id: row.id,
          channel_id: row.channel_id,
          sender_id: row.sender_id,
          message_type: row.message_type,
          content: row.content,
          created_at: row.created_at,
          sender: {
            id: row.sender_id,
            email: row.sender_email,
            first_name: row.sender_first_name,
            last_name: row.sender_last_name,
          },
          attachments: attachmentsResult.rows.map((att) => ({
            id: att.id,
            message_id: att.message_id,
            file_name: att.file_name,
            file_path: att.file_path,
            mime_type: att.mime_type,
            file_size: att.file_size,
            uploaded_by: att.uploaded_by,
            uploaded_at: att.uploaded_at,
            uploader: {
              id: att.uploader_id,
              email: att.uploader_email,
              first_name: att.uploader_first_name,
              last_name: att.uploader_last_name,
            },
          })),
        };
      })
    );

    return messages;
  }

  // ============================================
  // ATTACHMENT MANAGEMENT
  // ============================================

  static async addAttachments(
    messageId: string,
    attachments: Array<{
      file_name: string;
      file_path: string;
      mime_type: string;
      file_size: number;
      uploaded_by: string;
    }>,
    auditData: { ipAddress?: string; userAgent?: string }
  ): Promise<Attachment[]> {
    const results = await Promise.all(
      attachments.map(async (att) => {
        const result = await query(
          `INSERT INTO chat_schema.attachments 
           (message_id, file_name, file_path, mime_type, file_size, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            messageId,
            att.file_name,
            att.file_path,
            att.mime_type,
            att.file_size,
            att.uploaded_by,
          ]
        );

        const attachment = result.rows[0];

        // Audit log for each attachment
        await AuditService.createLog({
          userId: att.uploaded_by,
          action: 'chat.file.upload',
          resourceType: 'attachment',
          resourceId: attachment.id,
          details: {
            message_id: messageId,
            file_name: att.file_name,
            file_size: att.file_size,
          },
          ipAddress: auditData.ipAddress,
          userAgent: auditData.userAgent,
        });

        return attachment;
      })
    );

    return results;
  }

  static async addAttachment(
    data: {
      message_id: string;
      file_name: string;
      file_path: string;
      mime_type: string;
      file_size: number;
      uploaded_by: string;
    },
    auditData: { ipAddress?: string; userAgent?: string }
  ): Promise<Attachment> {
    // Verify message exists and user is sender
    const messageResult = await query(
      `SELECT channel_id, sender_id FROM chat_schema.messages WHERE id = $1`,
      [data.message_id]
    );

    if (messageResult.rows.length === 0) {
      throw new Error('Message not found');
    }

    const message = messageResult.rows[0];
    if (message.sender_id !== data.uploaded_by) {
      throw new Error('Only message sender can add attachments');
    }

    const result = await query(
      `INSERT INTO chat_schema.attachments 
       (message_id, file_name, file_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.message_id,
        data.file_name,
        data.file_path,
        data.mime_type,
        data.file_size,
        data.uploaded_by,
      ]
    );

    const attachment = result.rows[0];

    // Audit log
    await AuditService.createLog({
      userId: data.uploaded_by,
      action: 'chat.file.upload',
      resourceType: 'attachment',
      resourceId: attachment.id,
      details: {
        message_id: data.message_id,
        file_name: data.file_name,
        file_size: data.file_size,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return attachment;
  }

  static async getAttachment(attachmentId: string, userId: string): Promise<Attachment | null> {
    // Verify user can access the message's channel
    const result = await query(
      `SELECT a.*, m.channel_id
       FROM chat_schema.attachments a
       JOIN chat_schema.messages m ON a.message_id = m.id
       WHERE a.id = $1`,
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const attachment = result.rows[0];
    const canAccess = await this.canUserAccessChannel(attachment.channel_id, userId);

    if (!canAccess) {
      return null;
    }

    // Get uploader info
    const uploaderResult = await query(
      `SELECT id, email, first_name, last_name FROM auth_schema.users WHERE id = $1`,
      [attachment.uploaded_by]
    );

    return {
      ...attachment,
      uploader: uploaderResult.rows[0],
    };
  }

  // ============================================
  // CHANNEL CREATION REQUESTS
  // ============================================

  static async createChannelRequest(
    data: {
      requested_by: string;
      channel_name: string;
      channel_type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP';
      target_role_id?: string;
      target_team_id?: string;
      requested_members?: string[];
    },
    auditData: { ipAddress?: string; userAgent?: string }
  ): Promise<ChannelCreationRequest> {
    // Validate that user can request this type
    if (data.channel_type !== 'GROUP') {
      const canCreate = await this.canCreateChannelType(data.requested_by, data.channel_type);
      if (canCreate) {
        throw new Error(`You have permission to create ${data.channel_type} channels directly. Use the create channel endpoint instead.`);
      }
    }

    // Validate required fields based on type
    if (data.channel_type === 'ROLE' && !data.target_role_id) {
      throw new Error('target_role_id is required for ROLE channels');
    }
    if (data.channel_type === 'TEAM' && !data.target_team_id) {
      throw new Error('target_team_id is required for TEAM channels');
    }
    if (data.channel_type === 'GROUP' && (!data.requested_members || data.requested_members.length === 0)) {
      throw new Error('At least one member is required for GROUP channels');
    }

    const result = await query(
      `INSERT INTO chat_schema.channel_creation_requests 
       (requested_by, channel_name, channel_type, target_role_id, target_team_id, requested_members, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING *`,
      [
        data.requested_by,
        data.channel_name,
        data.channel_type,
        data.target_role_id || null,
        data.target_team_id || null,
        JSON.stringify(data.requested_members || []),
      ]
    );

    const request = result.rows[0];

    await AuditService.createLog({
      userId: data.requested_by,
      action: 'chat.channel.request',
      resourceType: 'channel_request',
      resourceId: request.id,
      details: {
        channel_name: data.channel_name,
        channel_type: data.channel_type,
        target_role_id: data.target_role_id,
        target_team_id: data.target_team_id,
        requested_members: data.requested_members,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return {
      ...request,
      requested_members: JSON.parse(request.requested_members || '[]'),
    };
  }

  static async approveChannelRequest(
    requestId: string,
    reviewerId: string,
    auditData: { ipAddress?: string; userAgent?: string },
    reviewNotes?: string
  ): Promise<Channel> {
    // Get the request
    const requestResult = await query(
      `SELECT * FROM chat_schema.channel_creation_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Channel creation request not found');
    }

    const request = requestResult.rows[0];

    if (request.status !== 'PENDING') {
      throw new Error(`Request is already ${request.status}`);
    }

    // Validate reviewer has permission to approve
    const canCreate = await this.canCreateChannelType(reviewerId, request.channel_type);
    if (!canCreate) {
      throw new Error(`Insufficient hierarchy level to approve ${request.channel_type} channel creation`);
    }

    // Create the channel
    const channel = await this.createChannel(
      {
        name: request.channel_name,
        type: request.channel_type,
        created_by: request.requested_by,
        status: 'ACTIVE',
        requested_members: JSON.parse(request.requested_members || '[]'),
        target_role_id: request.target_role_id,
        target_team_id: request.target_team_id,
      },
      auditData
    );

    // Update request status
    await query(
      `UPDATE chat_schema.channel_creation_requests
       SET status = 'APPROVED', reviewed_by = $1, review_notes = $2, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [reviewerId, reviewNotes || null, requestId]
    );

    await AuditService.createLog({
      userId: reviewerId,
      action: 'chat.channel.approve',
      resourceType: 'channel_request',
      resourceId: requestId,
      details: {
        channel_id: channel.id,
        channel_name: request.channel_name,
        channel_type: request.channel_type,
        review_notes: reviewNotes,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return channel;
  }

  static async rejectChannelRequest(
    requestId: string,
    reviewerId: string,
    reviewNotes: string,
    auditData: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    // Get the request
    const requestResult = await query(
      `SELECT * FROM chat_schema.channel_creation_requests WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Channel creation request not found');
    }

    const request = requestResult.rows[0];

    if (request.status !== 'PENDING') {
      throw new Error(`Request is already ${request.status}`);
    }

    // Validate reviewer has permission to reject
    const canCreate = await this.canCreateChannelType(reviewerId, request.channel_type);
    if (!canCreate) {
      throw new Error(`Insufficient hierarchy level to reject ${request.channel_type} channel creation`);
    }

    if (!reviewNotes || reviewNotes.trim().length === 0) {
      throw new Error('Review notes are required when rejecting a request');
    }

    // Update request status
    await query(
      `UPDATE chat_schema.channel_creation_requests
       SET status = 'REJECTED', reviewed_by = $1, review_notes = $2, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [reviewerId, reviewNotes, requestId]
    );

    await AuditService.createLog({
      userId: reviewerId,
      action: 'chat.channel.reject',
      resourceType: 'channel_request',
      resourceId: requestId,
      details: {
        channel_name: request.channel_name,
        channel_type: request.channel_type,
        review_notes: reviewNotes,
      },
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });
  }

  static async getChannelRequests(
    userId?: string,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  ): Promise<ChannelCreationRequest[]> {
    let queryStr = `
      SELECT ccr.*,
             u1.email as requester_email, u1.first_name as requester_first_name, u1.last_name as requester_last_name,
             u2.email as reviewer_email, u2.first_name as reviewer_first_name, u2.last_name as reviewer_last_name,
             r.name as target_role_name,
             t.name as target_team_name
      FROM chat_schema.channel_creation_requests ccr
      LEFT JOIN auth_schema.users u1 ON ccr.requested_by = u1.id
      LEFT JOIN auth_schema.users u2 ON ccr.reviewed_by = u2.id
      LEFT JOIN auth_schema.roles r ON ccr.target_role_id = r.id
      LEFT JOIN auth_schema.teams t ON ccr.target_team_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      queryStr += ` AND ccr.requested_by = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (status) {
      queryStr += ` AND ccr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryStr += ` ORDER BY ccr.created_at DESC`;

    const result = await query(queryStr, params);

    return result.rows.map((row) => ({
      id: row.id,
      requested_by: row.requested_by,
      channel_name: row.channel_name,
      channel_type: row.channel_type,
      target_role_id: row.target_role_id,
      target_team_id: row.target_team_id,
      requested_members: JSON.parse(row.requested_members || '[]'),
      status: row.status,
      reviewed_by: row.reviewed_by,
      review_notes: row.review_notes,
      created_at: row.created_at,
      reviewed_at: row.reviewed_at,
      requester: row.requester_email ? {
        id: row.requested_by,
        email: row.requester_email,
        first_name: row.requester_first_name,
        last_name: row.requester_last_name,
      } : undefined,
      reviewer: row.reviewer_email ? {
        id: row.reviewed_by,
        email: row.reviewer_email,
        first_name: row.reviewer_first_name,
        last_name: row.reviewer_last_name,
      } : undefined,
      target_role: row.target_role_name ? {
        id: row.target_role_id,
        name: row.target_role_name,
      } : undefined,
      target_team: row.target_team_name ? {
        id: row.target_team_id,
        name: row.target_team_name,
      } : undefined,
    }));
  }
}

