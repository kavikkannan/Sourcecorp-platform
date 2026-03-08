import { api } from './api';

// Types
export interface Case {
  id: string;
  case_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  loan_type: string;
  loan_amount: number;
  source_type?: 'DSA' | 'DST' | null;
  current_status: string;
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
  assignments?: Assignment[];
}

export interface Assignment {
  id: string;
  assigned_at: string;
  assignee: {
    id: string;
    email: string;
    name: string;
  };
  assigner: {
    id: string;
    email: string;
    name: string;
  };
}

export interface Document {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  uploader?: {
    email: string;
    name: string;
  };
}

export interface Note {
  id: string;
  note: string;
  created_at: string;
  creator?: {
    email: string;
    name: string;
  };
  document?: {
    id: string;
    file_name: string;
    mime_type: string;
    file_size: number;
  } | null;
}

export interface TimelineEvent {
  id: string;
  type: 'status_change' | 'assignment' | 'note' | 'document' | 'notification';
  timestamp: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  details: any;
}

export interface ScheduleableUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface CaseNotification {
  id: string;
  case_id: string;
  case_number?: string;
  case_customer_name?: string;
  case_status?: string;
  scheduled_for: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  scheduled_by: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  message?: string;
  scheduled_at: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  is_read: boolean;
  completion_status: 'ONGOING' | 'COMPLETED';
  created_at: string;
  updated_at: string;
  document?: {
    id: string;
    file_name: string;
    mime_type: string;
    file_size: number;
  } | null;
  change_request_id?: string;
  change_request_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  change_request_changes?: Record<string, any>;
}

export interface CreateCaseData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  loan_type: string;
  loan_amount: number;
  source_type?: 'DSA' | 'DST' | null;
  documents?: File[];
}

