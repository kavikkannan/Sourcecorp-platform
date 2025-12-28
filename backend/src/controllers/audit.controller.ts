import { Response } from 'express';
import { AuthRequest } from '../types';
import { AuditService } from '../services/audit.service';

export class AuditController {
  static async getAuditLogs(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const filters: any = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.resourceType) filters.resourceType = req.query.resourceType as string;

      const result = await AuditService.getLogs(limit, offset, filters);

      res.json({
        logs: result.logs,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      throw error;
    }
  }
}

