import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Sparkles,
  Users,
  TrendingUp,
  Scissors,
  UserPlus,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export const DashboardOverviewPage: React.FC = () => {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-medium border border-indigo-400/30 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Capacity Recovery Engine Active</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{activeBusiness?.name}</h1>
          <p className="text-indigo-200 text-sm mt-1">
            Timezone: <span className="font-semibold text-white">{activeBusiness?.timezone}</span> • Currency: <span className="font-semibold text-white">{activeBusiness?.currency}</span>
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <a
            href={`/book/${activeBusiness?.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors shadow"
          >
            <span>Live Public Page</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Bookings</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <p className="text-xs text-slate-500 mt-1">Confirmed appointments</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Waitlist</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <p className="text-xs text-slate-500 mt-1">Candidates waiting for slots</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Walk-in Queue</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">0</div>
          <p className="text-xs text-slate-500 mt-1">Waiting customers today</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Recovered Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">$0</div>
          <p className="text-xs text-slate-500 mt-1">From waitlist recovery offers</p>
        </div>
      </div>

      {/* Quick Setup Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-1">Getting Started with SlotFlow</h2>
        <p className="text-sm text-slate-500 mb-4">
          Complete your operational setup to activate public booking and recovery matching:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/dashboard/services"
            className="p-4 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-start space-x-3 group"
          >
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600">
                1. Configure Services
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Define appointment durations in 15-min increments, pricing, and buffers.
              </p>
            </div>
          </Link>

          <Link
            to="/dashboard/staff"
            className="p-4 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-start space-x-3 group"
          >
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600">
                2. Onboard Staff Team
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Set weekly working hours, break periods, and qualified services.
              </p>
            </div>
          </Link>

          <Link
            to="/dashboard/settings"
            className="p-4 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-start space-x-3 group"
          >
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600">
                3. Review Policies
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure advance notice, cancellation cutoff, and business hours.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
