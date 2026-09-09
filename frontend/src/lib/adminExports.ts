import { api } from './api';

export interface AdminCase {
  id: string;
  case_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  loan_type: string;
  loan_amount: number;
  source_type?: 'DSA' | 'DST' | null;
  current_status: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reminder_date?: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    email: string;
    name: string;
  };
  current_assignee?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AdminCasesFilters {
  status?: string;
  loan_type?: string;
  priority?: string;
  month?: string;
  search?: string;
  created_from?: string;
  created_to?: string;
  limit?: number;
  offset?: number;
}

export interface AdminExportFilters {
  status?: string;
  loan_type?: string;
  priority?: string;
  month?: string;
  search?: string;
  created_from?: string;
  created_to?: string;
}

export interface ExportStartResponse {
  status: string;
  jobId: string;
  message: string;
}

export interface ExportProgress {
  progress: number;
  current: number;
  total: number;
}

export interface ExportJobStatus {
  id?: string;
  state?: string;
  status?: string;
  progress: number | ExportProgress;
  filePath?: string;
  result?: any;
  error?: string;
}

export const adminExportService = {
  async getAdminCases(params: AdminCasesFilters = {}): Promise<{ cases: AdminCase[]; total: number; limit: number; offset: number }> {
    const response = await api.get('/admin/cases', { params });
    return response.data;
  },

  async startAdminExport(payload: {
    caseIds?: string[];
    filters?: AdminExportFilters;
    exportAll?: boolean;
  }): Promise<ExportStartResponse> {
    const response = await api.post('/admin/cases/export', payload);
    return response.data;
  },

  async getExportJobStatus(jobId: string): Promise<ExportJobStatus> {
    const response = await api.get(`/admin/cases/export/${jobId}`);
    return response.data;
  },

  async downloadExportArchive(jobId: string): Promise<Blob> {
    const response = await api.get(`/admin/cases/export/download/${jobId}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
