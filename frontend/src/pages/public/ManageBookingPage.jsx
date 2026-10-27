import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api.js';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ShieldAlert,
  ArrowLeft,
  Scissors
} from 'lucide-react';

export function ManageBookingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cancellation modal & state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState(null);

  async function loadBooking() {
    if (!id || !token) {
      setError('A valid appointment management token is required to view this booking.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/public/bookings/${id}/manage?token=${token}`);
      setBooking(res.data.booking);
    } catch (err) {
      setError(err.message || 'Failed to load booking. The link may have expired or is invalid.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBooking();
  }, [id, token]);

  async function handleCancelBooking(e) {
    e.preventDefault();
    setIsCancelling(true);
    setError(null);

    try {
      const res = await apiRequest(`/public/bookings/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          token,
          reason: cancelReason || 'Customer requested cancellation via portal'
        })
      });

      setCancelSuccessMsg(res.message || 'Your appointment was cancelled and the slot was released.');
      setIsCancelModalOpen(false);
      await loadBooking();
    } catch (err) {
      setError(err.message || 'Failed to cancel appointment.');
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Return to SlotFlow
          </Link>
        </div>
      </div>
    );
  }

  const startTime = new Date(booking.startTimeUtc);
  const endTime = new Date(booking.endTimeUtc);
  const isCancelled = booking.status === 'CANCELLED';
  const isConfirmed = booking.status === 'CONFIRMED';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
          <Link
            to={`/book/${booking.businessId?.slug}`}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Visit {booking.businessId?.name} Booking Page</span>
          </Link>
          <span className="text-xs text-slate-400">Appointment Management Portal</span>
        </div>

        {cancelSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{cancelSuccessMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Booking Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{booking.businessId?.name}</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    isCancelled
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : isConfirmed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {booking.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Confirmation ID: <span className="font-mono text-slate-700">{booking._id}</span>
              </p>
            </div>

            <div className="text-right">
              <span className="text-lg font-bold text-slate-900">${booking.totalPrice}</span>
              <p className="text-[10px] text-slate-400">Due at arrival</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium">Service</span>
              <p className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <Scissors className="w-4 h-4 text-indigo-600" />
                <span>{booking.serviceId?.name || 'Selected Service'}</span>
              </p>
              <p className="text-slate-500">
                Duration: {booking.durationMinutesSnapshot || booking.serviceId?.durationMinutes} mins
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium">Assigned Specialist</span>
              <p className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                <span>{booking.staffId?.displayName || 'Assigned Staff'}</span>
              </p>
              <p className="text-slate-500">{booking.staffId?.email || 'Dedicated Provider'}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium">Date & Time</span>
              <p className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>{startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </p>
              <p className="text-slate-500">
                {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium">Customer Information</span>
              <p className="font-bold text-slate-800 text-sm">{booking.customer?.name}</p>
              <p className="text-slate-500">
                {booking.customer?.email} • {booking.customer?.phone}
              </p>
            </div>
          </div>

          {/* Cancellation section */}
          {isConfirmed && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Need to change plans? You can cancel your appointment online.
              </p>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel Appointment
              </button>
            </div>
          )}

          {isCancelled && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold text-sm">Appointment Cancelled</p>
              <p>This booking has been cancelled and its time slot was returned to available capacity.</p>
              {booking.cancellationReason && (
                <p className="text-rose-600 italic">Reason: {booking.cancellationReason}</p>
              )}
            </div>
          )}
        </div>

        {/* Cancellation Confirmation Modal */}
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Cancel Appointment?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to cancel your appointment? Your reserved time will be released immediately.
                </p>
              </div>

              <form onSubmit={handleCancelBooking} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Reason for Cancellation (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Schedule conflict, feeling unwell, etc."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Keep Appointment
                  </button>
                  <button
                    type="submit"
                    disabled={isCancelling}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {isCancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Cancellation</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
