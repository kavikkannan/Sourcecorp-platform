import { api } from './api';

// Types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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
}

export interface Note {
  id: string;
  content: string;
  created_by: string;
  linked_case_id: string | null;
  visibility: 'PRIVATE' | 'CASE';
  created_at: string;
  creator?: User;
  linked_case?: Case;
}

export interface CreateNoteData {
  content: string;
  linkedCaseId?: string | null;
  visibility?: 'PRIVATE' | 'CASE';
}

// Note Service
export const noteService = {
  async createNote(data: CreateNoteData): Promise<Note> {
    const response = await api.post('/notes', data);
    return response.data;
  },

  async getNote(id: string): Promise<Note> {
    const response = await api.get(`/notes/${id}`);
    return response.data;
  },

  async getMyNotes(): Promise<Note[]> {
    const response = await api.get('/notes/my');
    return response.data;
  },

  async getCaseNotes(caseId: string): Promise<Note[]> {
    const response = await api.get(`/notes/case/${caseId}`);
    return response.data;
  },

  async deleteNote(noteId: string): Promise<void> {
    await api.delete(`/notes/${noteId}`);
  },
};

// Constants
export const NOTE_VISIBILITY = [
  { value: 'PRIVATE', label: 'Private', color: 'bg-gray-100 text-gray-800' },
  { value: 'CASE', label: 'Case', color: 'bg-blue-100 text-blue-800' },
];

export const getVisibilityColor = (visibility: string): string => {
  return NOTE_VISIBILITY.find(v => v.value === visibility)?.color || 'bg-gray-100 text-gray-800';
};

export const getVisibilityLabel = (visibility: string): string => {
  return NOTE_VISIBILITY.find(v => v.value === visibility)?.label || visibility;
};

