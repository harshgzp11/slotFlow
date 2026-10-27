import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.js';
import {
  Sparkles,
  User,
  Calendar,
  Clock,
  Filter,
  AlertCircle,
  Loader2,
  Play,
  CheckCircle2,
  Scissors,
  ArrowRight
} from 'lucide-react';

export function WaitlistPage() {
  const [entries, setEntries] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recovery engine trigger state
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [engineResult, setEngineResult] = useState(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      let queryParams = [];
      if (selectedStatus) queryParams.push(`status=${selectedStatus}`);
      if (selectedServiceId) queryParams.push(`serviceId=${selectedServiceId}`);
      const url = `/waitlist${queryParams.length > 0 ? `?${queryParams.join('&')}` : ''}`;

      const [waitlistRes, servicesRes] = await Promise.all([
        apiRequest(url),
        apiRequest('/services')
      ]);

      setEntries(waitlistRes.data.waitlistEntries || []);
      setServices(servicesRes.data.services || []);
    } catch (err) {
      setError(err.message || 'Failed to load waitlist entries.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedServiceId]);

  async function handleTriggerEngine() {
    setIsRunningEngine(true);
    setError(null);
    setEngineResult(null);
    try {
      const res = await apiRequest('/waitlist/trigger-recovery', {
        method: 'POST'
      });
      setEngineResult(res.message);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to trigger recovery engine.');
    } finally {
      setIsRunningEngine(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold mb-1 border border-amber-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Capacity Recovery Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Waitlist Roster</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Candidates queued for appointment openings when cancellations occur.
          </p>
        </div>

        <button
          onClick={handleTriggerEngine}
          disabled={isRunningEngine}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {isRunningEngine ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>Run Recovery Matcher</span>
        </button>
      </div>

      {engineResult && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{engineResult}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="WAITING">WAITING</option>
          <option value="OFFERED">OFFERED (Active Hold)</option>
          <option value="CONFIRMED">CONFIRMED (Recovered)</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <select
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">All Services</option>
          {services.map((svc) => (
            <option key={svc._id} value={svc._id}>
              {svc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Waitlist Table */}
      {isLoading ? (
        <div className="py-12 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 p-8">
          <Sparkles className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Waitlist Candidates</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Customers who join your public waitlist when slots are full will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Service & Provider</th>
                  <th className="py-3 px-4">Preferred Window</th>
                  <th className="py-3 px-4">Time Preference</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const start = new Date(entry.preferredDateRange?.startDate);
                  const end = new Date(entry.preferredDateRange?.endDate);
                  const isWaiting = entry.status === 'WAITING';
                  const isOffered = entry.status === 'OFFERED';
                  const isConfirmed = entry.status === 'CONFIRMED';

                  return (
                    <tr key={entry._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <p className="font-bold text-sm text-slate-800">{entry.customer?.name}</p>
                        <p className="text-slate-500">{entry.customer?.email}</p>
                        <p className="text-slate-400 text-[11px]">{entry.customer?.phone}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 flex items-center space-x-1">
                          <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{entry.serviceId?.name || 'Any Treatment'}</span>
                        </p>
                        <p className="text-slate-500 text-[11px]">
                          Specialist: {entry.preferredStaffId?.displayName || 'Any Available'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">
                          {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
                          {end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {entry.flexibleDays > 0 && (
                          <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                            ±{entry.flexibleDays}d flexibility
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700">
                          {entry.timeOfDayPreference}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-800">
                          {entry.priorityScore}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            isOffered
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 animate-pulse'
                              : isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isWaiting
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {entry.status}
                        </span>
                        {entry.offersCount > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {entry.offersCount} offer(s) sent
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
