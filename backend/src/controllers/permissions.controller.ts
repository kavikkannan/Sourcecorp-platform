import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { AuditService } from '../services/audit.service';

export class PermissionsController {
  static async createPermission(req: AuthRequest, res: Response) {
    try {
      const { name, description } = req.body;

      const result = await query(
        `INSERT INTO auth_schema.permissions (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, created_at`,
        [name, description || null]
      );

      const permission = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.permissions.create',
        resourceType: 'permission',
        resourceId: permission.id,
        details: { name, description },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(permission);
    } catch (error) {
      throw error;
    }
  }

  static async getPermissions(req: AuthRequest, res: Response) {
    try {
      const result = await query(
        `SELECT p.id, p.name, p.description, p.created_at,
                COUNT(DISTINCT rp.role_id) as role_count
         FROM auth_schema.permissions p
         LEFT JOIN auth_schema.role_permissions rp ON p.id = rp.permission_id
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      throw error;
    }
  }

  static async getPermission(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT id, name, description, created_at
         FROM auth_schema.permissions
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  static async updatePermission(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await query(
        `UPDATE auth_schema.permissions
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, description, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.permissions.update',
        resourceType: 'permission',
        resourceId: id,
        details: { name, description },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  static async deletePermission(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `DELETE FROM auth_schema.permissions WHERE id = $1 RETURNING id, name`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.permissions.delete',
        resourceType: 'permission',
        resourceId: id,
        details: { name: result.rows[0].name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Permission deleted successfully' });
    } catch (error) {
      throw error;
    }
  }
}

