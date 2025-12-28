import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { AuditService } from '../services/audit.service';

export class AnnouncementsController {
  static async createAnnouncement(req: AuthRequest, res: Response) {
    try {
      const { title, content } = req.body;

      const result = await query(
        `INSERT INTO admin_schema.announcements (title, content, author_id)
         VALUES ($1, $2, $3)
         RETURNING id, title, content, author_id, is_active, created_at`,
        [title, content, req.user?.userId]
      );

      const announcement = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.announcements.create',
        resourceType: 'announcement',
        resourceId: announcement.id,
        details: { title, content },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(announcement);
    } catch (error) {
      throw error;
    }
  }

  static async getAnnouncements(req: AuthRequest, res: Response) {
    try {
      const { activeOnly } = req.query;

      let whereClause = '';
      if (activeOnly === 'true') {
        whereClause = 'WHERE a.is_active = true';
      }

      const result = await query(
        `SELECT a.id, a.title, a.content, a.is_active, a.created_at, a.updated_at,
                u.first_name || ' ' || u.last_name as author_name,
                u.email as author_email
         FROM admin_schema.announcements a
         JOIN auth_schema.users u ON a.author_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      throw error;
    }
  }

  static async getAnnouncement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT a.id, a.title, a.content, a.is_active, a.created_at, a.updated_at,
                u.first_name || ' ' || u.last_name as author_name,
                u.email as author_email
         FROM admin_schema.announcements a
         JOIN auth_schema.users u ON a.author_id = u.id
         WHERE a.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  static async updateAnnouncement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { title, content, isActive } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
      }
      if (content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        values.push(content);
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(isActive);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await query(
        `UPDATE admin_schema.announcements
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, title, content, is_active, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.announcements.update',
        resourceType: 'announcement',
        resourceId: id,
        details: { title, content, isActive },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  static async deleteAnnouncement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `DELETE FROM admin_schema.announcements WHERE id = $1 RETURNING id, title`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.announcements.delete',
        resourceType: 'announcement',
        resourceId: id,
        details: { title: result.rows[0].title },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
      throw error;
    }
  }
}

