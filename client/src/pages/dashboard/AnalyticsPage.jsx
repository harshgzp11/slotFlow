import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.js';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Users,
  Sparkles,
  PieChart,
  Percent,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [daysWindow, setDaysWindow] = useState('30');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadAnalytics() {
    setIsLoading(true);
    setError(null);
    try {
      const now = new Date();
      const past = new Date(now.getTime() - Number(daysWindow) * 86400000);
      const res = await apiRequest(
        `/analytics/overview?startDate=${past.toISOString()}&endDate=${now.toISOString()}`
      );
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [daysWindow]);

  const metrics = data?.metrics || {};
  const bySource = data?.bySource || [];
  const byStaff = data?.byStaff || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Business Analytics & Capacity
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time utilization rates, recovery yield, and staff operational efficiency.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-500">Time Window:</label>
          <select
            value={daysWindow}
            onChange={(e) => setDaysWindow(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="7">Past 7 Days</option>
            <option value="30">Past 30 Days</option>
            <option value="90">Past 90 Days</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Recovered Revenue */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-emerald-200 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Recovered Revenue
                  </span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black">${metrics.recoveredRevenue || 0}</div>
                <p className="text-xs text-emerald-300 mt-1">
                  From {metrics.recoveredBookingsCount || 0} rescued cancellations
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-700/50 flex items-center justify-between text-[11px] text-emerald-200">
                <span>Waitlist Recovery Yield</span>
                <span className="font-bold text-white">Active</span>
              </div>
            </div>

            {/* Capacity Utilization */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Capacity Utilization
                  </span>
                  <Percent className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {metrics.capacityUtilizationPercentage || 0}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {metrics.bookedMinutes || 0} mins booked / {metrics.totalCapacityMinutes || 0} shift mins
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Working Shift Capacity</span>
                <span className="font-semibold text-slate-700">Calculated</span>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
                  <DollarSign className="w-4 h-4 text-slate-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">
                  ${metrics.totalRevenue || 0}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Across {metrics.totalBookings || 0} total bookings
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Completed: {metrics.completedBookings || 0}</span>
                <span className="font-semibold text-slate-700">Gross</span>
              </div>
            </div>

            {/* Cancellation Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Cancellation Rate
                  </span>
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {metrics.cancellationRate || 0}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {metrics.cancelledBookings || 0} cancellations / {metrics.noShowBookings || 0} no-shows
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Zero-gap hold protected</span>
                <span className="font-semibold text-emerald-600">Durable</span>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown by Source */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:col-span-1 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                <span>Booking Channels</span>
              </h2>

              <div className="space-y-3">
                {bySource.map((src) => (
                  <div
                    key={src._id}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-800">
                        {src._id === 'WAITLIST_RECOVERY'
                          ? 'Waitlist Recovery'
                          : src._id === 'PUBLIC'
                          ? 'Public Web Portal'
                          : src._id === 'WALK_IN'
                          ? 'Walk-In Queue'
                          : 'Staff Direct'}
                      </span>
                      <p className="text-[11px] text-slate-500">{src.count} appointment(s)</p>
                    </div>
                    <span className="font-bold text-sm text-slate-900">${src.revenue}</span>
                  </div>
                ))}
                {bySource.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No bookings in selected window</p>
                )}
              </div>
            </div>

            {/* Staff Performance Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:col-span-2 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Specialist Provider Efficiency</span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Specialist</th>
                      <th className="py-2.5 px-3">Bookings</th>
                      <th className="py-2.5 px-3">Completed</th>
                      <th className="py-2.5 px-3">Booked Time</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byStaff.map((st) => (
                      <tr key={st.staffId} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-bold text-slate-800">{st.displayName}</td>
                        <td className="py-3 px-3 text-slate-600">{st.totalBookings}</td>
                        <td className="py-3 px-3 text-slate-600">{st.completedBookings}</td>
                        <td className="py-3 px-3 text-slate-600">{st.bookedMinutes}m</td>
                        <td className="py-3 px-3 font-bold text-emerald-600 text-right">
                          ${st.revenue}
                        </td>
                      </tr>
                    ))}
                    {byStaff.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                          No provider metrics recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
