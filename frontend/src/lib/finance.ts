import { api } from './api';

// Types
export interface EligibilityCalculation {
  id: string;
  case_id: string;
  monthly_income: number;
  eligible_amount: number;
  requested_amount: number;
  result: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  rule_snapshot: any;
  calculated_at: string;
}

export interface ObligationItem {
  id?: string;
  item_data: Record<string, any>; // Template-driven fields
  order_index?: number;
}

export interface CAMField {
  id: string;
  template_id: string;
  section_name: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
  is_mandatory: boolean;
  is_user_addable: boolean;
  order_index: number;
  default_value?: string;
  validation_rules?: any;
  select_options?: string[];
}

export interface CAMTemplate {
  id: string;
  loan_type: string;
  template_name: string;
  sections: string[];
  is_active: boolean;
  fields?: CAMField[]; // Optional in list view, always present in detail view
}

export interface CAMEntry {
  id: string;
  case_id: string;
  template_id?: string;
  template_snapshot?: any;
  cam_data: Record<string, any>;
  user_added_fields?: Record<string, { label: string; type: string }>;
  version: number;
  created_at: string;
  versions?: Array<{
    id: string;
    version: number;
    created_at: string;
  }>;
}

export interface ObligationField {
  id: string;
  template_id: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
  is_mandatory: boolean;
  is_repeatable: boolean;
  order_index: number;
  default_value?: string;
  validation_rules?: any;
  select_options?: string[];
}

export interface ObligationTemplate {
  id: string;
  template_name: string;
  sections: string[];
  is_active: boolean;
  fields?: ObligationField[]; // Optional in list view, always present in detail view
}

export interface ObligationSheet {
  id: string;
  case_id: string;
  template_id?: string;
  template_snapshot?: any;
  total_obligation: number;
  net_income: number;
  items: ObligationItem[];
  created_at: string;
  updated_at: string;
}

export interface CalculateEligibilityData {
  case_id: string;
  monthly_income: number;
  requested_amount: number;
}

export interface CreateObligationSheetData {
  case_id: string;
  template_id?: string;
  items: Array<Record<string, any>>; // Template-driven items
  net_income: number;
}

export interface CreateCAMEntryData {
  case_id: string;
  template_id?: string;
  loan_type?: string;
  cam_data: Record<string, any>;
  user_added_fields?: Record<string, { label: string; type: string }>;
}

// Finance Service
export const financeService = {
  // Eligibility
  async calculateEligibility(data: CalculateEligibilityData): Promise<EligibilityCalculation> {
    const response = await api.post('/finance/eligibility/calculate', data);
    return response.data;
  },

  async getEligibility(caseId: string): Promise<EligibilityCalculation> {
    const response = await api.get(`/finance/eligibility/${caseId}`);
    return response.data;
  },


  // CAM
  async getCAMTemplate(loanType: string): Promise<CAMTemplate> {
    const response = await api.get(`/finance/cam/template/${loanType}`);
    return response.data;
  },

  async createCAMEntry(data: CreateCAMEntryData): Promise<CAMEntry> {
    const response = await api.post('/finance/cam', data);
    return response.data;
  },

  async getCAMEntry(caseId: string, version?: number): Promise<CAMEntry> {
    const params = version ? { version } : {};
    const response = await api.get(`/finance/cam/${caseId}`, { params });
    return response.data;
  },

  // Obligation
  async getObligationTemplate(): Promise<ObligationTemplate> {
    const response = await api.get('/finance/obligation/template');
    return response.data;
  },

  async createObligationSheet(data: CreateObligationSheetData): Promise<ObligationSheet> {
    const response = await api.post('/finance/obligation', data);
    return response.data;
  },

  async getObligationSheet(caseId: string): Promise<ObligationSheet> {
    const response = await api.get(`/finance/obligation/${caseId}`);
    return response.data;
  },

  // Exports
  async exportEligibility(caseId: string, format: 'csv' | 'xlsx' | 'pdf'): Promise<Blob> {
    const response = await api.get(`/finance/export/eligibility/${caseId}`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportObligation(caseId: string, format: 'csv' | 'xlsx' | 'pdf'): Promise<Blob> {
    const response = await api.get(`/finance/export/obligation/${caseId}`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportCAM(caseId: string, format: 'csv' | 'xlsx' | 'pdf'): Promise<Blob> {
    const response = await api.get(`/finance/export/cam/${caseId}`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },
};

// Helper function to download blob
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

