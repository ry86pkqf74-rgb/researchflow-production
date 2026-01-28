/**
 * Authentication Store
 *
 * Zustand store for user authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole, Permission } from '@/types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null as User | null,
      token: null as string | null,
      setUser: (user) => set({ user }),
      setToken: (token) => {
        set({ token });
        // Store token in localStorage for API client
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
        }
      },
      logout: () => {
        set({ user: null, token: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
      },
      hasPermission: (permission) => {
        const { user } = get();
        return user?.permissions.includes(permission) ?? false;
      },
      hasRole: (role) => {
        const { user } = get();
        return user?.role === role;
      },
    }),
    {
      name: 'auth-store',
    }
  )
);