// CRM Service
export const crmService = {
  // Cases
  async createCase(data: CreateCaseData): Promise<Case> {
    const formData = new FormData();
    formData.append('customer_name', data.customer_name);
    formData.append('customer_email', data.customer_email);
    formData.append('customer_phone', data.customer_phone);
    formData.append('loan_type', data.loan_type);
    formData.append('loan_amount', data.loan_amount.toString());
    
    if (data.source_type) {
      formData.append('source_type', data.source_type);
    }
    
    if (data.documents && data.documents.length > 0) {
      data.documents.forEach((file) => {
        formData.append('documents', file);
      });
    }

    const response = await api.post('/crm/cases', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getCases(params?: {
    status?: string;
    view_type?: 'individual' | 'team';
    created_by?: string;
    limit?: number;
    offset?: number;
    month?: string; // Format: 'YYYY-MM'
  }): Promise<{ cases: Case[]; total: number; limit: number; offset: number }> {
    const response = await api.get('/crm/cases', { params });
    return response.data;
  },

  async getCaseById(id: string): Promise<Case> {
    const response = await api.get(`/crm/cases/${id}`);
    return response.data;
  },

  // Assignment
  async assignCase(caseId: string, userId: string): Promise<void> {
    await api.post(`/crm/cases/${caseId}/assign`, {
      assigned_to: userId,
    });
  },

  // Delete case
  async deleteCase(caseId: string): Promise<void> {
    await api.delete(`/crm/cases/${caseId}`);
  },

  // Status
  async updateStatus(
    caseId: string,
    newStatus: string,
    remarks?: string
  ): Promise<void> {
    await api.post(`/crm/cases/${caseId}/status`, {
      new_status: newStatus,
      remarks,
    });
  },

  // Documents
  async uploadDocument(caseId: string, file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/crm/cases/${caseId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getDocuments(caseId: string): Promise<{ documents: Document[] }> {
    const response = await api.get(`/crm/cases/${caseId}/documents`);
    return response.data;
  },

  async downloadDocument(documentId: string): Promise<Blob> {
    const response = await api.get(`/crm/documents/${documentId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Notes
  async addNote(caseId: string, note: string, file?: File): Promise<Note> {
    const formData = new FormData();
    formData.append('note', note);
    if (file) {
      formData.append('file', file);
    }

    const response = await api.post(`/crm/cases/${caseId}/notes`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getNotes(caseId: string): Promise<{ notes: Note[] }> {
    const response = await api.get(`/crm/cases/${caseId}/notes`);
    return response.data;
  },

  // Timeline
  async getTimeline(caseId: string): Promise<{ timeline: TimelineEvent[] }> {
    const response = await api.get(`/crm/cases/${caseId}/timeline`);
    return response.data;
  },

  // Notifications/Scheduling
  async getScheduleableUsers(): Promise<{ above: ScheduleableUser[]; below: ScheduleableUser[] }> {
    const response = await api.get('/crm/scheduleable-users');
    return response.data;
  },

  async scheduleNotification(
    caseId: string,
    data: {
      scheduled_for: string;
      message?: string;
      scheduled_at: string;
    },
    file?: File
  ): Promise<CaseNotification> {
    const formData = new FormData();
    formData.append('scheduled_for', data.scheduled_for);
    formData.append('scheduled_at', data.scheduled_at);
    if (data.message) {
      formData.append('message', data.message);
    }
    if (file) {
      formData.append('file', file);
    }

    const response = await api.post(`/crm/cases/${caseId}/schedule`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getCaseNotifications(caseId: string): Promise<{ notifications: CaseNotification[] }> {
    const response = await api.get(`/crm/cases/${caseId}/notifications`);
    return response.data;
  },

  // User Notifications
  async getUserNotifications(params?: {
    is_read?: boolean;
    completion_status?: 'ONGOING' | 'COMPLETED';
    due_date_from?: string;
    due_date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ notifications: CaseNotification[]; total: number }> {
    const response = await api.get('/crm/notifications', { params });
    return response.data;
  },

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    const response = await api.get('/crm/notifications/unread-count');
    return response.data;
  },

  async markNotificationRead(notificationId: string, isRead: boolean): Promise<void> {
    await api.patch(`/crm/notifications/${notificationId}/read`, { is_read: isRead });
  },

  async markNotificationCompletion(
    notificationId: string,
    completionStatus: 'ONGOING' | 'COMPLETED'
  ): Promise<void> {
    await api.patch(`/crm/notifications/${notificationId}/completion`, {
      completion_status: completionStatus,
    });
  },

  // Customer Detail Sheets
  async uploadCustomerDetailSheet(caseId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/crm/cases/${caseId}/customer-detail-sheet`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getCustomerDetailSheet(caseId: string): Promise<any> {
    const response = await api.get(`/crm/cases/${caseId}/customer-detail-sheet`);
    return response.data;
  },

  async getCustomerDetailTemplate(): Promise<any[]> {
    const response = await api.get('/admin/customer-detail-template');
    return response.data;
  },

  async updateCustomerDetailTemplate(fields: Array<{
    field_key: string;
    field_label: string;
    is_visible: boolean;
    display_order: number;
  }>): Promise<void> {
    await api.post('/admin/customer-detail-template', { fields });
  },

  // Customer Detail Change Requests
  async createCustomerDetailChangeRequest(
    caseId: string,
    requestedFor: string,
    requestedChanges: Record<string, any>
  ): Promise<any> {
    const response = await api.post(`/crm/cases/${caseId}/customer-detail-change-request`, {
      requested_for: requestedFor,
      requested_changes: requestedChanges,
    });
    return response.data;
  },

  async getCustomerDetailChangeRequests(caseId: string): Promise<any[]> {
    const response = await api.get(`/crm/cases/${caseId}/customer-detail-change-requests`);
    return response.data.change_requests;
  },

  async getPendingChangeRequests(): Promise<any[]> {
    const response = await api.get('/crm/customer-detail-change-requests/pending');
    return response.data.change_requests;
  },

  async getUsersWithModifyPermission(): Promise<any[]> {
    const response = await api.get('/crm/customer-detail-change-requests/approvers');
    return response.data.users;
  },

  async approveCustomerDetailChangeRequest(requestId: string, remarks?: string): Promise<any> {
    const response = await api.post(`/crm/customer-detail-change-requests/${requestId}/approve`, {
      remarks,
    });
    return response.data;
  },

  async rejectCustomerDetailChangeRequest(requestId: string, remarks?: string): Promise<any> {
    const response = await api.post(`/crm/customer-detail-change-requests/${requestId}/reject`, {
      remarks,
    });
    return response.data;
  },
};

// Constants
export const LOAN_TYPES = [
  { value: 'PERSONAL', label: 'Personal Loan' },
  { value: 'HOME', label: 'Home Loan' },
  { value: 'AUTO', label: 'Auto Loan' },
  { value: 'BUSINESS', label: 'Business Loan' },
  { value: 'EDUCATION', label: 'Education Loan' },
];

export const CASE_STATUSES = [
  { value: 'NEW', label: 'New Case', color: 'bg-blue-100 text-blue-800' },
  { value: 'LOGIN', label: 'Login Case', color: 'bg-purple-100 text-purple-800' },
  { value: 'SALES_REWORK', label: 'Sales Rework', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'CREDIT_REWORK', label: 'Credit Rework', color: 'bg-orange-100 text-orange-800' },
  { value: 'CREDIT_UNDERWRITING', label: 'Credit Underwriting', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'CREDIT_APPROVED', label: 'Credit Approved', color: 'bg-green-100 text-green-800' },
  { value: 'DISBURSED', label: 'Disbursed Case', color: 'bg-teal-100 text-teal-800' },
  { value: 'REJECTED', label: 'Rejected Case', color: 'bg-red-100 text-red-800' },
];

export const getStatusColor = (status: string): string => {
  return CASE_STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
};

export const getStatusLabel = (status: string): string => {
  return CASE_STATUSES.find(s => s.value === status)?.label || status;
};


