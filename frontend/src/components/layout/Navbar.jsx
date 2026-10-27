import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { LogOut, Building, User, ExternalLink, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar = () => {
  const { user, memberships, activeBusiness, switchBusiness, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-100 sticky top-0 z-30 flex items-center justify-between px-6 shadow-sm/50">
      {/* Left: Brand & Workspace */}
      <div className="flex items-center space-x-5">
        <Link to="/dashboard" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white shadow-sm">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg text-gray-950 tracking-tight">SlotFlow</span>
        </Link>

        {/* Workspace Selector */}
        {memberships.length > 0 && (
          <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
            <Building className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={activeBusiness?._id || ''}
              onChange={(e) => switchBusiness(e.target.value)}
              className="text-xs font-medium text-gray-700 bg-[#f9fafb] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-black transition-colors"
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
                className="text-xs text-gray-600 hover:text-black font-medium ml-1.5 px-2.5 py-1.5 bg-[#f9fafb] border border-gray-200 rounded-lg hover:border-black transition-all flex items-center gap-1"
              >
                <span>Public Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Right: User and Logout */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-xs text-gray-600 bg-[#f9fafb] border border-gray-200 rounded-lg px-3 py-1.5">
          <User className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-medium text-gray-800">{user?.name}</span>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center space-x-1.5 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-black px-3 py-1.5 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
