import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { logger } from '../config/logger';

export const requirePermission = (requiredPermission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user's permissions through their roles
      const result = await query(
        `SELECT DISTINCT p.name 
         FROM auth_schema.permissions p
         JOIN auth_schema.role_permissions rp ON p.id = rp.permission_id
         JOIN auth_schema.roles r ON rp.role_id = r.id
         JOIN auth_schema.user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [req.user.userId]
      );

      const userPermissions = result.rows.map((row) => row.name);
      req.userPermissions = userPermissions;

      if (!userPermissions.includes(requiredPermission)) {
        logger.warn('Permission denied', {
          userId: req.user.userId,
          requiredPermission,
          userPermissions,
        });
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredPermission,
        });
      }

      next();
    } catch (error) {
      logger.error('RBAC middleware error', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Helper to check if user has any of the required permissions
export const requireAnyPermission = (requiredPermissions: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await query(
        `SELECT DISTINCT p.name 
         FROM auth_schema.permissions p
         JOIN auth_schema.role_permissions rp ON p.id = rp.permission_id
         JOIN auth_schema.roles r ON rp.role_id = r.id
         JOIN auth_schema.user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [req.user.userId]
      );

      const userPermissions = result.rows.map((row) => row.name);
      req.userPermissions = userPermissions;

      const hasPermission = requiredPermissions.some((perm) =>
        userPermissions.includes(perm)
      );

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: req.user.userId,
          requiredPermissions,
          userPermissions,
        });
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredPermissions,
        });
      }

      next();
    } catch (error) {
      logger.error('RBAC middleware error', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

