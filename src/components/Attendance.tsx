"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, ScheduleSlot, Attendance as AttendanceType, Coach } from '../lib/db';
import { logAttendance, syncDatabaseToClient, toggleSummerCampSlot, enrollStudent, unenrollStudent } from '../app/actions';

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
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [rosterModalSlot, setRosterModalSlot] = useState<ScheduleSlot | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterUpdating, setRosterUpdating] = useState(false);

  const loadData = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setSlots(db.getScheduleSlots());
    setCentres(db.getCentres());
    setAttendance(db.getAttendance());
    setEnrollments(db.getEnrollments ? db.getEnrollments() : []);

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

  // Pre-fill class topic from existing attendance record when selected date or expanded slot changes
  useEffect(() => {
    const activeSlotId = Object.keys(expandedSlots).find(id => expandedSlots[id]);
    if (!activeSlotId) return;

    const existingAtt = attendance.find(a => {
      if (a.slot_id !== activeSlotId) return false;
      const d = new Date(a.date);
      const isoDate = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      const localDate = !isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
      return isoDate === selectedDate || localDate === selectedDate || (typeof a.date === 'string' && a.date.includes(selectedDate));
    });

    if (existingAtt && existingAtt.topic) {
      setClassTopic(existingAtt.topic);
    } else {
      setClassTopic('Opening principles');
    }
  }, [expandedSlots, selectedDate, attendance]);

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
    const studentPkgs = packages.filter(p => p.student_id === studentId && !p.frozen);
    if (studentPkgs.length === 0) return true;
    const activePkgs = studentPkgs.filter(p => p.classes_remaining > 0 && p.kind !== 'unbilled' && p.kind !== 'settled');
    return activePkgs.length === 0;
  };

  // Roster logic per slot: uses explicit enrollments if present, else level filter
  const getSlotRoster = (slot: ScheduleSlot) => {
    const slotEnrollments = enrollments.filter(e => e.slot_id === slot.id);
    if (slotEnrollments.length > 0) {
      const enrolledIds = new Set(slotEnrollments.map(e => e.student_id));
      return students.filter(s => enrolledIds.has(s.id));
    }
    
    // Check if slot was explicitly cleared/marked empty
    if (typeof window !== 'undefined' && localStorage.getItem(`explicit_empty_slot_${slot.id}`) === 'true') {
      return [];
    }

    return students.filter(s => 
      s.centre_id === slot.centre_id && 
      s.level === slot.level && 
      s.status === 'active' &&
      s.coach_id === slot.coach_id
    );
  };

  const handleClearRoster = async () => {
    if (!rosterModalSlot) return;
    setRosterUpdating(true);
    try {
      // 1. Delete all existing enrollments for this slot
      const slotEnrollments = enrollments.filter(e => e.slot_id === rosterModalSlot.id);
      const promises = [];
      for (const enr of slotEnrollments) {
        db.removeEnrollment(enr.student_id, rosterModalSlot.id);
        promises.push(unenrollStudent(enr.student_id, rosterModalSlot.id));
      }
      await Promise.all(promises);

      // 2. Set localStorage flag to keep the slot explicitly empty
      localStorage.setItem(`explicit_empty_slot_${rosterModalSlot.id}`, 'true');

      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      setEnrollments(db.getEnrollments ? db.getEnrollments() : []);
    } catch (err: any) {
      alert("Failed to clear roster: " + err.message);
    } finally {
      setRosterUpdating(false);
    }
  };

  const handleRestoreDefault = async () => {
    if (!rosterModalSlot) return;
    setRosterUpdating(true);
    try {
      // 1. Remove localStorage flag
      localStorage.removeItem(`explicit_empty_slot_${rosterModalSlot.id}`);

      // 2. Delete all explicit enrollments to revert to level fallback
      const slotEnrollments = enrollments.filter(e => e.slot_id === rosterModalSlot.id);
      const promises = [];
      for (const enr of slotEnrollments) {
        db.removeEnrollment(enr.student_id, rosterModalSlot.id);
        promises.push(unenrollStudent(enr.student_id, rosterModalSlot.id));
      }
      await Promise.all(promises);

      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      setEnrollments(db.getEnrollments ? db.getEnrollments() : []);
    } catch (err: any) {
      alert("Failed to reset roster: " + err.message);
    } finally {
      setRosterUpdating(false);
    }
  };

  // Filter and sort students for the roster modal (enrolled first)
  const rosterModalStudents = useMemo(() => {
    if (!rosterModalSlot) return [];
    
    // Show active students at the same center
    const centerStudents = students.filter(s => s.centre_id === rosterModalSlot.centre_id && s.status === 'active');
    
    const slotRoster = getSlotRoster(rosterModalSlot);
    const slotRosterIds = new Set(slotRoster.map(s => s.id));
    
    const mapped = centerStudents.map(student => ({
      student,
      isEnrolled: slotRosterIds.has(student.id)
    }));
    
    // Sort so enrolled students are at the top, then alphabetically
    mapped.sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return a.student.name.localeCompare(b.student.name);
    });
    
    const filtered = rosterSearch
      ? mapped.filter(item => item.student.name.toLowerCase().includes(rosterSearch.toLowerCase()))
      : mapped;
      
    return filtered;
  }, [rosterModalSlot, students, enrollments, rosterSearch]);

  const getCentreName = (centreId: string) => {
    const match = centres.find(c => c.id === centreId);
    return match ? match.name : (centreId === 'c-2' || centreId === 'JLT' ? 'JLT' : 'Bay Avenue');
  };

  const handleMarkStatus = (slotId: string, studentId: string, status: 'present' | 'absent' | 'makeup' | 'informed') => {
    // Block marking if the selected date is in the future
    if (selectedDate) {
      const today = new Date();
      const [ty, tm, td] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
      const [ay, am, ad] = selectedDate.split('-').map(Number);
      const todayVal = ty * 10000 + tm * 100 + td;
      const attVal  = ay * 10000 + am * 100 + ad;
      if (attVal > todayVal) {
        alert(`Cannot mark attendance for a future date (${selectedDate}).`);
        return;
      }
    }

    const key = `${slotId}-${studentId}`;
    const newStatus = markings[key] === status ? null : status;
    
    setMarkings(prev => ({
      ...prev,
      [key]: newStatus
    }));

    if (newStatus === null || newStatus === 'absent' || newStatus === 'informed') {
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

    const rosterStudentIds = new Set(getSlotRoster(slot).map(s => s.id));
    const slotMarkings = Object.keys(markings).filter(key =>
      key.startsWith(slotId) && markings[key] !== null && rosterStudentIds.has(key.substring(slotId.length + 1))
    );
    // Ensure the attendance date is not in the future compared to today's local date
    if (selectedDate) {
      const today = new Date();
      const [ty, tm, td] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
      const [ay, am, ad] = selectedDate.split('-').map(Number);
      const todayVal = ty * 10000 + tm * 100 + td;
      const attVal  = ay * 10000 + am * 100 + ad;
      if (attVal > todayVal) {
        setSaveStatus(`❌ Error: Cannot log attendance for a future date (${selectedDate}).`);
        setTimeout(() => setSaveStatus(''), 5000);
        return;
      }
    }

    // Date floor validation: ensure attendance date is not prior to student's join date
    for (const key of slotMarkings) {
      const studentId = key.substring(slotId.length + 1);
      const student = students.find(s => s.id === studentId);
      if (!student) continue; // skip stale markings for removed students
      if (student.join_date) {
        // Parse as YYYY-MM-DD local date to avoid UTC midnight vs IST offset issues
        const [jy, jm, jd] = (typeof student.join_date === 'string'
          ? student.join_date.split('T')[0]
          : new Date(student.join_date).toISOString().split('T')[0]
        ).split('-').map(Number);
        const [ay, am, ad] = selectedDate.split('-').map(Number);
        const joinVal = jy * 10000 + jm * 100 + jd;
        const attVal  = ay * 10000 + am * 100 + ad;
        if (attVal < joinVal) {
          const dateStr = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
          setSaveStatus(`❌ Error: Cannot back-date class for ${student.name} before their join date (${dateStr}).`);
          setTimeout(() => setSaveStatus(''), 5000);
          return;
        }
      }
    }

    setSaveStatus('Saving attendance...');
    let newCount = 0;
    let updatedCount = 0;
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
          const result = await logAttendance(record.student_id, record.status, record.coach_id, record.slot_id || undefined, duration, selectedDate, classTopic);
          // logAttendance returns null when status is null (deletion), an existing record
          // unchanged when nothing changed, or the created/updated record otherwise.
          // We detect a NEW record by checking whether its created_at === updated_at (Prisma
          // sets both on create; update only changes updated_at — but since we don't expose
          // updated_at, use a simpler proxy: check if the id was freshly minted by seeing
          // if it was not in the existing attendance list before this save loop).
          const existingRecord = attendance.find(
            a => a.student_id === studentId &&
              a.slot_id === slot.id &&
              new Date(a.date).toISOString().split('T')[0] === selectedDate
          );

          if (!existingRecord) {
            newCount++;
          } else {
            const hasStatusChanged = existingRecord.status !== status;
            const hasDurationChanged = existingRecord.duration !== duration;
            const hasTopicChanged = existingRecord.topic !== classTopic;
            if (hasStatusChanged || hasDurationChanged || hasTopicChanged) {
              updatedCount++;
            }
          }
        } else {
          db.addToOfflineQueue(record);
          queuedCount++;
        }
      }

      // Sync updated package balances back from Neon
      if (isOnline && (newCount + updatedCount) > 0) {
        try {
          const freshData = await syncDatabaseToClient();
          db.syncFromNeon(freshData);
          loadData();
        } catch (syncErr) {
          console.warn("Sync failed:", syncErr);
          const parts = [];
          if (newCount > 0) parts.push(`${newCount} new`);
          if (updatedCount > 0) parts.push(`${updatedCount} updated`);
          setSaveStatus(`✓ Saved: ${parts.join(' · ')}. (Sync warning: refresh to see latest balances).`);
          onQueueChange();
          return;
        }
      }

      onQueueChange();

      if (newCount > 0 || updatedCount > 0) {
        const parts = [];
        if (newCount > 0) parts.push(`${newCount} new`);
        if (updatedCount > 0) parts.push(`${updatedCount} updated`);
        setSaveStatus(`✓ Saved to database: ${parts.join(' · ')}.`);
      } else if (queuedCount > 0) {
        setSaveStatus(`☁ Offline. Queued ${queuedCount} attendance records for later sync.`);
      } else {
        setSaveStatus('✓ No changes — all markings already saved.');
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
              max={new Date().toISOString().split('T')[0]}
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

      {/* Future date warning banner */}
      {(() => {
        if (!selectedDate) return null;
        const today = new Date();
        const [ty, tm, td] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
        const [ay, am, ad] = selectedDate.split('-').map(Number);
        const todayVal = ty * 10000 + tm * 100 + td;
        const attVal  = ay * 10000 + am * 100 + ad;
        if (attVal > todayVal) {
          return (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-hot-custom text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <span>⚠️</span>
              <span>Future date selected ({selectedDate}). Attendance entry is disabled for future dates.</span>
            </div>
          );
        }
        return null;
      })()}

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
                    <div className="flex justify-between items-center pb-2 border-b border-line">
                      <span className="text-[10px] font-bold text-[#C4A249] tracking-wider uppercase">Class Roster</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRosterModalSlot(slot);
                        }}
                        className="bg-white border border-line hover:bg-canvas text-ink font-bold text-[10px] px-2.5 py-1 rounded shadow-sm transition-all"
                      >
                        ⚙ Manage Class Roster
                      </button>
                    </div>

                    <div className="divide-y divide-line">
                      {roster.length === 0 ? (
                        <div className="py-6 text-center space-y-3">
                          <p className="text-xs text-muted-custom">No students enrolled in this class slot.</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRosterModalSlot(slot);
                            }}
                            className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all"
                          >
                            ⚙ Manage Class Roster
                          </button>
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
                                  {(() => {
                                    const unpaidClasses = (student.flags as any)?.unpaid_classes || 0;
                                    const unpaidValue = (student.flags as any)?.unpaid_value || 0;
                                    if (unpaidClasses > 0) {
                                      return (
                                        <p className="text-[9px] text-hot-custom font-bold mt-0.5">
                                          ⚠ {unpaidClasses} {unpaidClasses === 1 ? 'class' : 'classes'} unbilled — AED {unpaidValue} owed
                                        </p>
                                      );
                                    }
                                    if (isZero) {
                                      return (
                                        <p className="text-[9px] text-hot-custom font-semibold mt-0.5">
                                          ⚠ No classes left — front desk will be notified
                                        </p>
                                      );
                                    }
                                    return (
                                      <p className="text-[9px] text-muted-custom mt-0.5">
                                        Active package
                                      </p>
                                    );
                                  })()}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <div className="flex gap-1.5">
                                  {(['present', 'absent', 'informed', 'makeup'] as const).map(st => {
                                    const isMarked = currentStatus === st;
                                    const colors = {
                                      present: 'bg-emerald-700 text-white border-emerald-700',
                                      absent: 'bg-red-700 text-white border-red-700',
                                      informed: 'bg-blue-600 text-white border-blue-600',
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
                          Present, Absent & Makeup deduct from the package · Informed does not · works offline
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
        If a student has no classes left, the platform still records the class — but creates an <b className="text-hot-custom font-bold">unbilled record</b> and alerts the front desk, instead of silently giving it away. This protects package revenue and keeps the ledger accurate.
      </div>

      {/* Manage Roster Drawer Modal */}
      {rosterModalSlot && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end animate-fadeIn">
          <div className="bg-surface w-full max-w-md h-full shadow-2xl flex flex-col border-l border-line p-6 space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <h3 className="font-bold text-ink text-base flex items-center gap-2 font-display">
                  <span>⚙</span> Class Roster Management
                </h3>
                <p className="text-xs text-muted-custom mt-0.5">
                  {rosterModalSlot.day} {rosterModalSlot.time} · {rosterModalSlot.level} ({getCentreName(rosterModalSlot.centre_id)})
                </p>
              </div>
              <button
                onClick={() => {
                  setRosterModalSlot(null);
                  setRosterSearch('');
                }}
                className="w-8 h-8 rounded-full bg-canvas border border-line flex items-center justify-center text-ink font-bold hover:bg-line transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-custom leading-relaxed">
                Check students to enroll them in this explicit class slot. Deselecting all returns slot to level-filtered roster.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearRoster}
                  disabled={rosterUpdating}
                  className="flex-1 text-[10px] font-bold bg-red-50 hover:bg-red-100 active:scale-[0.98] text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🧹 Clear Roster (Start Fresh)
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDefault}
                  disabled={rosterUpdating}
                  className="flex-1 text-[10px] font-bold bg-canvas hover:bg-line active:scale-[0.98] text-ink border border-line px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 Reset (Level Fallback)
                </button>
              </div>
              
              {/* Search Box Input */}
              <input
                type="text"
                placeholder="🔍 Search student by name..."
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none mb-2 focus:border-forest"
              />

              <div className="divide-y divide-line border border-line rounded-xl bg-white max-h-[60vh] overflow-y-auto">
                {rosterModalStudents.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-custom">No students found</div>
                ) : (
                  rosterModalStudents.map(({ student, isEnrolled }) => {
                    return (
                      <label key={student.id} className="flex items-center justify-between p-3.5 hover:bg-canvas/30 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                          <input
                             type="checkbox"
                             checked={isEnrolled}
                             disabled={rosterUpdating}
                             onChange={async (e) => {
                               if (rosterUpdating) return;
                               setRosterUpdating(true);
                               const checked = e.target.checked;
                               try {
                                 // Clear explicit empty slot override when checking any student
                                 if (checked) {
                                   localStorage.removeItem(`explicit_empty_slot_${rosterModalSlot.id}`);
                                 }

                                 const slotEnrollments = enrollments.filter(ev => ev.slot_id === rosterModalSlot.id);
                                 const hasExplicitEnrollments = slotEnrollments.length > 0;

                                 if (!hasExplicitEnrollments) {
                                   // Transition slot from level-filtered fallback to explicit roster
                                   const fallbackStudents = students.filter(s => 
                                     s.centre_id === rosterModalSlot.centre_id && 
                                     s.status === 'active' && 
                                     (s.level === rosterModalSlot.level || (rosterModalSlot.level === 'Beginner' && !s.level))
                                   );

                                   let targetRoster = [];
                                   // If checked, only enroll the clicked student (allowing start fresh)
                                   // instead of automatically checking all fallback students
                                   if (checked) {
                                     targetRoster.push(student);
                                   }

                                   const promises = [];
                                   for (const s of targetRoster) {
                                     const uuid = typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
                                     db.saveEnrollment({
                                       id: `enr-${uuid}`,
                                       student_id: s.id,
                                       slot_id: rosterModalSlot.id,
                                       enrolled_at: new Date().toISOString()
                                     });
                                     promises.push(enrollStudent(s.id, rosterModalSlot.id));
                                   }
                                   await Promise.all(promises);
                                 } else {
                                   if (checked) {
                                     const uuid = typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
                                     db.saveEnrollment({
                                       id: `enr-${uuid}`,
                                       student_id: student.id,
                                       slot_id: rosterModalSlot.id,
                                       enrolled_at: new Date().toISOString()
                                     });
                                     setEnrollments(db.getEnrollments ? db.getEnrollments() : []);
                                     await enrollStudent(student.id, rosterModalSlot.id);
                                   } else {
                                     db.removeEnrollment(student.id, rosterModalSlot.id);
                                     setEnrollments(db.getEnrollments ? db.getEnrollments() : []);
                                     await unenrollStudent(student.id, rosterModalSlot.id);
                                   }
                                 }
                                 const freshData = await syncDatabaseToClient();
                                 db.syncFromNeon(freshData);
                                 setEnrollments(db.getEnrollments ? db.getEnrollments() : []);
                               } catch (err: any) {
                                 console.error("Enrollment failed:", err);
                                 alert("Roster update failed: " + err.message);
                                 const freshData = await syncDatabaseToClient();
                                 db.syncFromNeon(freshData);
                                 setEnrollments(db.getEnrollments ? db.getEnrollments() : []);
                               } finally {
                                 setRosterUpdating(false);
                               }
                             }}
                             className="w-4 h-4 rounded border-line text-forest focus:ring-forest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <div>
                            <span className="font-bold text-xs text-ink block">{student.name}</span>
                            <span className="text-[9px] text-muted-custom">{student.level || 'No level'}</span>
                          </div>
                        </div>
                        {isEnrolled && (
                          <span className="text-[9px] font-bold text-forest bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                            Enrolled
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <button
                onClick={() => setRosterModalSlot(null)}
                className="bg-forest text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-forest-light transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
