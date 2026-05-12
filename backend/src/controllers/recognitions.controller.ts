import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { AuditService } from '../services/audit.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export class RecognitionsController {
  static async createRecognition(req: AuthRequest, res: Response) {
    try {
      const { type, employee_name, employee_email, designation, month, description } = req.body;
      let imagePath: string | null = null;

      if (req.file) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'recognitions');
        await fs.mkdir(uploadDir, { recursive: true });
        const timestamp = Date.now();
        const filename = `${timestamp}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, req.file.buffer);
        imagePath = path.join('uploads', 'recognitions', filename);
      }

      const result = await query(
        `INSERT INTO admin_schema.recognitions (type, employee_name, employee_email, designation, month, description, image_path, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [type, employee_name, employee_email, designation, month, description, imagePath, req.user?.userId]
      );

      const recognition = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.recognitions.create',
        resourceType: 'recognition',
        resourceId: recognition.id,
        details: { type, employee_name, month },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(recognition);
    } catch (error) {
      throw error;
    }
  }

  static async getRecognitions(req: AuthRequest, res: Response) {
    try {
      const { activeOnly, type } = req.query;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (activeOnly === 'true') {
        whereClause += ` AND r.is_active = true`;
      }

      if (type) {
        whereClause += ` AND r.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      const result = await query(
        `SELECT r.*, u.first_name || ' ' || u.last_name as creator_name, u.email as creator_email
         FROM admin_schema.recognitions r
         LEFT JOIN auth_schema.users u ON r.created_by = u.id
         ${whereClause}
         ORDER BY r.month DESC, r.created_at DESC`,
        params
      );

      res.json(result.rows);
    } catch (error) {
      throw error;
    }
  }

  static async getRecognition(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT r.*, u.first_name || ' ' || u.last_name as creator_name
         FROM admin_schema.recognitions r
         LEFT JOIN auth_schema.users u ON r.created_by = u.id
         WHERE r.id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Recognition not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  static async updateRecognition(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { employee_name, employee_email, designation, month, description, is_active } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (employee_name !== undefined) { updates.push(`employee_name = $${paramIndex++}`); values.push(employee_name); }
      if (employee_email !== undefined) { updates.push(`employee_email = $${paramIndex++}`); values.push(employee_email); }
      if (designation !== undefined) { updates.push(`designation = $${paramIndex++}`); values.push(designation); }
      if (month !== undefined) { updates.push(`month = $${paramIndex++}`); values.push(month); }
      if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
      if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); values.push(is_active); }

      if (req.file) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'recognitions');
        await fs.mkdir(uploadDir, { recursive: true });
        const timestamp = Date.now();
        const filename = `${timestamp}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, req.file.buffer);

        const old = await query(`SELECT image_path FROM admin_schema.recognitions WHERE id = $1`, [id]);
        if (old.rows[0]?.image_path) {
          try {
            let oldPath = old.rows[0].image_path;
            if (!path.isAbsolute(oldPath)) oldPath = path.join(process.cwd(), oldPath);
            await fs.unlink(oldPath);
          } catch {}
        }

        updates.push(`image_path = $${paramIndex++}`);
        values.push(path.join('uploads', 'recognitions', filename));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const result = await query(
        `UPDATE admin_schema.recognitions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Recognition not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.recognitions.update',
        resourceType: 'recognition',
        resourceId: id,
        details: { employee_name, month },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  static async deleteRecognition(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await query(
        `DELETE FROM admin_schema.recognitions WHERE id = $1 RETURNING id, employee_name`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Recognition not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.recognitions.delete',
        resourceType: 'recognition',
        resourceId: id,
        details: { employee_name: result.rows[0].employee_name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Recognition deleted successfully' });
    } catch (error) {
      throw error;
    }
  }

  static async getRecognitionImagePublic(req: any, res: Response) {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT image_path FROM admin_schema.recognitions WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0 || !result.rows[0].image_path) {
        return res.status(404).json({ error: 'Image not found' });
      }
      return RecognitionsController.serveImageFile(result.rows[0].image_path, res);
    } catch (error) {
      console.error('Error in getRecognitionImagePublic:', error);
      throw error;
    }
  }

  private static async serveImageFile(imagePath: string, res: Response) {
    let filePath = imagePath;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }
    filePath = path.normalize(filePath);

    const possiblePaths = [filePath];
    if (path.isAbsolute(imagePath)) {
      const filename = path.basename(imagePath);
      possiblePaths.push(path.join(process.cwd(), 'uploads', 'recognitions', filename));
    }

    let foundPath: string | null = null;
    for (const tryPath of possiblePaths) {
      try {
        await fs.access(tryPath);
        foundPath = tryPath;
        break;
      } catch {}
    }

    if (!foundPath) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    try {
      const imageBuffer = await fs.readFile(foundPath);
      const ext = path.extname(foundPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' :
                         ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                         ext === '.gif' ? 'image/gif' :
                         ext === '.webp' ? 'image/webp' : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(imageBuffer);
    } catch {
      return res.status(404).json({ error: 'Image file not found' });
    }
  }
}
