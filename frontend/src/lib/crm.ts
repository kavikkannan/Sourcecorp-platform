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
    limit?: number;
    offset?: number;
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
  async addNote(caseId: string, note: string): Promise<Note> {
    const response = await api.post(`/crm/cases/${caseId}/notes`, { note });
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
    }
  ): Promise<CaseNotification> {
    const response = await api.post(`/crm/cases/${caseId}/schedule`, data);
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
  { value: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'ASSIGNED', label: 'Assigned', color: 'bg-purple-100 text-purple-800' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PENDING_DOCUMENTS', label: 'Pending Documents', color: 'bg-orange-100 text-orange-800' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'APPROVED', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-100 text-red-800' },
  { value: 'DISBURSED', label: 'Disbursed', color: 'bg-teal-100 text-teal-800' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
];

export const getStatusColor = (status: string): string => {
  return CASE_STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
};

export const getStatusLabel = (status: string): string => {
  return CASE_STATUSES.find(s => s.value === status)?.label || status;
};


