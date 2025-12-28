import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AuthRequest } from '../types';
import { query } from '../db/pool';

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const payload = verifyAccessToken(token);
    
    // Verify user exists and is active
    const userResult = await query(
      'SELECT id, email, is_active FROM auth_schema.users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_active) {
      return res.status(401).json({ error: 'User is inactive' });
    }

    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

