"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, ScheduleSlot, Attendance as AttendanceType, Coach } from '../lib/db';
import { logAttendance, syncDatabaseToClient, toggleSummerCampSlot } from '../app/actions';

interface AttendanceProps {
  currentUser: User;
  activeCentre: string;
  onQueueChange: () => void;
}

export const Attendance: React.FC<AttendanceProps> = ({
  currentUser,
  activeCentre,
  onQueueChange,
}) => {
  const getDefaultDuration = (slot: ScheduleSlot) => {
    if (slot.is_summer_camp) return 1;
    const isWeekend = slot.day === 'Sat' || slot.day === 'Sun';
    return isWeekend ? 2 : 1;
  };

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [selectedCentre, setSelectedCentre] = useState<string>('All');
  const [expandedSlots, setExpandedSlots] = useState<{ [slotId: string]: boolean }>({});
  
  // Local markings state to dynamically update counters
  const [markings, setMarkings] = useState<{ [key: string]: 'present' | 'absent' | 'makeup' | null }>({});
  const [billedHours, setBilledHours] = useState<Record<string, number>>({});
  const [classTopic, setClassTopic] = useState<string>('Opening principles');
  const [isOnline, setIsOnline] = useState<boolean>(db.isOnline());
  const [saveStatus, setSaveStatus] = useState<string>('');

  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<AttendanceType[]>([]);

  const loadData = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setSlots(db.getScheduleSlots());
    setCentres(db.getCentres());
    setAttendance(db.getAttendance());

    const coas = db.getCoaches();
    if (coas.length > 0 && !selectedCoachId) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('mmos_selected_coach_id') : null;
      if (stored && coas.some(c => c.id === stored)) {
        setSelectedCoachId(stored);
      } else {
        const self = coas.find(c => c.user_id === currentUser.id);
        const james = coas.find(c => c.name.toUpperCase().includes('JAMES'));
        setSelectedCoachId(self ? self.id : (james ? james.id : coas[0].id));
      }
    }
  };

  useEffect(() => {
    loadData();
    syncDatabaseToClient()
      .then((data) => {
        db.syncFromNeon(data);
        loadData();
      })
      .catch((e) => console.error("Failed to sync on mount:", e));

    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, [selectedCoachId]);

  // Load markings and billed hours from database attendance records for the selected date
  useEffect(() => {
    const initialMarkings: { [key: string]: 'present' | 'absent' | 'makeup' | null } = {};
    const initialBilledHours: Record<string, number> = {};
    attendance.forEach(a => {
      if (!a.date || !a.slot_id || !a.student_id) return;
      const d = new Date(a.date);
      const isoDate = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      const localDate = !isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
      const isDateMatch = isoDate === selectedDate || localDate === selectedDate || (typeof a.date === 'string' && a.date.includes(selectedDate));

      if (isDateMatch) {
        const key = `${a.slot_id}-${a.student_id}`;
        initialMarkings[key] = a.status as 'present' | 'absent' | 'makeup';
        const slot = slots.find(s => s.id === a.slot_id);
        initialBilledHours[key] = (a as any).duration ?? (slot ? getDefaultDuration(slot) : 1);
      }
    });
    setMarkings(initialMarkings);
    setBilledHours(initialBilledHours);
  }, [selectedDate, attendance]);

  useEffect(() => {
    if (activeCentre) {
      setSelectedCentre(activeCentre);
    }
  }, [activeCentre]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeCoachId = useMemo(() => {
    if (currentUser.role === 'coach') {
      const coach = coaches.find(c => c.user_id === currentUser.id);
      return coach ? coach.id : '';
    }
    return selectedCoachId;
  }, [currentUser, coaches, selectedCoachId]);

  const activeCoach = coaches.find(c => c.id === activeCoachId);

  // Get Day of week from selected date
  const dayOfWeek = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(selectedDate);
    return days[d.getDay()];
  }, [selectedDate]);

  // Format date for subtext (e.g. Monday 13 July 2026)
  const formattedDateText = useMemo(() => {
    const d = new Date(selectedDate);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString('en-GB', options);
  }, [selectedDate]);

  // Normalize short vs long day names
  const normalizeDay = (day: string) => {
    if (!day) return 'Monday';
    const map: { [k: string]: string } = {
      'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday',
      'Monday': 'Monday', 'Tuesday': 'Tuesday', 'Wednesday': 'Wednesday', 'Thursday': 'Thursday', 'Friday': 'Friday', 'Saturday': 'Saturday', 'Sunday': 'Sunday'
    };
    return map[day] || day;
  };

  // Filter slots by selected coach, centre, and day of selectedDate
  const activeDaySlots = useMemo(() => {
    return slots.filter(s => {
      if (s.coach_id !== activeCoachId) return false;
      if (normalizeDay(s.day) !== normalizeDay(dayOfWeek)) return false;
      if (selectedCentre !== 'All' && s.centre_id !== selectedCentre) return false;
      return true;
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [slots, activeCoachId, selectedCentre, dayOfWeek]);

  // Auto-expand first slot
  useEffect(() => {
    if (activeDaySlots.length > 0) {
      setExpandedSlots({ [activeDaySlots[0].id]: true });
    } else {
      setExpandedSlots({});
    }
  }, [selectedCoachId, activeDaySlots]);

  // Check if a student is zero-balance
  const isZeroBalance = (studentId: string) => {
    const studentPkgs = packages.filter(p => p.student_id === studentId);
    if (studentPkgs.length === 0) return true;
    return studentPkgs.every(p => p.classes_remaining === 0);
  };

  // Roster logic per slot: uses explicit enrollments if present, else level filter
  const getSlotRoster = (slot: ScheduleSlot) => {
    const enrollments = db.getEnrollments ? db.getEnrollments() : [];
    const slotEnrollments = enrollments.filter(e => e.slot_id === slot.id);
    if (slotEnrollments.length > 0) {
      const enrolledIds = new Set(slotEnrollments.map(e => e.student_id));
      return students.filter(s => enrolledIds.has(s.id));
    }
    return students.filter(s => 
      s.centre_id === slot.centre_id && 
      s.level === slot.level && 
      s.status === 'active' &&
      s.coach_id === slot.coach_id
    );
  };

  const getCentreName = (centreId: string) => {
    const match = centres.find(c => c.id === centreId);
    return match ? match.name : (centreId === 'c-2' || centreId === 'JLT' ? 'JLT' : 'Bay Avenue');
  };

  const handleMarkStatus = (slotId: string, studentId: string, status: 'present' | 'absent' | 'makeup') => {
    const key = `${slotId}-${studentId}`;
    const newStatus = markings[key] === status ? null : status;
    
    setMarkings(prev => ({
      ...prev,
      [key]: newStatus
    }));

    if (newStatus === null || newStatus === 'absent') {
      setBilledHours(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleSaveAttendance = async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;

    const slotMarkings = Object.keys(markings).filter(key => key.startsWith(slotId) && markings[key] !== null);
    // Date floor validation: ensure attendance date is not prior to student's join date
    for (const key of slotMarkings) {
      const studentId = key.substring(slotId.length + 1);
      const student = students.find(s => s.id === studentId);
      if (student && student.join_date) {
        const joinDate = new Date(student.join_date);
        joinDate.setHours(0, 0, 0, 0);
        const attDate = new Date(selectedDate);
        attDate.setHours(0, 0, 0, 0);
        if (attDate < joinDate) {
          const dateStr = typeof student.join_date === 'string' ? student.join_date.split('T')[0] : new Date(student.join_date).toISOString().split('T')[0];
          setSaveStatus(`❌ Error: Cannot back-date class for ${student.name} before their join date (${dateStr}).`);
          setTimeout(() => setSaveStatus(''), 5000);
          return;
        }
      }
    }

    setSaveStatus('Saving attendance...');
    let savedCount = 0;
    let queuedCount = 0;

    try {
      for (const key of slotMarkings) {
        const studentId = key.substring(slotId.length + 1);
        const status = markings[key];
        if (!status) continue;

        const duration = billedHours[key] ?? getDefaultDuration(slot);
        const record: AttendanceType = {
          id: `att-${slot.id}-${studentId}-${selectedDate}`,
          student_id: studentId,
          slot_id: slot.id,
          coach_id: slot.coach_id,
          date: selectedDate,
          status: status,
          topic: classTopic,
          note: '',
          duration: duration,
          created_at: new Date().toISOString(),
        };

        if (isOnline) {
          db.processAttendanceRecord(record);
          await logAttendance(record.student_id, record.status, record.coach_id, record.slot_id || undefined, duration, selectedDate);
          savedCount++;
        } else {
          db.addToOfflineQueue(record);
          queuedCount++;
        }
      }

      // Sync updated package balances back from Neon
      if (isOnline && savedCount > 0) {
        try {
          const freshData = await syncDatabaseToClient();
          db.syncFromNeon(freshData);
          loadData();
        } catch (syncErr) {
          console.warn("Sync failed:", syncErr);
          setSaveStatus(`✓ Saved to database: ${savedCount} student${savedCount > 1 ? 's' : ''} recorded. (Sync warning: local database will refresh on next reload).`);
          onQueueChange();
          return;
        }
      }

      onQueueChange();

      if (savedCount > 0) {
        setSaveStatus(`✓ Saved to database: ${savedCount} student${savedCount > 1 ? 's' : ''} recorded.`);
      } else if (queuedCount > 0) {
        setSaveStatus(`☁ Offline. Queued ${queuedCount} attendance records for later sync.`);
      }
    } catch (err: any) {
      setSaveStatus('❌ Error saving to database: ' + err.message);
    } finally {
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start pb-2">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase font-display">INPUT</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Attendance Entry</h1>
        </div>

        <div className="flex items-center gap-3">
          {isOnline ? (
            <span className="text-[9px] font-bold px-3 py-1.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800">
              ● Connected Online
            </span>
          ) : (
            <span className="text-[9px] font-bold px-3 py-1.5 rounded-full border bg-red-50 border-red-200 text-hot-custom">
              ☁ Offline Mode (Queued)
            </span>
          )}

          <select 
            value={selectedCentre}
            onChange={e => setSelectedCentre(e.target.value)}
            className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none cursor-pointer"
          >
            <option value="All">All centres</option>
            {centres.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date & Coach selector filter row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface border border-line rounded-xl p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-custom uppercase">Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-white border border-line rounded-lg px-2 py-1 text-xs text-ink outline-none cursor-pointer"
            />
          </div>
          {(currentUser.role === 'owner' || currentUser.role === 'front_desk') && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-custom uppercase">COACH</span>
              <select 
                value={selectedCoachId} 
                onChange={e => { setSelectedCoachId(e.target.value); localStorage.setItem('mmos_selected_coach_id', e.target.value); }}
                className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none w-48 cursor-pointer"
              >
                {coaches.map(c => (
                  <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-custom font-semibold">
          {formattedDateText} · {activeCoach?.name} · {getCentreName(selectedCentre)}
        </div>
      </div>

      <p className="text-xs text-muted-custom">
        {formattedDateText} · {activeCoach?.name.toUpperCase()} · {getCentreName(selectedCentre)} · {activeDaySlots.length} class{activeDaySlots.length !== 1 ? 'es' : ''} today
      </p>

      {saveStatus && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${
          saveStatus.startsWith('❌') 
            ? 'bg-red-50 border-red-200 text-hot-custom' 
            : saveStatus === 'Saving attendance...'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {saveStatus}
        </div>
      )}

      {/* Roster Cards List */}
      <div className="space-y-4">
        {activeDaySlots.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-line rounded-2xl text-muted-custom text-xs">
            No class slots scheduled under {activeCoach?.name} for {dayOfWeek} ({formattedDateText}).
          </div>
        ) : (
          activeDaySlots.map(slot => {
            const roster = getSlotRoster(slot);
            const isExpanded = expandedSlots[slot.id] || false;
            const zeroBalCount = roster.filter(s => isZeroBalance(s.id)).length;

            return (
              <div key={slot.id} className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm">
                
                {/* Slot Summary Header Row */}
                <div 
                  onClick={() => setExpandedSlots(prev => ({ ...prev, [slot.id]: !isExpanded }))}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-canvas/20 transition-colors select-none"
                >
                  <div className="flex items-center gap-6">
                    <span className="font-mono font-bold text-sm text-ink">{slot.time}</span>
                    <div>
                      <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                        {slot.level || 'Unassigned level'}
                        {slot.is_summer_camp && (
                          <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            ☀️ Summer Camp
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-muted-custom mt-0.5">
                        {getCentreName(slot.centre_id)} · {roster.length} student{roster.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-custom font-mono">
                      {roster.length} expected · {Object.keys(markings).filter(k => k.startsWith(slot.id) && markings[k] !== null).length} marked
                    </span>
                    <span className="text-muted-custom text-xs">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {/* Expanded Roster Dropdown Panel */}
                {isExpanded && (
                  <div className="border-t border-line bg-canvas/10 p-4 space-y-4">
                    <div className="divide-y divide-line">
                      {roster.length === 0 ? (
                        <div className="py-4 text-center text-xs text-muted-custom">
                          No students enrolled in this class slot.
                        </div>
                      ) : (
                        roster.map(student => {
                          const key = `${slot.id}-${student.id}`;
                          const currentStatus = markings[key] || null;
                          const isZero = isZeroBalance(student.id);

                          return (
                            <div key={student.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                              
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-brass text-ink flex items-center justify-center font-bold text-xs">
                                  {student.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                  <h5 className="font-bold text-ink text-xs">
                                    {student.name}
                                  </h5>
                                  {isZero ? (
                                    <p className="text-[9px] text-hot-custom font-semibold mt-0.5">
                                      ⚠ No classes left — front desk will be notified
                                    </p>
                                  ) : (
                                    <p className="text-[9px] text-muted-custom mt-0.5">
                                      Active package
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <div className="flex gap-1.5">
                                  {(['present', 'absent', 'makeup'] as const).map(st => {
                                    const isMarked = currentStatus === st;
                                    const colors = {
                                      present: 'bg-emerald-700 text-white border-emerald-700',
                                      absent: 'bg-red-700 text-white border-red-700',
                                      makeup: 'bg-amber-600 text-white border-amber-600'
                                    };
                                    return (
                                      <button
                                        key={st}
                                        onClick={() => handleMarkStatus(slot.id, student.id, st)}
                                        className={`px-3 py-1 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                                          isMarked 
                                            ? colors[st] 
                                            : 'bg-white border-line text-ink hover:bg-canvas'
                                        }`}
                                      >
                                        {st.charAt(0).toUpperCase() + st.slice(1)}
                                      </button>
                                    );
                                  })}
                                </div>
                                {(currentUser.role === 'owner' || currentUser.role === 'front_desk') && (currentStatus === 'present' || currentStatus === 'makeup') && (
                                  <select
                                    value={billedHours[key] ?? getDefaultDuration(slot)}
                                    onChange={e => setBilledHours(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                    className="bg-white border border-line rounded px-1.5 py-0.5 text-[9px] text-ink outline-none cursor-pointer focus:border-forest"
                                  >
                                    <option value={1}>1 Class (Regular / Camp Promo)</option>
                                    <option value={2}>2 Classes (Boot Camp)</option>
                                  </select>
                                )}
                              </div>

                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Action Bar below student list */}
                    {roster.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line mt-3">
                        <input
                          type="text"
                          value={classTopic}
                          onChange={e => setClassTopic(e.target.value)}
                          placeholder="Type class topic..."
                          className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none"
                        />

                        <button
                          onClick={() => handleSaveAttendance(slot.id)}
                          disabled={saveStatus === 'Saving attendance...'}
                          className={`bg-[#173F35] hover:bg-[#122f28] text-white font-bold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer ${saveStatus === 'Saving attendance...' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {saveStatus === 'Saving attendance...' ? 'Saving...' : 'Save attendance'}
                        </button>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink cursor-pointer bg-white border border-line px-3 py-2 rounded-lg hover:bg-canvas transition-all select-none">
                           <input
                             type="checkbox"
                             checked={slot.is_summer_camp || false}
                             onChange={async (e) => {
                               const checked = e.target.checked;
                               const existing = db.getScheduleSlots();
                               const sIdx = existing.findIndex(s => s.id === slot.id);
                               if (sIdx !== -1) {
                                 existing[sIdx].is_summer_camp = checked;
                                 db.save('schedule_slots', existing);
                               }
                               try {
                                 await toggleSummerCampSlot(slot.id, checked);
                                 const freshData = await syncDatabaseToClient();
                                 db.syncFromNeon(freshData);
                                 loadData();
                               } catch (err) {
                                 console.error("Failed to toggle summer camp on server:", err);
                               }
                             }}
                             className="rounded border-line text-forest focus:ring-forest w-4 h-4 cursor-pointer"
                           />
                           <span>Summer Camp Class ☀️</span>
                         </label>

                        <span className="text-[10px] text-muted-custom italic">
                          Present decrements the package · works offline
                        </span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* Zero Balance Rule Explanation Banner */}
      <div className="p-5 rounded-[14px] bg-[#FBEEEA] border border-[#FBEEEA] border-l-4 border-l-hot-custom text-xs leading-relaxed text-[#6a4a41]">
        <b className="text-hot-custom block font-bold mb-1">The zero-balance rule.</b>
        If a student has no classes left, the platform still records the class — but creates an <b className="text-hot-custom font-bold">unbilled record</b> and alerts the front desk instead of silently giving it away. This single rule is what closes the unbilled-class leak (defensible range AED 62–76K, computed from the package ledger — the legacy AED 236K summary figure is retracted).
      </div>

    </div>
  );
};
