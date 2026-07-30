import { Response } from 'express';
import { AuthRequest } from '../types';
import { DailyReportService } from '../services/dailyReport.service';

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
];

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
];

export class DailyReportController {
  static async upsertReport(req: AuthRequest, res: Response) {
    try {
      const { report_type, report_date, ...rest } = req.body;
      const allowedFields = report_type === 'OPENING' ? OPENING_FIELDS : CLOSING_FIELDS;

      const fields: Record<string, any> = {};
      for (const key of allowedFields) {
        if (rest[key] !== undefined) {
          fields[key] = rest[key];
        }
      }

      const report = await DailyReportService.upsertReport(
        req.user!.userId,
        report_date,
        fields
      );

      res.status(200).json({ report });
    } catch (error: any) {
      if (error.message?.includes('No valid report fields')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }

  static async getReports(req: AuthRequest, res: Response) {
    try {
      const { user_id, date, date_from, date_to, month, limit = '50', offset = '0' } = req.query;

      const canViewSubordinates = req.userPermissions?.includes('daily_report.view_subordinates') ?? false;

      const result = await DailyReportService.getReports(req.user!.userId, canViewSubordinates, {
        user_id: user_id as string | undefined,
        date: date as string | undefined,
        date_from: date_from as string | undefined,
        date_to: date_to as string | undefined,
        month: month as string | undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json(result);
    } catch (error: any) {
      if (error.message?.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }
      throw error;
    }
  }

  static async getMonthlyStats(req: AuthRequest, res: Response) {
    try {
      const { month } = req.query;
      const canViewSubordinates = req.userPermissions?.includes('daily_report.view_subordinates') ?? false;

      const stats = await DailyReportService.getMonthlyStats(
        req.user!.userId,
        canViewSubordinates,
        month as string
      );

      res.json({ stats });
    } catch (error: any) {
      if (error.message?.includes('Invalid month')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }
}
