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

export interface HierarchyNode {
  user: User;
  manager?: HierarchyNode;
  subordinates: HierarchyNode[];
  depth: number;
}

export interface HierarchyTree {
  root: HierarchyNode[];
  maxDepth: number;
}

export interface AssignManagerData {
  subordinateId: string;
  managerId: string;
}

export interface RemoveManagerData {
  subordinateId: string;
}

export interface TransferManagerData {
  subordinateId: string;
  newManagerId: string;
}

export interface BatchAssignManagerData {
  subordinateIds: string[];
  managerId: string;
}

export interface HierarchyHistoryEntry {
  id: string;
  subordinate_id: string;
  old_manager_id: string | null;
  new_manager_id: string | null;
  change_type: 'ASSIGN' | 'REMOVE' | 'TRANSFER';
  created_at: string;
  subordinate_email: string;
  subordinate_first_name: string;
  subordinate_last_name: string;
  old_manager_email?: string;
  old_manager_first_name?: string;
  old_manager_last_name?: string;
  new_manager_email?: string;
  new_manager_first_name?: string;
  new_manager_last_name?: string;
}

// Hierarchy Service
export const hierarchyService = {
  // Admin endpoints
  async assignManager(data: AssignManagerData): Promise<{ message: string; hierarchy: any }> {
    const response = await api.post('/admin/hierarchy/assign', data);
    return response.data;
  },

  async removeManager(data: RemoveManagerData): Promise<{ message: string }> {
    const response = await api.delete('/admin/hierarchy/remove', { data });
    return response.data;
  },

  async getHierarchyTree(): Promise<HierarchyTree> {
    const response = await api.get('/admin/hierarchy/tree');
    return response.data;
  },

  async transferManager(data: TransferManagerData): Promise<{ message: string; hierarchy: any }> {
    const response = await api.post('/admin/hierarchy/transfer', data);
    return response.data;
  },

  async batchAssignManager(data: BatchAssignManagerData): Promise<{ message: string; succeeded: string[]; failed: { id: string; reason: string }[] }> {
    const response = await api.post('/admin/hierarchy/batch-assign', data);
    return response.data;
  },

  async getHierarchyHistory(userId: string): Promise<HierarchyHistoryEntry[]> {
    const response = await api.get(`/admin/hierarchy/history/${userId}`);
    return response.data;
  },

  // User endpoints
  async getMyManager(): Promise<User | null> {
    try {
      const response = await api.get('/users/me/manager');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getMySubordinates(): Promise<User[]> {
    const response = await api.get('/users/me/subordinates');
    return response.data;
  },

  async getAllMySubordinates(): Promise<User[]> {
    const response = await api.get('/users/me/subordinates/all');
    return response.data;
  },
};

