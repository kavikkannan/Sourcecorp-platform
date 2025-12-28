import { api } from './api';

// Types
export interface Channel {
  id: string;
  name: string | null;
  type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP' | 'DM';
  status: 'ACTIVE' | 'PENDING';
  created_at: string;
  member_count?: number;
  creator?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface ChannelCreationRequest {
  id: string;
  requested_by: string;
  channel_name: string;
  channel_type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP';
  target_role_id: string | null;
  target_team_id: string | null;
  requested_members: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  requester?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  reviewer?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  target_role?: {
    id: string;
    name: string;
  };
  target_team?: {
    id: string;
    name: string;
  };
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  message_type: 'TEXT' | 'FILE' | 'IMAGE';
  content: string;
  created_at: string;
  sender?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  uploader?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export const chatService = {
  // Channel operations
  async getChannels(): Promise<Channel[]> {
    const response = await api.get('/chat/channels');
    return response.data;
  },

  async getChannel(id: string): Promise<Channel> {
    const response = await api.get(`/chat/channels/${id}`);
    return response.data;
  },

  async createChannel(data: { 
    name?: string | null; 
    type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP' | 'DM';
    other_user_id?: string;
    target_role_id?: string;
    target_team_id?: string;
    requested_members?: string[];
  }): Promise<Channel> {
    const response = await api.post('/chat/channels', data);
    return response.data;
  },

  // Channel request operations
  async createChannelRequest(data: {
    channel_name: string;
    channel_type: 'GLOBAL' | 'ROLE' | 'TEAM' | 'GROUP';
    target_role_id?: string;
    target_team_id?: string;
    requested_members?: string[];
  }): Promise<ChannelCreationRequest> {
    const response = await api.post('/chat/channels/request', data);
    return response.data;
  },

  async approveChannelRequest(
    requestId: string,
    reviewNotes?: string
  ): Promise<{ channel: Channel; message: string }> {
    const response = await api.post(`/chat/channels/request/${requestId}/approve`, {
      review_notes: reviewNotes,
    });
    return response.data;
  },

  async rejectChannelRequest(
    requestId: string,
    reviewNotes: string
  ): Promise<{ message: string }> {
    const response = await api.post(`/chat/channels/request/${requestId}/reject`, {
      review_notes: reviewNotes,
    });
    return response.data;
  },

  async getChannelRequests(params?: {
    user_id?: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    all?: boolean;
  }): Promise<ChannelCreationRequest[]> {
    const response = await api.get('/chat/channels/requests', { params });
    return response.data;
  },

  // DM operations
  async startDM(other_user_id: string): Promise<Channel> {
    const response = await api.post('/chat/dm/start', { other_user_id });
    return response.data;
  },

  async getUsersForDM(): Promise<User[]> {
    const response = await api.get('/chat/users');
    return response.data;
  },

  // Message operations
  async getMessages(channelId: string, limit = 50, offset = 0): Promise<Message[]> {
    const response = await api.get(`/chat/messages/${channelId}`, {
      params: { limit, offset },
    });
    return response.data;
  },

  async sendMessage(data: {
    channel_id: string;
    content: string;
    message_type?: 'TEXT' | 'FILE' | 'IMAGE';
  }): Promise<Message> {
    const response = await api.post('/chat/messages', data);
    return response.data;
  },

  // File operations
  async uploadFile(
    channelId: string,
    file: File,
    content?: string
  ): Promise<{ message: Message; attachment: Attachment }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channel_id', channelId);
    if (content) {
      formData.append('content', content);
    }

    const response = await api.post('/chat/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async uploadMultipleFiles(
    channelId: string,
    files: File[],
    content?: string
  ): Promise<{ message: Message; attachments: Attachment[] }> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('channel_id', channelId);
    if (content) {
      formData.append('content', content);
    }

    const response = await api.post('/chat/files/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await api.get(`/chat/files/${fileId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getFileDownloadUrl(fileId: string): string {
    // For direct download links (will require auth via API)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    return `${apiUrl}/chat/files/${fileId}`;
  },
};

