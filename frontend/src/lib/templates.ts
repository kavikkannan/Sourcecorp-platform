import { api } from './api';
import { CAMTemplate, CAMField, ObligationTemplate, ObligationField } from './finance';

// Re-export types for convenience
export type { CAMTemplate, CAMField, ObligationTemplate, ObligationField };

// Template Management Service (Admin only)
export const templateService = {
  // CAM Templates
  async getAllCAMTemplates(): Promise<CAMTemplate[]> {
    const response = await api.get('/finance/templates/cam');
    return response.data;
  },

  async getCAMTemplate(id: string): Promise<CAMTemplate> {
    const response = await api.get(`/finance/templates/cam/${id}`);
    return response.data;
  },

  async createCAMTemplate(data: {
    loan_type: string;
    template_name: string;
    sections: string[];
    fields: Array<{
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
    }>;
  }): Promise<CAMTemplate> {
    const response = await api.post('/finance/templates/cam', data);
    return response.data;
  },

  async updateCAMTemplate(
    id: string,
    data: {
      template_name?: string;
      sections?: string[];
      is_active?: boolean;
      fields?: Array<{
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
      }>;
    }
  ): Promise<CAMTemplate> {
    const response = await api.put(`/finance/templates/cam/${id}`, data);
    return response.data;
  },

  // Obligation Templates
  async getAllObligationTemplates(): Promise<ObligationTemplate[]> {
    const response = await api.get('/finance/templates/obligation');
    return response.data;
  },

  async getObligationTemplate(id?: string): Promise<ObligationTemplate> {
    const url = id ? `/finance/templates/obligation/${id}` : '/finance/templates/obligation';
    const response = await api.get(url);
    return response.data;
  },

  async createObligationTemplate(data: {
    template_name: string;
    sections: string[];
    fields: Array<{
      field_key: string;
      label: string;
      field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
      is_mandatory: boolean;
      is_repeatable: boolean;
      order_index: number;
      default_value?: string;
      validation_rules?: any;
      select_options?: string[];
    }>;
  }): Promise<ObligationTemplate> {
    const response = await api.post('/finance/templates/obligation', data);
    return response.data;
  },

  async updateObligationTemplate(
    id: string,
    data: {
      template_name?: string;
      sections?: string[];
      is_active?: boolean;
      fields?: Array<{
        field_key: string;
        label: string;
        field_type: 'text' | 'number' | 'currency' | 'date' | 'select';
        is_mandatory: boolean;
        is_repeatable: boolean;
        order_index: number;
        default_value?: string;
        validation_rules?: any;
        select_options?: string[];
      }>;
    }
  ): Promise<ObligationTemplate> {
    const response = await api.put(`/finance/templates/obligation/${id}`, data);
    return response.data;
  },
};

