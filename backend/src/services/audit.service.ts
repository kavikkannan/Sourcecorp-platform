import { query } from '../db/pool';
import { logger } from '../config/logger';

export interface AuditLogData {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async createLog(data: AuditLogData): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_schema.audit_logs 
         (user_id, action, resource_type, resource_id, details, ip_address, user_agent) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          data.userId || null,
          data.action,
          data.resourceType,
          data.resourceId || null,
          data.details ? JSON.stringify(data.details) : null,
          data.ipAddress || null,
          data.userAgent || null,
        ]
      );
    } catch (error) {
      logger.error('Failed to create audit log', error);
      // Don't throw error - audit logging should not break the main operation
    }
  }

  static async getLogs(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
    }
  ) {
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters) {
      const conditions: string[] = [];
      
      if (filters.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(filters.userId);
      }
      
      if (filters.action) {
        conditions.push(`action = $${paramIndex++}`);
        params.push(filters.action);
      }
      
      if (filters.resourceType) {
        conditions.push(`resource_type = $${paramIndex++}`);
        params.push(filters.resourceType);
      }
      
      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT 
        al.*,
        u.email as user_email,
        u.first_name || ' ' || u.last_name as user_name
       FROM audit_schema.audit_logs al
       LEFT JOIN auth_schema.users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_schema.audit_logs ${whereClause}`,
      params.slice(0, -2)
    );

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }
}

