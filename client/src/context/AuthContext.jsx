import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchMe() {
    try {
      const res = await apiRequest('/auth/me');
      if (res.success) {
        setUser(res.data.user);
        setMemberships(res.data.memberships);

        const savedBusinessId = localStorage.getItem('activeBusinessId') || res.data.activeBusinessId;
        const currentBiz = res.data.memberships.find((m) => m.business._id === savedBusinessId)?.business
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

  async function login(credentials) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res.success) {
      await fetchMe();
    }
  }

  async function register(data) {
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

  async function switchBusiness(businessId) {
    const res = await apiRequest('/auth/switch-business', {
      method: 'POST',
      body: JSON.stringify({ businessId })
    });
    if (res.success) {
      localStorage.setItem('activeBusinessId', businessId);
      setActiveBusiness(res.data.business);
      window.location.reload();
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
