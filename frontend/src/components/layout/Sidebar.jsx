import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Sparkles,
  Users,
  Scissors,
  UserCheck,
  BarChart3,
  Settings
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Bookings', href: '/dashboard/bookings', icon: Calendar },
  { name: 'Waitlist Recovery', href: '/dashboard/waitlist', icon: Sparkles, badge: 'Smart' },
  { name: 'Walk-In Queue', href: '/dashboard/queue', icon: Users },
  { name: 'Services', href: '/dashboard/services', icon: Scissors },
  { name: 'Staff Team', href: '/dashboard/staff', icon: UserCheck },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings & Hours', href: '/dashboard/settings', icon: Settings }
];

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-white text-gray-700 flex flex-col min-h-[calc(100vh-4rem)] border-r border-gray-100 shrink-0">
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-3">
          Operations
        </p>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-black text-white shadow-sm'
                      : 'text-gray-600 hover:bg-[#f9fafb] hover:text-black'
                  }`
                }
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-gray-100">
        <div className="p-3 bg-[#f9fafb] border border-gray-200 rounded-xl">
          <p className="text-xs font-semibold text-gray-900">Zero-Gap Recovery</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Automatic waitlist matching active on cancellations.
          </p>
        </div>
      </div>
    </aside>
  );
};
