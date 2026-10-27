import React, { createContext, useContext, useEffect, useState } from 'react';
import { IUser, IMembership, IBusiness } from '../types';
import { apiRequest } from '../lib/api';

interface AuthContextType {
  user: IUser | null;
  memberships: IMembership[];
  activeBusiness: IBusiness | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [memberships, setMemberships] = useState<IMembership[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<IBusiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchMe() {
    try {
      const res = await apiRequest('/auth/me');
      if (res.success) {
        setUser(res.data.user);
        setMemberships(res.data.memberships);

        const savedBusinessId = localStorage.getItem('activeBusinessId') || res.data.activeBusinessId;
        const currentBiz = res.data.memberships.find((m: IMembership) => m.business._id === savedBusinessId)?.business
          || res.data.memberships[0]?.business
          || null;

        setActiveBusiness(currentBiz);
        if (currentBiz) {
          localStorage.setItem('activeBusinessId', currentBiz._id);
        }
      }
    } catch {
      setUser(null);
      setMemberships([]);
      setActiveBusiness(null);
      localStorage.removeItem('activeBusinessId');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
  }, []);

  async function login(credentials: { email: string; password: string }) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res.success) {
      await fetchMe();
    }
  }

  async function register(data: { name: string; email: string; password: string }) {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.success) {
      await fetchMe();
    }
  }

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
    setMemberships([]);
    setActiveBusiness(null);
    localStorage.removeItem('activeBusinessId');
  }

  async function switchBusiness(businessId: string) {
    const res = await apiRequest('/auth/switch-business', {
      method: 'POST',
      body: JSON.stringify({ businessId })
    });
    if (res.success) {
      localStorage.setItem('activeBusinessId', businessId);
      setActiveBusiness(res.data.business);
      window.location.reload(); // Refresh state cleanly
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeBusiness,
        isLoading,
        login,
        register,
        logout,
        switchBusiness,
        refreshAuth: fetchMe
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
