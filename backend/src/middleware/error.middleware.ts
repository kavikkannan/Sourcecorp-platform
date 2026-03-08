import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';
import { AuditService } from '../services/audit.service';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Log error to database (don't await to avoid blocking response)
  const userId = (req as any).user?.userId;
  AuditService.createErrorLog({
    userId: userId || undefined,
    errorMessage: err.message || 'Internal server error',
    errorStack: err.stack,
    errorCode: err.code || err.name || undefined,
    path: req.path,
    method: req.method,
    requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
    requestQuery: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  }).catch((logError) => {
    // Silently fail if error logging fails
    logger.error('Failed to log error to database', logError);
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Database errors
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource not found' });
  }

  // Table doesn't exist error
  if (err.code === '42P01' || err.message?.includes('does not exist')) {
    return res.status(500).json({ 
      error: 'Database tables not found. Please run migration: docker-compose exec backend npm run migrate:hierarchy',
      code: 'MIGRATION_REQUIRED'
    });
  }

  // Default error
  return res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
};

