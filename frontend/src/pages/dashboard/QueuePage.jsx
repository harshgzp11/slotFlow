import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.js';
import {
  Users,
  Clock,
  Plus,
  Phone,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
  Check,
  XCircle,
  Play
} from 'lucide-react';

export function QueuePage() {
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add Walk-in Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [ticketsRes, servicesRes, staffRes] = await Promise.all([
        apiRequest('/queue'),
        apiRequest('/services'),
        apiRequest('/staff')
      ]);

      setTickets(ticketsRes.data.tickets || []);
      setServices(servicesRes.data.services || []);
      setStaffList(staffRes.data.staff || []);

      if (servicesRes.data.services?.length > 0 && !selectedServiceId) {
        setSelectedServiceId(servicesRes.data.services[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load queue.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddWalkIn(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await apiRequest('/queue', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedServiceId,
          preferredStaffId: selectedStaffId || null,
          customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail || undefined
          },
          notes: notes || undefined
        })
      });

      setIsModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to add walk-in customer.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusTransition(ticketId, targetStatus) {
    setError(null);
    try {
      await apiRequest(`/queue/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus })
      });
      await loadData();
    } catch (err) {
      setError(err.message || `Failed to update status to ${targetStatus}`);
    }
  }

  const waitingTickets = tickets.filter((t) => t.status === 'WAITING');
  const calledTickets = tickets.filter((t) => t.status === 'CALLED');
  const inServiceTickets = tickets.filter((t) => t.status === 'IN_SERVICE');
  const completedTickets = tickets.filter((t) => t.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Walk-in Queue Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time walk-in intake, FIFO queue progression, and dynamic wait estimations.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Walk-In Customer</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Queue Columns Overview */}
      {isLoading ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Waiting In Line */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>Waiting in Lobby ({waitingTickets.length})</span>
              </div>
            </div>

            <div className="space-y-3">
              {waitingTickets.map((t) => (
                <div
                  key={t._id}
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] space-y-3 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-base font-black text-[#1e3a8a] bg-blue-50 px-2 py-0.5 rounded">
                        {t.ticketNumber}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1.5">{t.customer?.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{t.customer?.phone}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center space-x-1 text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>~{t.estimatedWaitMinutes}m wait</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="flex items-center space-x-1">
                      <Scissors className="w-3.5 h-3.5 text-[#1e3a8a]" />
                      <span>{t.serviceId?.name}</span>
                    </span>
                    <span className="text-slate-400">
                      {t.preferredStaffId?.displayName ? `Pref: ${t.preferredStaffId.displayName}` : 'Any Staff'}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => handleStatusTransition(t._id, 'NO_SHOW')}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 rounded font-medium"
                    >
                      No-Show
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusTransition(t._id, 'CALLED')}
                      className="px-3 py-1 bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium text-xs rounded-lg transition-colors flex items-center space-x-1 shadow-sm"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Call Next</span>
                    </button>
                  </div>
                </div>
              ))}

              {waitingTickets.length === 0 && (
                <div className="p-8 bg-white border border-dashed border-gray-200 rounded-2xl text-center text-xs text-gray-400 shadow-[0_4px_25px_rgba(0,0,0,0.05)]">
                  No customers currently waiting
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Called / Ready */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a]"></span>
                <span>Called & Arriving ({calledTickets.length})</span>
              </div>
            </div>

            <div className="space-y-3">
              {calledTickets.map((t) => (
                <div
                  key={t._id}
                  className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-[0_4px_25px_rgba(0,0,0,0.05)] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-base font-black text-[#1e3a8a] bg-blue-100 px-2 py-0.5 rounded">
                        {t.ticketNumber}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1.5">{t.customer?.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{t.customer?.phone}</p>
                    </div>

                    <span className="text-[11px] font-bold text-[#1e3a8a] bg-blue-100 px-2 py-0.5 rounded">
                      CALLED
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>{t.serviceId?.name}</span>
                    <span className="font-semibold text-emerald-600">${t.serviceId?.price}</span>
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => handleStatusTransition(t._id, 'NO_SHOW')}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 rounded font-medium"
                    >
                      No-Show
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusTransition(t._id, 'IN_SERVICE')}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1 shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Service</span>
                    </button>
                  </div>
                </div>
              ))}

              {calledTickets.length === 0 && (
                <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  No customers currently called
                </div>
              )}
            </div>
          </div>

          {/* Column 3: In Service & Completed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>In Service ({inServiceTickets.length})</span>
              </div>
            </div>

            <div className="space-y-3">
              {inServiceTickets.map((t) => (
                <div
                  key={t._id}
                  className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-base font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {t.ticketNumber}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1.5">{t.customer?.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{t.serviceId?.name}</p>
                    </div>

                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      IN SERVICE
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleStatusTransition(t._id, 'COMPLETED')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center space-x-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Complete Appointment</span>
                    </button>
                  </div>
                </div>
              ))}

              {inServiceTickets.length === 0 && (
                <div className="p-8 bg-white border border-dashed border-gray-200 rounded-2xl text-center text-xs text-gray-400 shadow-[0_4px_25px_rgba(0,0,0,0.05)]">
                  No customers currently in service
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Walk-in Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-light text-gray-800 tracking-tight">Add Walk-in Customer</h2>
            <p className="text-xs text-gray-500">
              Register a customer arrival at the front desk for immediate FIFO queue placement.
            </p>

            <form onSubmit={handleAddWalkIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Customer Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Marcus Aurelius"
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+1 (555) 987-6543"
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="marcus@example.com"
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Select Service</label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2 px-3 text-xs text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                >
                  {services.map((svc) => (
                    <option key={svc._id} value={svc._id}>
                      {svc.name} ({svc.durationMinutes}m - ${svc.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Preferred Specialist (Optional)
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2 px-3 text-xs text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                >
                  <option value="">Any Available Specialist</option>
                  {staffList.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add to Queue</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
