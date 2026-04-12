import api from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post('/auth/login', credentials, {
      withCredentials: true,
    });
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true });
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
      }
    }
  },

  async getMe(): Promise<User> {
    const response = await api.get('/auth/me', { withCredentials: true });
    return response.data;
  },

  isAuthenticated(): boolean {
    // With httpOnly cookies, we can't check for token existence client-side
    // Instead, we check if we have a user stored or make an API call
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('user');
    }
    return false;
  },

  getStoredUser(): User | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          return null;
        }
      }
    }
    return null;
  },

  storeTokens(_accessToken: string, _refreshToken: string): void {
    // Tokens are now stored in httpOnly cookies by the server
    // This method is kept for backward compatibility but does nothing
  },

  storeUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },
};

