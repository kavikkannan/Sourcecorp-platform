import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { AuditService } from '../services/audit.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AnnouncementsController {
  static async createAnnouncement(req: AuthRequest, res: Response) {
    try {
      const { title, content, category = 'GENERAL' } = req.body;
      let imagePath: string | null = null;

      // Handle image upload if provided
      if (req.file) {
        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), 'uploads', 'announcements');
        await fs.mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = path.join(uploadDir, filename);

        // Save file
        await fs.writeFile(filepath, req.file.buffer);
        // Store relative path for easier access
        imagePath = path.join('uploads', 'announcements', filename);
      }

      const result = await query(
        `INSERT INTO admin_schema.announcements (title, content, author_id, category, image_path)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, content, author_id, is_active, category, image_path, created_at`,
        [title, content, req.user?.userId, category, imagePath]
      );

      const announcement = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.announcements.create',
        resourceType: 'announcement',
        resourceId: announcement.id,
        details: { title, content, category, hasImage: !!imagePath },
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
      const { activeOnly, category, limit, offset } = req.query;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (activeOnly === 'true') {
        whereClause += ` AND a.is_active = true`;
      }

      if (category) {
        whereClause += ` AND a.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total
         FROM admin_schema.announcements a
         JOIN auth_schema.users u ON a.author_id = u.id
         ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Apply pagination
      const limitValue = limit ? parseInt(limit as string) : undefined;
      const offsetValue = offset ? parseInt(offset as string) : undefined;
      
      let paginationClause = '';
      if (limitValue !== undefined) {
        paginationClause += ` LIMIT $${paramIndex}`;
        params.push(limitValue);
        paramIndex++;
      }
      if (offsetValue !== undefined) {
        paginationClause += ` OFFSET $${paramIndex}`;
        params.push(offsetValue);
        paramIndex++;
      }

      const result = await query(
        `SELECT a.id, a.title, a.content, a.is_active, a.category, a.image_path, a.created_at, a.updated_at,
                u.first_name || ' ' || u.last_name as author_name,
                u.email as author_email
         FROM admin_schema.announcements a
         JOIN auth_schema.users u ON a.author_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC
         ${paginationClause}`,
        params
      );

      res.json({
        announcements: result.rows,
        total,
        limit: limitValue,
        offset: offsetValue || 0,
      });
    } catch (error) {
      throw error;
    }
  }

  static async getAnnouncement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT a.id, a.title, a.content, a.is_active, a.category, a.image_path, a.created_at, a.updated_at,
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
      const { title, content, isActive, category } = req.body;

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
      if (category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(category);
      }

      // Handle image upload if provided
      if (req.file) {
        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), 'uploads', 'announcements');
        await fs.mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = path.join(uploadDir, filename);

        // Save file
        await fs.writeFile(filepath, req.file.buffer);
        
        // Delete old image if exists
        const oldAnnouncement = await query(
          `SELECT image_path FROM admin_schema.announcements WHERE id = $1`,
          [id]
        );
        if (oldAnnouncement.rows[0]?.image_path) {
          try {
            let oldImagePath = oldAnnouncement.rows[0].image_path;
            // Handle both absolute and relative paths
            if (!path.isAbsolute(oldImagePath)) {
              oldImagePath = path.join(process.cwd(), oldImagePath);
            }
            await fs.unlink(oldImagePath);
          } catch (err) {
            // Ignore if file doesn't exist
          }
        }

        // Store relative path for easier access
        const relativePath = path.join('uploads', 'announcements', filename);
        updates.push(`image_path = $${paramIndex++}`);
        values.push(relativePath);
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
         RETURNING id, title, content, is_active, category, image_path, updated_at`,
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
        details: { title, content, isActive, category },
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

  // Public method to serve announcement images (no auth required)
  static async getAnnouncementImagePublic(req: any, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT image_path, is_active FROM admin_schema.announcements WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0 || !result.rows[0].image_path) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Optionally check if announcement is active (you can remove this if you want to show all images)
      // if (!result.rows[0].is_active) {
      //   return res.status(404).json({ error: 'Image not found' });
      // }

      return AnnouncementsController.serveImageFile(result.rows[0].image_path, res);
    } catch (error) {
      console.error('Error in getAnnouncementImagePublic:', error);
      throw error;
    }
  }

  static async getAnnouncementImage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT image_path FROM admin_schema.announcements WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0 || !result.rows[0].image_path) {
        return res.status(404).json({ error: 'Image not found' });
      }

      return AnnouncementsController.serveImageFile(result.rows[0].image_path, res);
    } catch (error) {
      console.error('Error in getAnnouncementImage:', error);
      throw error;
    }
  }

  // Helper method to serve image file
  private static async serveImageFile(imagePath: string, res: Response) {

    let filePath = imagePath;
    
    // Handle both absolute and relative paths
    if (!path.isAbsolute(filePath)) {
      // Relative path - join with current working directory
      filePath = path.join(process.cwd(), filePath);
    }
    
    // Normalize the path to handle any path separators
    filePath = path.normalize(filePath);
    
    // Try alternative paths if the primary path doesn't exist
    const possiblePaths = [filePath];
    
    // If absolute path doesn't work, try relative to cwd
    if (path.isAbsolute(imagePath)) {
      const filename = path.basename(imagePath);
      possiblePaths.push(path.join(process.cwd(), 'uploads', 'announcements', filename));
    }
    
    // Try each possible path
    let foundPath: string | null = null;
    for (const tryPath of possiblePaths) {
      try {
        await fs.access(tryPath);
        foundPath = tryPath;
        break;
      } catch {
        // Continue to next path
      }
    }
    
    if (!foundPath) {
      console.error('Image not found at any of these paths:', possiblePaths);
      return res.status(404).json({ error: 'Image file not found' });
    }
    
    filePath = foundPath;
    
    // Read the image file
    try {
      const imageBuffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 
                         ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                         ext === '.gif' ? 'image/gif' : 
                         ext === '.webp' ? 'image/webp' : 'image/jpeg';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(imageBuffer);
    } catch (fileError: any) {
      console.error('Error reading image file:', {
        error: fileError.message,
        path: filePath,
        cwd: process.cwd(),
        originalPath: imagePath
      });
      return res.status(404).json({ error: 'Image file not found' });
    }
  }
}

