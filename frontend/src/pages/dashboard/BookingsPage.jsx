import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.js';
import {
  Calendar,
  Clock,
  User,
  Search,
  Filter,
  AlertCircle,
  Loader2,
  XCircle,
  Scissors,
  CheckCircle2,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

export function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Cancel modal
  const [cancelBookingId, setCancelBookingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      let queryParams = [];
      if (selectedDate) queryParams.push(`date=${selectedDate}`);
      if (selectedStaffId) queryParams.push(`staffId=${selectedStaffId}`);
      if (selectedStatus) queryParams.push(`status=${selectedStatus}`);
      if (searchQuery) queryParams.push(`search=${encodeURIComponent(searchQuery)}`);

      const url = `/bookings${queryParams.length > 0 ? `?${queryParams.join('&')}` : ''}`;

      const [bookingsRes, staffRes] = await Promise.all([
        apiRequest(url),
        apiRequest('/staff')
      ]);

      setBookings(bookingsRes.data.bookings || []);
      setStaffList(staffRes.data.staff || []);
    } catch (err) {
      setError(err.message || 'Failed to load bookings.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedStaffId, selectedStatus]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadData();
  }

  async function handleConfirmCancel(e) {
    e.preventDefault();
    if (!cancelBookingId) return;

    setIsCancelling(true);
    setError(null);
    try {
      await apiRequest(`/bookings/${cancelBookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason || 'Cancelled by staff member' })
      });
      setCancelBookingId(null);
      setCancelReason('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to cancel booking.');
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleUpdateStatus(bookingId, targetStatus) {
    setError(null);
    try {
      await apiRequest(`/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus })
      });
      await loadData();
    } catch (err) {
      setError(err.message || `Failed to update status to ${targetStatus}`);
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Appointment Bookings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage confirmed reservations, atomic 15-minute slot allocations, and customer details.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, email..."
              className="w-full pl-9 pr-3 py-2 bg-[#f9fafb] border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
            />
          </form>

          {/* Date Picker */}
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#f9fafb] border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
            />
          </div>

          {/* Staff Filter */}
          <div>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 bg-[#f9fafb] border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
            >
              <option value="">All Staff Providers</option>
              {staffList.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#f9fafb] border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="CHECKED_IN">CHECKED_IN</option>
              <option value="IN_SERVICE">IN_SERVICE</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>
        </div>

        {(selectedDate || selectedStaffId || selectedStatus || searchQuery) && (
          <div className="flex items-center space-x-2 text-xs text-[#1e3a8a] font-semibold pt-1">
            <button
              onClick={() => {
                setSelectedDate('');
                setSelectedStaffId('');
                setSelectedStatus('');
                setSearchQuery('');
              }}
              className="hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Bookings Table / List */}
      {isLoading ? (
        <div className="py-12 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 p-8 shadow-[0_4px_25px_rgba(0,0,0,0.05)]">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-light text-gray-800">No Bookings Found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            No appointments match the selected filter criteria. Customers can book online through your public link.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Service & Provider</th>
                  <th className="py-3 px-4">Appointment Time</th>
                  <th className="py-3 px-4">Reservation Snapshot</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => {
                  const start = new Date(b.startTimeUtc);
                  const end = new Date(b.endTimeUtc);
                  const isConfirmed = b.status === 'CONFIRMED';
                  const isCancelled = b.status === 'CANCELLED';

                  return (
                    <tr key={b._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <p className="font-bold text-sm text-slate-800">{b.customer?.name}</p>
                        <p className="text-slate-500">{b.customer?.email}</p>
                        <p className="text-slate-400 text-[11px]">{b.customer?.phone}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 text-xs flex items-center space-x-1">
                          <Scissors className="w-3.5 h-3.5 text-[#1e3a8a]" />
                          <span>{b.serviceId?.name || 'Service'}</span>
                        </p>
                        <p className="text-slate-500 mt-0.5 flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{b.staffId?.displayName || 'Assigned Staff'}</span>
                        </p>
                        <span className="font-bold text-emerald-600 text-[11px]">${b.totalPrice}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">
                          {start.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-slate-500">
                          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-[11px] text-slate-600">
                        <div className="inline-block bg-slate-100 rounded-lg px-2.5 py-1 space-y-0.5">
                          <p>
                            Duration: <strong>{b.durationMinutesSnapshot}m</strong>
                          </p>
                          <p>
                            Cells: <strong>{b.reservationCellCountSnapshot}</strong> (15m each)
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Buffers: {b.bufferBeforeSnapshot}m pre / {b.bufferAfterSnapshot}m post
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isCancelled
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {b.status === 'CONFIRMED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(b._id, 'CHECKED_IN')}
                                className="px-2 py-0.5 text-[11px] bg-blue-50 text-[#1e3a8a] hover:bg-blue-100 rounded font-bold border border-blue-200 transition-colors"
                              >
                                Check In
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(b._id, 'NO_SHOW')}
                                className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded font-semibold transition-colors"
                              >
                                No-Show
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelBookingId(b._id)}
                                className="px-2 py-0.5 text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded font-semibold border border-rose-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {b.status === 'CHECKED_IN' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(b._id, 'IN_SERVICE')}
                              className="px-2.5 py-0.5 text-[11px] bg-amber-50 text-amber-800 hover:bg-amber-100 rounded font-bold border border-amber-300 transition-colors"
                            >
                              Start Service
                            </button>
                          )}

                          {b.status === 'IN_SERVICE' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(b._id, 'COMPLETED')}
                              className="px-2.5 py-0.5 text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-bold border border-emerald-300 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelBookingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Cancel Appointment?</h3>
              <p className="text-xs text-slate-500 mt-1">
                The booking's 15-minute slot reservations will be atomically transferred to recovery holds for waitlist candidates.
              </p>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cancellation Reason (Optional)
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Staff emergency, customer requested change, etc."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelBookingId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isCancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Cancel Booking</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
