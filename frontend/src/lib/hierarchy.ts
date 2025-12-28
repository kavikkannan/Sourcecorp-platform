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
};

