import { query } from '../db/pool';
import { HierarchyService } from './hierarchy.service';
import { DailyReport, DailyReportWithUser, User } from '../types';
import { logger } from '../config/logger';

const OPENING_FIELDS = [
  'opening_existing_callbacks',
  'opening_existing_followups',
  'opening_instocks_login',
  'opening_instocks_volume',
  'opening_instocks_approval',
  'opening_disbursed',
  'opening_login_commitment',
  'opening_expected_conversion',
  'opening_documents_pending',
  'opening_login_pending',
] as const;

const CLOSING_FIELDS = [
  'closing_existing_callbacks',
  'closing_existing_followups',
  'closing_total_logins',
  'closing_total_login_volume',
  'closing_total_approvals',
  'closing_total_disbursed',
  'closing_login_commitment',
  'closing_todays_conversion',
  'closing_todays_callback',
  'closing_documents_pending',
  'closing_login_pending',
  'closing_day_status',
] as const;

const ALLOWED_FIELDS = new Set([...OPENING_FIELDS, ...CLOSING_FIELDS]);

export interface DailyReportFilters {
  user_id?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  month?: string; // YYYY-MM
  limit?: number;
  offset?: number;
}

export interface DailyReportStats {
  totals: {
    reports: number;
    openingInstocksLogin: number;
    openingInstocksVolume: number;
    openingInstocksApproval: number;
    openingDisbursed: number;
    closingTotalLogins: number;
    closingTotalLoginVolume: number;
    closingTotalApprovals: number;
    closingTotalDisbursed: number;
    closingTodaysConversion: number;
    closingTodaysCallback: number;
  };
  perUser: {
    user_id: string;
    first_name: string;
    last_name: string;
    reports: number;
    closingTotalLogins: number;
    closingTotalLoginVolume: number;
    closingTotalApprovals: number;
    closingTotalDisbursed: number;
  }[];
}

