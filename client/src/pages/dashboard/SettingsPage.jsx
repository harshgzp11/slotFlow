import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiRequest } from '../../lib/api.js';
import { Save, AlertCircle, CheckCircle2, Loader2, Building, ShieldCheck } from 'lucide-react';

export function SettingsPage() {
  const { activeBusiness, refreshAuth } = useAuth();

  const [name, setName] = useState(activeBusiness?.name || '');
  const [description, setDescription] = useState(activeBusiness?.description || '');
  const [timezone, setTimezone] = useState(activeBusiness?.timezone || 'UTC');
  const [currency, setCurrency] = useState(activeBusiness?.currency || 'USD');
  const [minNoticeHours, setMinNoticeHours] = useState(
    activeBusiness?.bookingPolicies?.minNoticeHours || 2
  );
  const [maxHorizonDays, setMaxHorizonDays] = useState(
    activeBusiness?.bookingPolicies?.maxHorizonDays || 30
  );
  const [cancelCutoffHours, setCancelCutoffHours] = useState(
    activeBusiness?.bookingPolicies?.cancelCutoffHours || 4
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest('/businesses/current', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          description,
          timezone,
          currency,
          bookingPolicies: {
            minNoticeHours: Number(minNoticeHours),
            maxHorizonDays: Number(maxHorizonDays),
            cancelCutoffHours: Number(cancelCutoffHours)
          }
        })
      });
      await refreshAuth();
      setSuccess('Settings updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workspace Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage workspace profile, scheduling policies, and business timezone.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Workspace Identity */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-base pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-indigo-600" />
            <span>Business Identity</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Public Slug (Handle)</label>
              <input
                type="text"
                disabled
                value={activeBusiness?.slug || ''}
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scheduling Policies */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-base pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Booking & Cancellation Policies</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Min Advance Notice
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min={0}
                  value={minNoticeHours}
                  onChange={(e) => setMinNoticeHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-xs text-slate-500 ml-2">hours</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Prevents last-minute bookings</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max Booking Horizon
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min={1}
                  value={maxHorizonDays}
                  onChange={(e) => setMaxHorizonDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-xs text-slate-500 ml-2">days</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Furthest date in advance</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cancellation Cutoff
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min={0}
                  value={cancelCutoffHours}
                  onChange={(e) => setCancelCutoffHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <span className="text-xs text-slate-500 ml-2">hours</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Time allowed before start to cancel</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
