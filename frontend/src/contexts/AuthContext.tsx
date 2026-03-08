'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, User, LoginCredentials } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      // First, try to load user from localStorage for immediate display
      const storedUser = authService.getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }

      // Then verify with server if authenticated
      // Check if we have either access token or refresh token
      const hasAccessToken = authService.isAuthenticated();
      const hasRefreshToken = typeof window !== 'undefined' && !!localStorage.getItem('refreshToken');
      
      if (hasAccessToken || hasRefreshToken) {
        try {
          const userData = await authService.getMe();
          setUser(userData);
          authService.storeUser(userData);
        } catch (error: any) {
          console.error('Failed to fetch user data:', error);
          // Only logout if it's not a network error and we don't have refresh token
          // The API interceptor will handle token refresh automatically
          if (error.response?.status === 401 && !hasRefreshToken) {
            // No refresh token available, clear everything
            setUser(null);
            await authService.logout();
          } else if (error.response?.status !== 401) {
            // For non-401 errors, keep the stored user but don't logout
            // This handles network errors gracefully
            console.warn('Non-auth error during user fetch, keeping stored user');
          }
          // For 401 with refresh token, let the interceptor handle it
        }
      } else if (storedUser) {
        // If not authenticated and no tokens, clear stored user
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user');
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    authService.storeTokens(response.accessToken, response.refreshToken);
    
    const userData = await authService.getMe();
    setUser(userData);
    authService.storeUser(userData);
    
    // Wait a bit to ensure state is updated before navigation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    router.push('/dashboard');
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.push('/login');
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) ?? false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some((permission) => hasPermission(permission));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

