import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { LogOut, Building, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar = () => {
  const { user, memberships, activeBusiness, switchBusiness, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-6">
      {/* Left: Brand */}
      <div className="flex items-center space-x-4">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            S
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">SlotFlow</span>
        </Link>

        {/* Workspace Selector */}
        {memberships.length > 0 && (
          <div className="flex items-center space-x-2 pl-4 border-l border-slate-200">
            <Building className="w-4 h-4 text-slate-400" />
            <select
              value={activeBusiness?._id || ''}
              onChange={(e) => switchBusiness(e.target.value)}
              className="text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {memberships.map((m) => (
                <option key={m.id} value={m.business._id}>
                  {m.business.name} ({m.role})
                </option>
              ))}
            </select>
            {activeBusiness && (
              <a
                href={`/book/${activeBusiness.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-2 px-2 py-1 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
              >
                View Public Page ↗
              </a>
            )}
          </div>
        )}
      </div>

      {/* Right: User and Logout */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-medium">
            <User className="w-4 h-4" />
          </div>
          <span className="font-medium text-slate-800">{user?.name}</span>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center space-x-1.5 text-sm text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-md hover:bg-rose-50 transition-colors"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
