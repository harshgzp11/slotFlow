import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.js';
import { Plus, Scissors, Clock, DollarSign, AlertCircle, Loader2, Check } from 'lucide-react';

export function ServicesPage() {
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(15);
  const [price, setPrice] = useState(50);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const [serviceRes, staffRes] = await Promise.all([
        apiRequest('/services'),
        apiRequest('/staff')
      ]);
      setServices(serviceRes.data.services || []);
      setStaff(staffRes.data.staff || []);
    } catch (err) {
      setError(err.message || 'Failed to load services.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenModal() {
    setName('');
    setDescription('');
    setDurationMinutes(30);
    setBufferBefore(0);
    setBufferAfter(15);
    setPrice(50);
    setSelectedStaffIds(staff.map((s) => s._id)); // default all staff
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiRequest('/services', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          durationMinutes: Number(durationMinutes),
          bufferBefore: Number(bufferBefore),
          bufferAfter: Number(bufferAfter),
          price: Number(price),
          qualifiedStaffIds: selectedStaffIds
        })
      });
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save service.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleStaff(id) {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Services & Treatments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure appointment services in 15-minute intervals with buffer times and qualified staff.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Service</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Services List */}
      {isLoading ? (
        <div className="py-12 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 p-8 shadow-[0_4px_25px_rgba(0,0,0,0.05)]">
          <Scissors className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-light text-gray-800">No Services Yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto mb-4">
            Add your first service to enable appointment availability generation on your booking page.
          </p>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Service</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service._id}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] flex flex-col justify-between hover:border-gray-200 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900 text-base">{service.name}</h3>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md text-sm">
                    ${service.price}
                  </span>
                </div>
                {service.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{service.description}</p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Duration:</span>
                  </span>
                  <span className="font-semibold text-slate-800">{service.durationMinutes} mins</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Buffers:</span>
                  <span className="font-medium text-slate-700">
                    {service.bufferBefore}m before / {service.bufferAfter}m after
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Qualified Staff:</span>
                  <span className="font-medium text-slate-700">
                    {service.qualifiedStaffIds?.length || 0} assigned
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-light text-gray-800 tracking-tight mb-1">Add New Service</h2>
            <p className="text-xs text-gray-500 mb-5">
              All durations and buffer intervals must be multiples of 15 minutes.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Signature Haircut & Styling"
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Includes consultation, precision cut, wash, and style."
                  className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Duration (Minutes)
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                  >
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins (1 hr)</option>
                    <option value={75}>75 mins</option>
                    <option value={90}>90 mins (1.5 hr)</option>
                    <option value={120}>120 mins (2 hr)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3.5 text-sm text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Buffer Before (Setup)
                  </label>
                  <select
                    value={bufferBefore}
                    onChange={(e) => setBufferBefore(Number(e.target.value))}
                    className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                  >
                    <option value={0}>0 mins</option>
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Buffer After (Cleanup)
                  </label>
                  <select
                    value={bufferAfter}
                    onChange={(e) => setBufferAfter(Number(e.target.value))}
                    className="w-full bg-[#f9fafb] border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none transition-all"
                  >
                    <option value={0}>0 mins</option>
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                  </select>
                </div>
              </div>

              {/* Staff Qualification selector */}
              {staff.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Qualified Staff Members
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2.5 bg-[#f9fafb]">
                    {staff.map((s) => {
                      const isSelected = selectedStaffIds.includes(s._id);
                      return (
                        <div
                          key={s._id}
                          onClick={() => toggleStaff(s._id)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${
                            isSelected ? 'bg-blue-50 text-[#1e3a8a] font-semibold' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{s.displayName}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#1e3a8a]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-sm text-white bg-[#1e3a8a] hover:bg-[#172554] font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Service</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
