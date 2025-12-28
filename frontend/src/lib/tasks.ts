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

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  task_type: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL';
  direction: 'DOWNWARD' | 'UPWARD' | null;
  linked_case_id: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assignee?: User;
  assigner?: User;
  linked_case?: Case;
}

export interface TaskComment {
  id: string;
  task_id: string;
  comment: string;
  created_by: string;
  created_at: string;
  creator?: User;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  assignedTo: string;
  taskType: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL';
  direction?: 'DOWNWARD' | 'UPWARD' | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  linkedCaseId?: string | null;
  dueDate?: string | null;
}

export interface UpdateTaskStatusData {
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface AddTaskCommentData {
  comment: string;
}

// Task Service
export const taskService = {
  async createTask(data: CreateTaskData): Promise<Task> {
    const response = await api.post('/tasks', data);
    return response.data;
  },

  async getTask(id: string): Promise<Task> {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  async getMyTasks(params?: {
    status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    taskType?: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL';
  }): Promise<Task[]> {
    const response = await api.get('/tasks/my', { params });
    return response.data;
  },

  async getTasksAssignedToMe(status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'): Promise<Task[]> {
    const params = status ? { status } : {};
    const response = await api.get('/tasks/assigned-to-me', { params });
    return response.data;
  },

  async getTasksAssignedByMe(status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'): Promise<Task[]> {
    const params = status ? { status } : {};
    const response = await api.get('/tasks/assigned-by-me', { params });
    return response.data;
  },

  async getSubordinateTasks(status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'): Promise<Task[]> {
    const params = status ? { status } : {};
    const response = await api.get('/tasks/subordinates', { params });
    return response.data;
  },

  async updateTaskStatus(taskId: string, data: UpdateTaskStatusData): Promise<Task> {
    const response = await api.put(`/tasks/${taskId}/status`, data);
    return response.data;
  },

  async addComment(taskId: string, data: AddTaskCommentData): Promise<TaskComment> {
    const response = await api.post(`/tasks/${taskId}/comments`, data);
    return response.data;
  },

  async getComments(taskId: string): Promise<TaskComment[]> {
    const response = await api.get(`/tasks/${taskId}/comments`);
    return response.data;
  },

  async deleteTask(taskId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}`);
  },
};

// Constants
export const TASK_STATUSES = [
  { value: 'OPEN', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-100 text-green-800' },
];

export const TASK_TYPES = [
  { value: 'PERSONAL', label: 'Personal', color: 'bg-purple-100 text-purple-800' },
  { value: 'COMMON', label: 'Common', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'HIERARCHICAL', label: 'Hierarchical', color: 'bg-orange-100 text-orange-800' },
];

export const TASK_PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'High', color: 'bg-red-100 text-red-800' },
];

export const TASK_DIRECTIONS = [
  { value: 'DOWNWARD', label: 'Downward (Assign to Subordinate)' },
  { value: 'UPWARD', label: 'Upward (Raise to Manager)' },
];

export const getStatusColor = (status: string): string => {
  return TASK_STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
};

export const getStatusLabel = (status: string): string => {
  return TASK_STATUSES.find(s => s.value === status)?.label || status;
};

export const getTaskTypeColor = (taskType: string): string => {
  return TASK_TYPES.find(t => t.value === taskType)?.color || 'bg-gray-100 text-gray-800';
};

export const getTaskTypeLabel = (taskType: string): string => {
  return TASK_TYPES.find(t => t.value === taskType)?.label || taskType;
};

export const getPriorityColor = (priority: string): string => {
  return TASK_PRIORITIES.find(p => p.value === priority)?.color || 'bg-gray-100 text-gray-800';
};

export const getPriorityLabel = (priority: string): string => {
  return TASK_PRIORITIES.find(p => p.value === priority)?.label || priority;
};

export const getDirectionLabel = (direction: string | null): string => {
  if (!direction) return 'N/A';
  return TASK_DIRECTIONS.find(d => d.value === direction)?.label || direction;
};