export class DailyReportService {
  /**
   * Create or update a daily report. Uses partial update so opening and closing
   * submissions can be saved independently for the same day.
   */
  static async upsertReport(
    userId: string,
    reportDate: string,
    fields: Partial<DailyReport>
  ): Promise<DailyReportWithUser> {
    const updateFields: string[] = [];
    const values: any[] = [userId, reportDate];

    for (const [key, value] of Object.entries(fields)) {
      if (!ALLOWED_FIELDS.has(key as any) || value === undefined || value === null) {
        continue;
      }
      updateFields.push(key);
      values.push(value);
    }

    if (updateFields.length === 0) {
      throw new Error('No valid report fields provided');
    }

    const columns = ['user_id', 'report_date', ...updateFields];
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const conflictUpdates = updateFields
      .map((field) => `${field} = COALESCE(EXCLUDED.${field}, finance_schema.daily_reports.${field})`)
      .join(', ');

    const sql = `
      INSERT INTO finance_schema.daily_reports (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (user_id, report_date)
      DO UPDATE SET ${conflictUpdates}, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await query(sql, values);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Get reports the current user is allowed to see (own + subordinates if permitted).
   */
  static async getReports(
    requesterId: string,
    canViewSubordinates: boolean,
    filters: DailyReportFilters = {}
  ): Promise<{ reports: DailyReportWithUser[]; total: number }> {
    const allowedUserIds = new Set<string>([requesterId]);

    if (canViewSubordinates) {
      const subordinates = await HierarchyService.getAllSubordinates(requesterId);
      subordinates.forEach((user) => allowedUserIds.add(user.id));
    }

    if (filters.user_id && !allowedUserIds.has(filters.user_id)) {
      throw new Error('Access denied: cannot view reports for this user');
    }

    const targetUserIds = filters.user_id ? [filters.user_id] : Array.from(allowedUserIds);

    let whereClause = 'WHERE dr.user_id = ANY($1)';
    const params: any[] = [targetUserIds];
    let paramIndex = 2;

    if (filters.date) {
      whereClause += ` AND dr.report_date = $${paramIndex++}`;
      params.push(filters.date);
    }

    if (filters.date_from) {
      whereClause += ` AND dr.report_date >= $${paramIndex++}`;
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereClause += ` AND dr.report_date <= $${paramIndex++}`;
      params.push(filters.date_to);
    }

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      if (!year || !month || year.length !== 4 || month.length !== 2) {
        throw new Error('Invalid month format. Use YYYY-MM');
      }
      whereClause += ` AND dr.report_date >= $${paramIndex++} AND dr.report_date < $${paramIndex++}`;
      params.push(`${year}-${month}-01`);
      params.push(
        new Date(parseInt(year, 10), parseInt(month, 10), 1).toISOString().split('T')[0]
      );
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const result = await query(
      `SELECT dr.*,
              u.email, u.first_name, u.last_name
       FROM finance_schema.daily_reports dr
       JOIN auth_schema.users u ON dr.user_id = u.id
       ${whereClause}
       ORDER BY dr.report_date DESC, u.first_name ASC, u.last_name ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM finance_schema.daily_reports dr
       ${whereClause}`,
      params
    );

    return {
      reports: result.rows.map((row) => this.mapRow(row)),
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Aggregate monthly statistics for allowed users.
   */
  static async getMonthlyStats(
    requesterId: string,
    canViewSubordinates: boolean,
    month: string
  ): Promise<DailyReportStats> {
    const [year, monthStr] = month.split('-');
    if (!year || !monthStr || year.length !== 4 || monthStr.length !== 2) {
      throw new Error('Invalid month format. Use YYYY-MM');
    }

    const startDate = `${year}-${monthStr}-01`;
    const endDate = new Date(parseInt(year, 10), parseInt(monthStr, 10), 1).toISOString().split('T')[0];

    const allowedUserIds = new Set<string>([requesterId]);
    if (canViewSubordinates) {
      const subordinates = await HierarchyService.getAllSubordinates(requesterId);
      subordinates.forEach((user) => allowedUserIds.add(user.id));
    }

    const totalsResult = await query(
      `SELECT
        COUNT(*)::int as reports,
        COALESCE(SUM(opening_instocks_login), 0)::int as opening_instocks_login,
        COALESCE(SUM(opening_instocks_volume), 0)::float as opening_instocks_volume,
        COALESCE(SUM(opening_instocks_approval), 0)::float as opening_instocks_approval,
        COALESCE(SUM(opening_disbursed), 0)::float as opening_disbursed,
        COALESCE(SUM(closing_total_logins), 0)::int as closing_total_logins,
        COALESCE(SUM(closing_total_login_volume), 0)::float as closing_total_login_volume,
        COALESCE(SUM(closing_total_approvals), 0)::float as closing_total_approvals,
        COALESCE(SUM(closing_total_disbursed), 0)::float as closing_total_disbursed,
        COALESCE(SUM(closing_todays_conversion), 0)::int as closing_todays_conversion,
        COALESCE(SUM(closing_todays_callback), 0)::int as closing_todays_callback
       FROM finance_schema.daily_reports
       WHERE user_id = ANY($1)
         AND report_date >= $2
         AND report_date < $3`,
      [Array.from(allowedUserIds), startDate, endDate]
    );

    const perUserResult = await query(
      `SELECT
        dr.user_id,
        u.first_name,
        u.last_name,
        COUNT(*)::int as reports,
        COALESCE(SUM(closing_total_logins), 0)::int as closing_total_logins,
        COALESCE(SUM(closing_total_login_volume), 0)::float as closing_total_login_volume,
        COALESCE(SUM(closing_total_approvals), 0)::float as closing_total_approvals,
        COALESCE(SUM(closing_total_disbursed), 0)::float as closing_total_disbursed
       FROM finance_schema.daily_reports dr
       JOIN auth_schema.users u ON dr.user_id = u.id
       WHERE dr.user_id = ANY($1)
         AND dr.report_date >= $2
         AND dr.report_date < $3
       GROUP BY dr.user_id, u.first_name, u.last_name
       ORDER BY u.first_name, u.last_name`,
      [Array.from(allowedUserIds), startDate, endDate]
    );

    const row = totalsResult.rows[0];
    return {
      totals: {
        reports: parseInt(row.reports, 10),
        openingInstocksLogin: parseInt(row.opening_instocks_login, 10),
        openingInstocksVolume: parseFloat(row.opening_instocks_volume),
        openingInstocksApproval: parseFloat(row.opening_instocks_approval),
        openingDisbursed: parseFloat(row.opening_disbursed),
        closingTotalLogins: parseInt(row.closing_total_logins, 10),
        closingTotalLoginVolume: parseFloat(row.closing_total_login_volume),
        closingTotalApprovals: parseFloat(row.closing_total_approvals),
        closingTotalDisbursed: parseFloat(row.closing_total_disbursed),
        closingTodaysConversion: parseInt(row.closing_todays_conversion, 10),
        closingTodaysCallback: parseInt(row.closing_todays_callback, 10),
      },
      perUser: perUserResult.rows.map((r) => ({
        user_id: r.user_id,
        first_name: r.first_name,
        last_name: r.last_name,
        reports: parseInt(r.reports, 10),
        closingTotalLogins: parseInt(r.closing_total_logins, 10),
        closingTotalLoginVolume: parseFloat(r.closing_total_login_volume),
        closingTotalApprovals: parseFloat(r.closing_total_approvals),
        closingTotalDisbursed: parseFloat(r.closing_total_disbursed),
      })),
    };
  }

  private static mapRow(row: any): DailyReportWithUser {
    const report: DailyReportWithUser = {
      id: row.id,
      user_id: row.user_id,
      report_date: row.report_date instanceof Date
        ? row.report_date.toISOString().split('T')[0]
        : row.report_date,
      opening_existing_callbacks: parseInt(row.opening_existing_callbacks, 10),
      opening_existing_followups: parseInt(row.opening_existing_followups, 10),
      opening_instocks_login: parseInt(row.opening_instocks_login, 10),
      opening_instocks_volume: parseFloat(row.opening_instocks_volume),
      opening_instocks_approval: parseFloat(row.opening_instocks_approval),
      opening_disbursed: parseFloat(row.opening_disbursed),
      opening_login_commitment: parseInt(row.opening_login_commitment, 10),
      opening_expected_conversion: parseInt(row.opening_expected_conversion, 10),
      opening_documents_pending: parseInt(row.opening_documents_pending, 10),
      opening_login_pending: parseInt(row.opening_login_pending, 10),
      closing_existing_callbacks: parseInt(row.closing_existing_callbacks, 10),
      closing_existing_followups: parseInt(row.closing_existing_followups, 10),
      closing_total_logins: parseInt(row.closing_total_logins, 10),
      closing_total_login_volume: parseFloat(row.closing_total_login_volume),
      closing_total_approvals: parseFloat(row.closing_total_approvals),
      closing_total_disbursed: parseFloat(row.closing_total_disbursed),
      closing_login_commitment: parseInt(row.closing_login_commitment, 10),
      closing_todays_conversion: parseInt(row.closing_todays_conversion, 10),
      closing_todays_callback: parseInt(row.closing_todays_callback, 10),
      closing_documents_pending: parseInt(row.closing_documents_pending, 10),
      closing_login_pending: parseInt(row.closing_login_pending, 10),
      closing_day_status: row.closing_day_status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (row.email) {
      report.user = {
        id: row.user_id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        is_active: true,
        created_at: row.created_at,
        updated_at: row.updated_at,
      } as User;
    }

    return report;
  }
}
