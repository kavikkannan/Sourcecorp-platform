import { api } from './api';

export interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  opening_existing_callbacks: number;
  opening_existing_followups: number;
  opening_instocks_login: number;
  opening_instocks_volume: number;
  opening_instocks_approval: number;
  opening_disbursed: number;
  opening_login_commitment: number;
  opening_expected_conversion: number;
  opening_documents_pending: number;
  opening_login_pending: number;
  closing_existing_callbacks: number;
  closing_existing_followups: number;
  closing_total_logins: number;
  closing_total_login_volume: number;
  closing_total_approvals: number;
  closing_total_disbursed: number;
  closing_login_commitment: number;
  closing_todays_conversion: number;
  closing_todays_callback: number;
  closing_documents_pending: number;
  closing_login_pending: number;
  closing_day_status: 'IN_PROGRESS' | 'COMPLETED';
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface DailyReportTotals {
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
}

export interface DailyReportPerUser {
  user_id: string;
  first_name: string;
  last_name: string;
  reports: number;
  closingTotalLogins: number;
  closingTotalLoginVolume: number;
  closingTotalApprovals: number;
  closingTotalDisbursed: number;
}

export interface DailyReportStats {
  totals: DailyReportTotals;
  perUser: DailyReportPerUser[];
}

export const openingFields = [
  { key: 'opening_existing_callbacks', label: 'Existing Callbacks', type: 'number' },
  { key: 'opening_existing_followups', label: 'Existing Follow-ups', type: 'number' },
  { key: 'opening_instocks_login', label: 'Instocks Login', type: 'number' },
  { key: 'opening_instocks_volume', label: 'Instocks Volume (₹)', type: 'currency' },
  { key: 'opening_instocks_approval', label: 'Instocks Approval (₹)', type: 'currency' },
  { key: 'opening_disbursed', label: 'Disbursed (₹)', type: 'currency' },
  { key: 'opening_login_commitment', label: "Today's Login Commitment", type: 'number' },
  { key: 'opening_expected_conversion', label: "Today's Expected Conversion", type: 'number' },
  { key: 'opening_documents_pending', label: 'Documents Pending', type: 'number' },
  { key: 'opening_login_pending', label: 'Login Pending', type: 'number' },
] as const;

export const closingFields = [
  { key: 'closing_existing_callbacks', label: 'Existing Callbacks', type: 'number' },
  { key: 'closing_existing_followups', label: 'Existing Follow-ups', type: 'number' },
  { key: 'closing_total_logins', label: 'Total Logins', type: 'number' },
  { key: 'closing_total_login_volume', label: 'Total Login Volume (₹)', type: 'currency' },
  { key: 'closing_total_approvals', label: 'Total Approvals (₹)', type: 'currency' },
  { key: 'closing_total_disbursed', label: 'Total Disbursed (₹)', type: 'currency' },
  { key: 'closing_login_commitment', label: "Today's Login Commitment", type: 'number' },
  { key: 'closing_todays_conversion', label: "Today's Conversion", type: 'number' },
  { key: 'closing_todays_callback', label: "Today's Callback", type: 'number' },
  { key: 'closing_documents_pending', label: 'Documents Pending', type: 'number' },
  { key: 'closing_login_pending', label: 'Login Pending', type: 'number' },
  { key: 'closing_day_status', label: 'Day Status', type: 'status' },
] as const;

export type OpeningReportData = Record<(typeof openingFields)[number]['key'], string | number>;
export type ClosingReportData = Record<(typeof closingFields)[number]['key'], string | number>;

export const dailyReportService = {
  async upsertReport(
    report_type: 'OPENING' | 'CLOSING',
    report_date: string,
    data: Partial<OpeningReportData & ClosingReportData>
  ): Promise<DailyReport> {
    const response = await api.post('/daily-reports', {
      report_type,
      report_date,
      ...data,
    });
    return response.data.report;
  },

  async getReports(params?: {
    user_id?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
    month?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ reports: DailyReport[]; total: number }> {
    const response = await api.get('/daily-reports', { params });
    return response.data;
  },

  async getStats(month: string): Promise<DailyReportStats> {
    const response = await api.get('/daily-reports/stats', { params: { month } });
    return response.data.stats;
  },
};

export const formatIndianCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};
