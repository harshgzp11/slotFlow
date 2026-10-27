import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api.js';
import {
  Sparkles,
  Clock,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Scissors
} from 'lucide-react';

export function ClaimOfferPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [offer, setOffer] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Action states
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [confirmedBookingData, setConfirmedBookingData] = useState(null);
  const [declinedSuccess, setDeclinedSuccess] = useState(false);

  async function loadOffer() {
    if (!id || !token) {
      setError('A valid claim token is required to view this priority waitlist offer.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/public/offers/${id}?token=${token}`);
      setOffer(res.data.offer);
      setSecondsRemaining(res.data.secondsRemaining || 0);
    } catch (err) {
      setError(err.message || 'This offer is invalid or has already expired.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOffer();
  }, [id, token]);

  // Live countdown timer
  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining]);

  async function handleAccept() {
    setIsAccepting(true);
    setError(null);
    try {
      const res = await apiRequest(`/public/offers/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      setConfirmedBookingData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to accept offer. It may have expired or been claimed.');
    } finally {
      setIsAccepting(false);
    }
  }

  async function handleDecline() {
    setIsDeclining(true);
    setError(null);
    try {
      await apiRequest(`/public/offers/${id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      setDeclinedSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to decline offer.');
    } finally {
      setIsDeclining(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500">Checking slot reservation status...</p>
        </div>
      </div>
    );
  }

  if (error && !offer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Offer Expired or Unavailable</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go to SlotFlow Portal
          </Link>
        </div>
      </div>
    );
  }

  const startTime = new Date(offer.offeredInterval.startTimeUtc);
  const endTime = new Date(offer.offeredInterval.endTimeUtc);
  const minutesLeft = Math.floor(secondsRemaining / 60);
  const secondsLeft = secondsRemaining % 60;
  const isExpired = secondsRemaining === 0 || offer.status === 'EXPIRED';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>Priority Waitlist Recovery Opening</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            An Appointment Slot Just Opened Up!
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            A previously reserved appointment at <strong>{offer.businessId?.name}</strong> has been vacated and temporarily held for you.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Confirmed view */}
        {confirmedBookingData ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Offer Accepted & Booked!</h2>
              <p className="text-xs text-slate-500 mt-1">
                Your appointment has been atomically converted into a confirmed booking.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-left space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-bold text-slate-800">{offer.serviceId?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Provider:</span>
                <span className="font-bold text-slate-800">{offer.staffId?.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking ID:</span>
                <span className="font-mono font-bold text-indigo-600">{confirmedBookingData.booking?._id}</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={confirmedBookingData.manageUrl}
                className="inline-flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
              >
                <span>View / Manage Appointment</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : declinedSuccess ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Offer Declined</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You have declined this time slot. The hold has been released and offered to the next candidate in line.
            </p>
          </div>
        ) : (
          /* Active Offer Card */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            {/* Expiration Countdown Bar */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                isExpired
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-semibold">
                  {isExpired ? 'Offer has expired' : 'Exclusive Slot Hold Countdown:'}
                </span>
              </div>
              <div className="text-base font-black font-mono">
                {isExpired ? (
                  <span className="text-rose-600">00:00</span>
                ) : (
                  <span>
                    {String(minutesLeft).padStart(2, '0')}:{String(secondsLeft).padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            {/* Offer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 font-medium">Service</span>
                <p className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                  <Scissors className="w-4 h-4 text-indigo-600" />
                  <span>{offer.serviceId?.name}</span>
                </p>
                <p className="text-slate-500">{offer.offeredInterval.durationMinutes} minutes duration</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 font-medium">Specialist</span>
                <p className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>{offer.staffId?.displayName}</span>
                </p>
                <p className="text-slate-500">Qualified Provider</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 font-medium">Date & Time</span>
                <p className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>{startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </p>
                <p className="text-slate-500">
                  {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 font-medium">Price</span>
                <p className="font-bold text-emerald-600 text-sm">${offer.serviceId?.price}</p>
                <p className="text-slate-500">Due at arrival</p>
              </div>
            </div>

            {/* Hold protection notice */}
            <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>
                This slot is protected by an active hold. No public customer can book it while this timer is active.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleAccept}
                disabled={isAccepting || isDeclining || isExpired}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isAccepting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Accept & Confirm Appointment</span>
              </button>

              <button
                type="button"
                onClick={handleDecline}
                disabled={isAccepting || isDeclining || isExpired}
                className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
              >
                {isDeclining ? 'Releasing hold...' : 'Decline (Offer to next candidate)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
