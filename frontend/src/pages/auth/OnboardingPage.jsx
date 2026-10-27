import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Building2, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export const OnboardingPage = () => {
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [currency, setCurrency] = useState('USD');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNameChange(val) {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await apiRequest('/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name,
          slug,
          timezone,
          currency,
          description
        })
      });

      if (res.success) {
        await refreshAuth();
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to create workspace.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-[#1e3a8a] flex items-center justify-center text-white mx-auto shadow-sm">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-2xl font-light text-gray-800 tracking-tight">
          Set Up Your Business Workspace
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          This will be the home for your services, staff, appointments, and waitlist
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-gray-100 p-8 sm:p-10">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-2 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Luxe Hair & Spa Studio"
                className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Public Booking Slug (URL)
              </label>
              <div className="flex items-center rounded-lg border border-gray-200 bg-[#f9fafb] focus-within:bg-white focus-within:border-[#1e3a8a] focus-within:ring-1 focus-within:ring-[#1e3a8a] overflow-hidden transition-all">
                <span className="bg-gray-100 text-gray-500 px-3 py-2 text-xs font-mono border-r border-gray-200">
                  /book/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="luxe-studio"
                  className="w-full px-3 py-2 bg-transparent focus:outline-none text-sm font-mono text-gray-900"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Customers will book via: slotflow.app/book/{slug || 'your-slug'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="High-end salon providing precision cuts, color treatments, and styling."
                className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium rounded-lg text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  <span>Launch Workspace</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
