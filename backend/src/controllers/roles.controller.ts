import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { AuditService } from '../services/audit.service';

export class RolesController {
  static async createRole(req: AuthRequest, res: Response) {
    try {
      const { name, description } = req.body;

      const result = await query(
        `INSERT INTO auth_schema.roles (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, created_at`,
        [name, description || null]
      );

      const role = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.roles.create',
        resourceType: 'role',
        resourceId: role.id,
        details: { name, description },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(role);
    } catch (error) {
      throw error;
    }
  }

  static async getRoles(req: AuthRequest, res: Response) {
    try {
      const result = await query(
        `SELECT r.id, r.name, r.description, r.created_at,
                COUNT(DISTINCT ur.user_id) as user_count,
                COUNT(DISTINCT rp.permission_id) as permission_count
         FROM auth_schema.roles r
         LEFT JOIN auth_schema.user_roles ur ON r.id = ur.role_id
         LEFT JOIN auth_schema.role_permissions rp ON r.id = rp.role_id
         GROUP BY r.id
         ORDER BY r.created_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      throw error;
    }
  }

  static async getRole(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT r.id, r.name, r.description, r.created_at,
                array_agg(DISTINCT jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description)) 
                  FILTER (WHERE p.id IS NOT NULL) as permissions
         FROM auth_schema.roles r
         LEFT JOIN auth_schema.role_permissions rp ON r.id = rp.role_id
         LEFT JOIN auth_schema.permissions p ON rp.permission_id = p.id
         WHERE r.id = $1
         GROUP BY r.id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Role not found' });
      }

      const role = result.rows[0];
      role.permissions = role.permissions || [];

      res.json(role);
    } catch (error) {
      throw error;
    }
  }

  static async updateRole(req: AuthRequest, res: Response) {
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
        `UPDATE auth_schema.roles
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, description, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Role not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.roles.update',
        resourceType: 'role',
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

  static async deleteRole(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `DELETE FROM auth_schema.roles WHERE id = $1 RETURNING id, name`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Role not found' });
      }

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.roles.delete',
        resourceType: 'role',
        resourceId: id,
        details: { name: result.rows[0].name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Role deleted successfully' });
    } catch (error) {
      throw error;
    }
  }

  static async assignPermission(req: AuthRequest, res: Response) {
    try {
      const { roleId } = req.params;
      const { permissionId } = req.body;

      await query(
        `INSERT INTO auth_schema.role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleId, permissionId]
      );

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.roles.assign_permission',
        resourceType: 'role',
        resourceId: roleId,
        details: { permissionId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Permission assigned successfully' });
    } catch (error) {
      throw error;
    }
  }

  static async removePermission(req: AuthRequest, res: Response) {
    try {
      const { roleId, permissionId } = req.params;

      await query(
        `DELETE FROM auth_schema.role_permissions
         WHERE role_id = $1 AND permission_id = $2`,
        [roleId, permissionId]
      );

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.roles.remove_permission',
        resourceType: 'role',
        resourceId: roleId,
        details: { permissionId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Permission removed successfully' });
    } catch (error) {
      throw error;
    }
  }
}

