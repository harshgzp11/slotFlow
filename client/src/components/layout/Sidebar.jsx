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
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-[calc(100vh-4rem)] border-r border-slate-800">
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
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
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-slate-800 text-xs text-slate-400">
        <p className="font-medium text-slate-400">SlotFlow Enterprise v1.0</p>
        <p className="mt-0.5">Capacity Recovery Engine Active</p>
      </div>
    </aside>
  );
};
