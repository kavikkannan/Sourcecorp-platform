import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { hashPassword } from '../utils/password';
import { AuditService } from '../services/audit.service';

export class UsersController {
  static async createUser(req: AuthRequest, res: Response) {
    try {
      const { email, password, firstName, lastName } = req.body;

      const passwordHash = await hashPassword(password);

      const result = await query(
        `INSERT INTO auth_schema.users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, first_name, last_name, is_active, created_at`,
        [email, passwordHash, firstName, lastName]
      );

      const user = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.users.create',
        resourceType: 'user',
        resourceId: user.id,
        details: { email, firstName, lastName },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active,
        createdAt: user.created_at,
      });
    } catch (error) {
      throw error;
    }
  }

  static async getUsers(req: AuthRequest, res: Response) {
    try {
      const result = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at,
                array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as roles
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      );

      const users = result.rows.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active,
        roles: user.roles || [],
        createdAt: user.created_at,
      }));

      res.json(users);
    } catch (error) {
      throw error;
    }
  }

  static async getUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.created_at,
                array_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL) as roles,
                array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as teams
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         LEFT JOIN auth_schema.team_members tm ON u.id = tm.user_id
         LEFT JOIN auth_schema.teams t ON tm.team_id = t.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active,
        roles: user.roles || [],
        teams: user.teams || [],
        createdAt: user.created_at,
      });
    } catch (error) {
      throw error;
    }
  }

  static async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, isActive } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(email);
      }
      if (firstName !== undefined) {
        updates.push(`first_name = $${paramIndex++}`);
        values.push(firstName);
      }
      if (lastName !== undefined) {
        updates.push(`last_name = $${paramIndex++}`);
        values.push(lastName);
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
        `UPDATE auth_schema.users
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, email, first_name, last_name, is_active, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.users.update',
        resourceType: 'user',
        resourceId: id,
        details: { email, firstName, lastName, isActive },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active,
        updatedAt: user.updated_at,
      });
    } catch (error) {
      throw error;
    }
  }

  static async assignRole(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      await query(
        `INSERT INTO auth_schema.user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId]
      );

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.users.assign_role',
        resourceType: 'user',
        resourceId: userId,
        details: { roleId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Role assigned successfully' });
    } catch (error) {
      throw error;
    }
  }

  static async removeRole(req: AuthRequest, res: Response) {
    try {
      const { userId, roleId } = req.params;

      await query(
        `DELETE FROM auth_schema.user_roles
         WHERE user_id = $1 AND role_id = $2`,
        [userId, roleId]
      );

      await AuditService.createLog({
        userId: req.user?.userId,
        action: 'admin.users.remove_role',
        resourceType: 'user',
        resourceId: userId,
        details: { roleId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Role removed successfully' });
    } catch (error) {
      throw error;
    }
  }
}

