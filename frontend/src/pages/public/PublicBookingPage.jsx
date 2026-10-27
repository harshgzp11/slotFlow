import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api.js';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Phone,
  Mail,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export function PublicBookingPage() {
  const { slug } = useParams();

  // Workspace Catalog State
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [error, setError] = useState(null);

  // Booking Flow Steps: 1: Service, 2: Provider, 3: Date & Slot, 4: Customer Details, 5: Confirmed
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null); // null means "Any Available"
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    // Default tomorrow or today
    return today.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBookingData, setConfirmedBookingData] = useState(null);

  // Load business data
  useEffect(() => {
    async function loadCatalog() {
      setLoadingBusiness(true);
      setError(null);
      try {
        const res = await apiRequest(`/public/businesses/${slug}`);
        setBusiness(res.data.business);
        setServices(res.data.services || []);
        setStaffList(res.data.staff || []);
      } catch (err) {
        setError(err.message || 'Business workspace not found.');
      } finally {
        setLoadingBusiness(false);
      }
    }
    if (slug) {
      loadCatalog();
    }
  }, [slug]);

  // Load slots when service, date, or staff changes
  useEffect(() => {
    async function fetchSlots() {
      if (!selectedService || !selectedDate || !slug) return;
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        let url = `/public/availability?slug=${slug}&serviceId=${selectedService._id}&date=${selectedDate}`;
        if (selectedStaff) {
          url += `&staffId=${selectedStaff._id}`;
        }
        const res = await apiRequest(url);
        setAvailableSlots(res.data.slots || []);
      } catch (err) {
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    if (step === 3) {
      fetchSlots();
    }
  }, [step, selectedService, selectedDate, selectedStaff, slug]);

  function handleSelectService(service) {
    setSelectedService(service);
    setSelectedStaff(null);
    setStep(2);
  }

  function handleSelectStaff(staff) {
    setSelectedStaff(staff);
    setStep(3);
  }

  function handleSelectSlot(slot) {
    setSelectedSlot(slot);
  }

  async function handleConfirmBooking(e) {
    e.preventDefault();
    if (!selectedSlot || !selectedService) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiRequest('/public/bookings', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          serviceId: selectedService._id,
          staffId: selectedSlot.staffId,
          startTimeUtc: selectedSlot.startTimeUtc,
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone
          }
        })
      });

      setConfirmedBookingData(res.data);
      setStep(5);
    } catch (err) {
      setError(err.message || 'The selected slot is no longer available. Please select another slot.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadingBusiness) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
          <p className="text-sm font-medium text-slate-500">Loading appointment portal...</p>
        </div>
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-gray-100 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-light text-gray-800 tracking-tight mb-2">Workspace Unavailable</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-flex items-center px-4 py-2.5 bg-[#1e3a8a] text-white rounded-lg text-sm font-medium hover:bg-[#172554] transition-colors shadow-sm"
          >
            Go to SlotFlow Portal
          </Link>
        </div>
      </div>
    );
  }

  // Filter staff qualified for the selected service
  const qualifiedStaff = selectedService
    ? staffList.filter(
        (s) =>
          !selectedService.qualifiedStaffIds ||
          selectedService.qualifiedStaffIds.length === 0 ||
          selectedService.qualifiedStaffIds.includes(s._id)
      )
    : staffList;

  return (
    <div className="min-h-screen bg-[#f3f4f6] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Business Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#1e3a8a] text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Verified SlotFlow Provider</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                {business?.name}
              </h1>
              {business?.description && (
                <p className="text-sm text-gray-500 mt-1 max-w-xl">{business.description}</p>
              )}
            </div>

            <div className="text-left sm:text-right text-xs text-gray-500 space-y-1">
              <p>
                Timezone: <span className="font-semibold text-gray-700">{business?.timezone}</span>
              </p>
              <p>
                Currency: <span className="font-semibold text-gray-700">{business?.currency}</span>
              </p>
            </div>
          </div>

          {/* Stepper indicator (if not finished) */}
          {step < 5 && (
            <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between text-xs font-medium text-gray-400">
              <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-[#1e3a8a] font-bold' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= 1 ? 'border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]' : 'border-gray-200'}`}>1</span>
                <span>Service</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
              <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-[#1e3a8a] font-bold' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= 2 ? 'border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]' : 'border-gray-200'}`}>2</span>
                <span>Specialist</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
              <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-[#1e3a8a] font-bold' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= 3 ? 'border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]' : 'border-gray-200'}`}>3</span>
                <span>Time Slot</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
              <div className={`flex items-center space-x-2 ${step >= 4 ? 'text-[#1e3a8a] font-bold' : ''}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= 4 ? 'border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]' : 'border-gray-200'}`}>4</span>
                <span>Details</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: SELECT SERVICE */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Select a Treatment or Service</h2>
            <div className="grid grid-cols-1 gap-3">
              {services.map((svc) => (
                <div
                  key={svc._id}
                  onClick={() => handleSelectService(svc)}
                  className="p-5 rounded-xl border border-gray-100 hover:border-[#1e3a8a] hover:bg-blue-50/20 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 group-hover:text-[#1e3a8a] text-base">
                      {svc.name}
                    </h3>
                    {svc.description && <p className="text-xs text-gray-500">{svc.description}</p>}
                    <div className="flex items-center space-x-3 text-xs text-gray-500 pt-1">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{svc.durationMinutes} mins</span>
                      </span>
                      {svc.bufferAfter > 0 && (
                        <span>• +{svc.bufferAfter}m sanitized interval</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="text-base font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">
                      ${svc.price}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#1e3a8a] transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: SELECT SPECIALIST */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center space-x-1 text-xs font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Services</span>
              </button>
              <div className="text-xs text-gray-600 font-medium">
                Service: <span className="text-[#1e3a8a] font-bold">{selectedService?.name}</span>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900">Choose a Provider</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option: Any Available */}
              <div
                onClick={() => handleSelectStaff(null)}
                className="p-4 rounded-xl border border-gray-100 hover:border-[#1e3a8a] hover:bg-blue-50/20 cursor-pointer transition-all flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold text-sm group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 group-hover:text-[#1e3a8a]">
                    Any Available Provider
                  </h3>
                  <p className="text-xs text-gray-500">Maximum schedule flexibility</p>
                </div>
              </div>

              {/* Staff specific */}
              {qualifiedStaff.map((st) => (
                <div
                  key={st._id}
                  onClick={() => handleSelectStaff(st)}
                  className="p-4 rounded-xl border border-gray-100 hover:border-[#1e3a8a] hover:bg-blue-50/20 cursor-pointer transition-all flex items-center space-x-3 group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 group-hover:text-[#1e3a8a]">
                      {st.displayName}
                    </h3>
                    <p className="text-xs text-gray-500">Specialist Provider</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: DATE & TIME SLOT PICKER */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center space-x-1 text-xs font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Specialist Selection</span>
              </button>
              <div className="text-xs text-gray-600">
                <span className="font-medium">{selectedService?.name}</span> •{' '}
                <span className="text-[#1e3a8a] font-bold">
                  {selectedStaff ? selectedStaff.displayName : 'Any Specialist'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 bg-[#f9fafb] border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">Available Start Times</h3>
                <span className="text-xs text-gray-400">15-minute precision intervals</span>
              </div>

              {loadingSlots ? (
                <div className="py-12 flex justify-center text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin text-[#1e3a8a]" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200 p-6">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-light text-gray-800 text-sm">No Available Openings</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    All slots for this provider on {selectedDate} are currently reserved or outside operating hours.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  {availableSlots.map((slot, idx) => {
                    const isSelected =
                      selectedSlot && selectedSlot.startTimeUtc === slot.startTimeUtc;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all ${
                          isSelected
                            ? 'bg-[#1e3a8a] text-white shadow-sm ring-2 ring-[#1e3a8a] ring-offset-1'
                            : 'bg-white border border-gray-200 text-gray-700 hover:border-[#1e3a8a] hover:bg-blue-50/30'
                        }`}
                      >
                        {slot.displayTime || slot.localStartTime}
                        {slot.staffName && !selectedStaff && (
                          <div className="text-[10px] font-normal opacity-80 truncate">
                            {slot.staffName}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSlot && (
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
                >
                  <span>Continue to Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: CUSTOMER DETAILS */}
        {step === 4 && (
          <div className="bg-white rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-gray-100 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Time Selection</span>
              </button>
            </div>

            {/* Appointment Summary Box */}
            <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 text-xs text-[#172554] space-y-1.5">
              <p className="font-bold text-sm text-[#1e3a8a]">{selectedService?.name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-blue-900">
                <span>Date: <strong>{selectedDate}</strong></span>
                <span>Time: <strong>{selectedSlot?.displayTime || selectedSlot?.localStartTime}</strong></span>
                <span>Duration: <strong>{selectedService?.durationMinutes} mins</strong></span>
                <span>Price: <strong>${selectedService?.price}</strong></span>
              </div>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <h2 className="text-base font-bold text-gray-900">Your Contact Information</h2>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Jessica Vance"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#f9fafb] border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="jessica@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#f9fafb] border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#f9fafb] border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Total due at visit: <strong className="text-gray-900 font-bold">${selectedService?.price}</strong>
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Book Appointment</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 5: CONFIRMATION SUCCESS */}
        {step === 5 && confirmedBookingData && (
          <div className="bg-white rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.05)] border border-gray-100 p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Appointment Confirmed!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Your booking has been registered and verified in the schedule.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200/80 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">Service:</span>
                <span className="font-bold text-gray-800">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">Date:</span>
                <span className="font-bold text-gray-800">{selectedDate}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">Start Time:</span>
                <span className="font-bold text-gray-800">{selectedSlot?.displayTime || selectedSlot?.localStartTime}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-800">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Confirmation ID:</span>
                <span className="font-mono font-bold text-[#1e3a8a]">
                  {confirmedBookingData.booking?._id}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3 pt-2">
              <a
                href={`/appointments/${confirmedBookingData.booking?._id}/manage?token=${confirmedBookingData.manageToken}`}
                className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#1e3a8a] hover:bg-[#172554] text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
              >
                <span>Manage or Reschedule Booking</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setSelectedService(null);
                    setSelectedSlot(null);
                    setConfirmedBookingData(null);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-800 underline transition-colors"
                >
                  Book another appointment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
