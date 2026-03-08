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

export interface ErrorLogData {
  userId?: string;
  errorMessage: string;
  errorStack?: string;
  errorCode?: string;
  path?: string;
  method?: string;
  requestBody?: any;
  requestQuery?: any;
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

  static async createErrorLog(data: ErrorLogData): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_schema.error_logs 
         (user_id, error_message, error_stack, error_code, path, method, request_body, request_query, ip_address, user_agent) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          data.userId || null,
          data.errorMessage,
          data.errorStack || null,
          data.errorCode || null,
          data.path || null,
          data.method || null,
          data.requestBody ? JSON.stringify(data.requestBody) : null,
          data.requestQuery ? JSON.stringify(data.requestQuery) : null,
          data.ipAddress || null,
          data.userAgent || null,
        ]
      );
    } catch (error) {
      logger.error('Failed to create error log', error);
      // Don't throw error - error logging should not break the main operation
    }
  }

  static async getLogs(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      month?: string; // Format: 'YYYY-MM'
      logType?: 'audit' | 'error' | 'all'; // New filter for log type
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

      // Month filter: filter by year and month
      if (filters.month) {
        const [year, month] = filters.month.split('-');
        conditions.push(`EXTRACT(YEAR FROM created_at) = $${paramIndex++} AND EXTRACT(MONTH FROM created_at) = $${paramIndex++}`);
        params.push(parseInt(year), parseInt(month));
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
        u.first_name || ' ' || u.last_name as user_name,
        'audit' as log_type
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

  static async getErrorLogs(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      userId?: string;
      month?: string; // Format: 'YYYY-MM'
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

      // Month filter: filter by year and month
      if (filters.month) {
        const [year, month] = filters.month.split('-');
        conditions.push(`EXTRACT(YEAR FROM created_at) = $${paramIndex++} AND EXTRACT(MONTH FROM created_at) = $${paramIndex++}`);
        params.push(parseInt(year), parseInt(month));
      }
      
      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT 
        el.*,
        u.email as user_email,
        u.first_name || ' ' || u.last_name as user_name,
        'error' as log_type
       FROM audit_schema.error_logs el
       LEFT JOIN auth_schema.users u ON el.user_id = u.id
       ${whereClause}
       ORDER BY el.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_schema.error_logs ${whereClause}`,
      params.slice(0, -2)
    );

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  static async getAllLogs(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      month?: string; // Format: 'YYYY-MM'
    }
  ) {
    // Get both audit and error logs, combine them
    const auditLogsPromise = this.getLogs(limit * 2, 0, filters);
    const errorLogsPromise = this.getErrorLogs(limit * 2, 0, filters);

    const [auditResult, errorResult] = await Promise.all([auditLogsPromise, errorLogsPromise]);

    // Combine and sort by created_at
    const allLogs = [
      ...auditResult.logs.map((log: any) => ({ ...log, log_type: 'audit' })),
      ...errorResult.logs.map((log: any) => ({ ...log, log_type: 'error' }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination
    const paginatedLogs = allLogs.slice(offset, offset + limit);
    const total = auditResult.total + errorResult.total;

    return {
      logs: paginatedLogs,
      total,
    };
  }
}

