import { z } from 'zod';

const reportField = z.union([
  z.number(),
  z.string().transform((val) => {
    if (val === '' || val === undefined) return undefined;
    const num = parseFloat(val);
    if (isNaN(num)) {
      throw new Error('Must be a valid number');
    }
    return num;
  }),
]).optional();

const openingReportBody = z.object({
  report_type: z.literal('OPENING'),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  opening_existing_callbacks: reportField,
  opening_existing_followups: reportField,
  opening_instocks_login: reportField,
  opening_instocks_volume: reportField,
  opening_instocks_approval: reportField,
  opening_disbursed: reportField,
  opening_login_commitment: reportField,
  opening_expected_conversion: reportField,
  opening_documents_pending: reportField,
  opening_login_pending: reportField,
});

const closingReportBody = z.object({
  report_type: z.literal('CLOSING'),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  closing_existing_callbacks: reportField,
  closing_existing_followups: reportField,
  closing_total_logins: reportField,
  closing_total_login_volume: reportField,
  closing_total_approvals: reportField,
  closing_total_disbursed: reportField,
  closing_login_commitment: reportField,
  closing_todays_conversion: reportField,
  closing_todays_callback: reportField,
  closing_documents_pending: reportField,
  closing_login_pending: reportField,
  closing_day_status: z.enum(['IN_PROGRESS', 'COMPLETED']).optional(),
});

export const upsertDailyReportSchema = z.object({
  body: z.union([openingReportBody, closingReportBody]),
});

export const getDailyReportsSchema = z.object({
  query: z.object({
    user_id: z.string().uuid('Invalid user ID').optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
  }),
});

export const getDailyReportStatsSchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  }),
});
