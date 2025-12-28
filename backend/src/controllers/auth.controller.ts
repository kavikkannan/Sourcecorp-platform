import { Response } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { redisClient } from '../db/redis';
import { AuditService } from '../services/audit.service';

export class AuthController {
  static async login(req: AuthRequest, res: Response) {
    try {
      const { email, password } = req.body;

      // Find user
      const result = await query(
        `SELECT id, email, password_hash, first_name, last_name, is_active 
         FROM auth_schema.users 
         WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      // Verify password
      const isValid = await comparePassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate tokens
      const payload = { userId: user.id, email: user.email };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Store refresh token in Redis with expiry
      await redisClient.setEx(
        `refresh_token:${user.id}`,
        7 * 24 * 60 * 60, // 7 days
        refreshToken
      );

      // Audit log
      await AuditService.createLog({
        userId: user.id,
        action: 'auth.login',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  static async refresh(req: AuthRequest, res: Response) {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Check if refresh token exists in Redis
      const storedToken = await redisClient.get(`refresh_token:${payload.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Verify user is still active
      const result = await query(
        'SELECT id, email, is_active FROM auth_schema.users WHERE id = $1',
        [payload.userId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Generate new tokens
      const newPayload = { userId: payload.userId, email: payload.email };
      const accessToken = generateAccessToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      // Update refresh token in Redis
      await redisClient.setEx(
        `refresh_token:${payload.userId}`,
        7 * 24 * 60 * 60,
        newRefreshToken
      );

      res.json({
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  }

  static async logout(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Remove refresh token from Redis
      await redisClient.del(`refresh_token:${req.user.userId}`);

      // Audit log
      await AuditService.createLog({
        userId: req.user.userId,
        action: 'auth.logout',
        resourceType: 'user',
        resourceId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      throw error;
    }
  }

  static async me(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const result = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active,
                array_agg(DISTINCT r.name) as roles,
                array_agg(DISTINCT p.name) as permissions
         FROM auth_schema.users u
         LEFT JOIN auth_schema.user_roles ur ON u.id = ur.user_id
         LEFT JOIN auth_schema.roles r ON ur.role_id = r.id
         LEFT JOIN auth_schema.role_permissions rp ON r.id = rp.role_id
         LEFT JOIN auth_schema.permissions p ON rp.permission_id = p.id
         WHERE u.id = $1
         GROUP BY u.id`,
        [req.user.userId]
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
        roles: user.roles.filter((r: string) => r !== null),
        permissions: user.permissions.filter((p: string) => p !== null),
      });
    } catch (error) {
      throw error;
    }
  }
}

