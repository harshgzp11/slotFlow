import React from 'react';
import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Navbar } from './Navbar.jsx';
import { Sidebar } from './Sidebar.jsx';
import { PlusCircle, Loader2 } from 'lucide-react';

export const DashboardLayout = () => {
  const { user, memberships, activeBusiness, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <div className="flex flex-col items-center space-y-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
          <p className="text-sm font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has no business workspaces yet, guide them to create one
  if (memberships.length === 0 || !activeBusiness) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-gray-100 p-8 sm:p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1e3a8a] mx-auto mb-4 shadow-sm">
            <PlusCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-light text-gray-800 tracking-tight mb-2">Create Your Business Workspace</h2>
          <p className="text-sm text-gray-500 mb-6">
            Get started by creating your appointment business workspace to set up services and start booking.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center w-full py-3 px-4 bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
          >
            Create Business Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
