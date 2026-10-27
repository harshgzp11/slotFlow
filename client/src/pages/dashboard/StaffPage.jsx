import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.js';
import { Plus, UserCheck, Clock, AlertCircle, Loader2, Check } from 'lucide-react';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function StaffPage() {
  const [staffList, setStaffList] = useState([]);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [weeklySchedule, setWeeklySchedule] = useState([
    { dayOfWeek: 0, isWorking: false, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] },
    { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
    { dayOfWeek: 2, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
    { dayOfWeek: 3, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
    { dayOfWeek: 4, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
    { dayOfWeek: 5, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
    { dayOfWeek: 6, isWorking: false, shiftStart: '10:00', shiftEnd: '16:00', breaks: [] }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const [staffRes, serviceRes] = await Promise.all([
        apiRequest('/staff'),
        apiRequest('/services')
      ]);
      setStaffList(staffRes.data.staff || []);
      setServices(serviceRes.data.services || []);
    } catch (err) {
      setError(err.message || 'Failed to load staff.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenModal() {
    setDisplayName('');
    setEmail('');
    setSelectedServiceIds(services.map((s) => s._id)); // default all services
    setIsModalOpen(true);
  }

  function handleDayToggle(dayIdx) {
    setWeeklySchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayIdx ? { ...d, isWorking: !d.isWorking } : d))
    );
  }

  function handleScheduleChange(dayIdx, field, val) {
    setWeeklySchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayIdx ? { ...d, [field]: val } : d))
    );
  }

  function toggleService(id) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiRequest('/staff', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          email: email || undefined,
          servicesOffered: selectedServiceIds,
          weeklySchedule
        })
      });
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save staff member.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff Team & Schedules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage provider shifts, lunch breaks, and treatment qualifications.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff List */}
      {isLoading ? (
        <div className="py-12 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 p-8">
          <UserCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Staff Members Yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            Add team members and define their weekly working hours so slots can be booked.
          </p>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Staff Provider</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((member) => (
            <div
              key={member._id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{member.displayName}</h3>
                    {member.email && <p className="text-xs text-slate-500">{member.email}</p>}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                    Active Provider
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Qualified Treatments
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {member.servicesOffered?.map((s) => (
                      <span
                        key={s._id}
                        className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                      >
                        {s.name}
                      </span>
                    ))}
                    {(!member.servicesOffered || member.servicesOffered.length === 0) && (
                      <span className="text-xs text-slate-400 italic">No services assigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Working Days:</span>
                </p>
                <div className="grid grid-cols-7 gap-1 text-center pt-1">
                  {member.weeklySchedule?.map((d) => (
                    <div
                      key={d.dayOfWeek}
                      className={`py-1 rounded text-[10px] font-bold ${
                        d.isWorking ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-400'
                      }`}
                      title={`${DAYS_OF_WEEK[d.dayOfWeek]}: ${d.isWorking ? `${d.shiftStart}-${d.shiftEnd}` : 'Off'}`}
                    >
                      {DAYS_OF_WEEK[d.dayOfWeek].substring(0, 1)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Add Staff Provider</h2>
            <p className="text-xs text-slate-500 mb-4">
              Configure working shifts and qualified treatments for this staff member.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Elena Rostova"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="elena@luxestudio.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Weekly Schedule Settings */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Weekly Schedule & Hours
                </label>
                <div className="space-y-2 border border-slate-200 rounded-lg p-3 max-h-52 overflow-y-auto">
                  {weeklySchedule.map((day) => (
                    <div
                      key={day.dayOfWeek}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0"
                    >
                      <label className="flex items-center space-x-2 w-28 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={day.isWorking}
                          onChange={() => handleDayToggle(day.dayOfWeek)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className={day.isWorking ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                          {DAYS_OF_WEEK[day.dayOfWeek]}
                        </span>
                      </label>

                      {day.isWorking ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="time"
                            value={day.shiftStart}
                            onChange={(e) =>
                              handleScheduleChange(day.dayOfWeek, 'shiftStart', e.target.value)
                            }
                            className="px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="time"
                            value={day.shiftEnd}
                            onChange={(e) =>
                              handleScheduleChange(day.dayOfWeek, 'shiftEnd', e.target.value)
                            }
                            className="px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Day Off</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Qualifications */}
              {services.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Qualified Treatments
                  </label>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2.5">
                    {services.map((s) => {
                      const isSelected = selectedServiceIds.includes(s._id);
                      return (
                        <div
                          key={s._id}
                          onClick={() => toggleService(s._id)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors ${
                            isSelected ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{s.name} ({s.durationMinutes}m)</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
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
                  className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Provider</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
