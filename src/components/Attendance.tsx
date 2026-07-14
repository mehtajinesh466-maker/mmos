"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, ScheduleSlot, Attendance as AttendanceType } from '../lib/db';
import { logAttendance, syncDatabaseToClient } from '../app/actions';

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
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [roster, setRoster] = useState<Array<{
    student: Student;
    pkg: Package | null;
    status: 'present' | 'absent' | 'makeup' | null;
    note: string;
  }>>([]);
  const [classTopic, setClassTopic] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(db.isOnline());
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const coaches = db.getCoaches();
  const slots = db.getScheduleSlots();
  const students = db.getStudents();
  const packages = db.getPackages();

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

  const getCoachId = () => {
    if (currentUser.role === 'coach') {
      const coach = coaches.find(c => c.user_id === currentUser.id);
      return coach ? coach.id : '';
    }
    return '';
  };

  const coachId = getCoachId();

  const getFilteredSlots = () => {
    return slots.filter(s => {
      if (activeCentre !== 'All' && s.centre_id !== activeCentre) return false;
      if (currentUser.role === 'coach' && s.coach_id !== coachId) return false;
      return true;
    });
  };

  const filteredSlots = getFilteredSlots();

  useEffect(() => {
    if (filteredSlots.length > 0) {
      if (!filteredSlots.some(s => s.id === selectedSlotId)) {
        setSelectedSlotId(filteredSlots[0].id);
      }
    } else {
      setSelectedSlotId('');
    }
  }, [selectedSlotId, filteredSlots]);

  useEffect(() => {
    if (!selectedSlotId) {
      setRoster([]);
      return;
    }

    const slot = slots.find(s => s.id === selectedSlotId);
    if (!slot) return;

    const expectedStudents = students.filter(s => {
      const matchCentre = s.centre_id === slot.centre_id;
      const matchLevel = s.level === slot.level;
      const matchCoach = s.coach_id === slot.coach_id;
      const isActive = s.status === 'active' || s.status === 'inactive';
      return matchCentre && matchLevel && matchCoach && isActive;
    });

    const activePackages = packages.filter(p => !p.frozen && p.classes_remaining > 0);

    const initialRoster = expectedStudents.map(student => {
      const studentPkgs = activePackages.filter(p => p.student_id === student.id);
      return {
        student,
        pkg: studentPkgs[0] || null,
        status: null as 'present' | 'absent' | 'makeup' | null,
        note: '',
      };
    });

    setRoster(initialRoster);
  }, [selectedSlotId, selectedDate]);

  const handleMarkStatus = (studentId: string, status: 'present' | 'absent' | 'makeup') => {
    setRoster(prev =>
      prev.map(item =>
        item.student.id === studentId
          ? { ...item, status: item.status === status ? null : status }
          : item
      )
    );
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setRoster(prev =>
      prev.map(item =>
        item.student.id === studentId ? { ...item, note } : item
      )
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) return;

    const slot = slots.find(s => s.id === selectedSlotId);
    if (!slot) return;

    setIsSaving(true);
    let savedCount = 0;
    let queuedCount = 0;

    try {
      for (const item of roster) {
        if (!item.status) continue;

        const record: AttendanceType = {
          id: `att-${slot.id}-${item.student.id}-${selectedDate}`,
          student_id: item.student.id,
          slot_id: slot.id,
          coach_id: slot.coach_id,
          date: selectedDate,
          status: item.status,
          topic: classTopic,
          note: item.note,
          created_at: new Date().toISOString(),
        };

        if (isOnline) {
          db.processAttendanceRecord(record);
          await logAttendance(record.student_id, record.status, record.coach_id);
          savedCount++;
        } else {
          db.addToOfflineQueue(record);
          queuedCount++;
        }
      }

      // Sync updated package balances back from Neon
      if (isOnline && savedCount > 0) {
        const freshData = await syncDatabaseToClient();
        db.syncFromNeon(freshData);
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
      setIsSaving(false);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  const getSlotDetails = (s: ScheduleSlot) => {
    const coach = coaches.find(c => c.id === s.coach_id);
    return `${s.day} ${s.time} — ${s.level} (${coach?.name || 'Unassigned'})`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start pb-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase font-display">Flagship Attendance</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Roster &amp; Class Tracking</h1>
          <p className="text-xs text-muted-custom mt-1">
            Mark classes, topics, and notes. Updates packages and clears student inactivity flags.
          </p>
        </div>

        <div>
          {isOnline ? (
            <span className="text-[9px] font-bold px-3 py-1.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800">
              ● Connected Online
            </span>
          ) : (
            <span className="text-[9px] font-bold px-3 py-1.5 rounded-full border bg-red-50 border-red-200 text-hot-custom">
              ☁ Offline Mode (Queued)
            </span>
          )}
        </div>
      </div>

      {saveStatus && (
        <div className="p-4 rounded-xl border border-line bg-amber-50 text-xs font-semibold text-ink">
          <b>System Message:</b> {saveStatus}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Class Details Card */}
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold font-display text-ink flex items-center gap-2">
            <span className="text-[#C4A249]">♞</span> Class Session Details
          </h2>
          <p className="text-xs text-muted-custom">Choose a schedule slot, date, and general topic covered today.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Class Schedule Slot</label>
              <select
                value={selectedSlotId}
                onChange={e => setSelectedSlotId(e.target.value)}
                required
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="">-- Select Class --</option>
                {filteredSlots.map(s => (
                  <option key={s.id} value={s.id}>
                    {getSlotDetails(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Session Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                required
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">Session Topic Covered</label>
            <input
              type="text"
              placeholder="e.g. Ruy Lopez Opening, Knight forks, Endgame oppositions"
              value={classTopic}
              onChange={e => setClassTopic(e.target.value)}
              required
              className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
            />
          </div>
        </div>

        {/* Expected Roster Card */}
        {selectedSlotId && roster.length === 0 && (
          <div className="bg-surface border border-line rounded-[14px] p-8 text-center text-xs text-muted-custom font-semibold">
            No students are currently matched to this class level and coach. 
            <br />
            <span className="text-[10px] font-normal text-muted-custom/70">Verify student coach assignment &amp; level matches in Students directory.</span>
          </div>
        )}

        {roster.length > 0 && (
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold font-display text-ink flex items-center gap-2">
              <span className="text-forest">♟</span> Class Expected Roster
            </h2>
            <p className="text-xs text-muted-custom">Tapping "Present" decrements remaining classes from their package automatically.</p>

            <div className="divide-y divide-line">
              {roster.map(item => {
                const isLow = item.pkg ? item.pkg.classes_remaining <= 2 : true;
                const isInactive = item.student.flags.inactive;
                
                return (
                  <div key={item.student.id} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center py-4 first:pt-0 last:pb-0">
                    
                    {/* Student details */}
                    <div>
                      <div className="font-semibold text-ink flex items-center gap-2">
                        {item.student.name}
                        {isInactive && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-hot-custom">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-custom mt-0.5">
                        <span className="font-semibold">{item.student.level}</span>
                        {item.student.fide_id && ` · FIDE: ${item.student.fide_id}`}
                      </div>
                    </div>

                    {/* Radio Selectors */}
                    <div className="flex gap-2">
                      {(['present', 'absent', 'makeup'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleMarkStatus(item.student.id, st)}
                          className={`flex-1 font-semibold text-xs py-2 rounded-lg border transition-all ${
                            item.status === st
                              ? st === 'present'
                                ? 'bg-forest border-forest text-white'
                                : st === 'absent'
                                  ? 'bg-hot-custom border-hot-custom text-white'
                                  : 'bg-[#C4A249] border-[#C4A249] text-white'
                              : 'bg-white border-line text-ink hover:bg-canvas'
                          }`}
                        >
                          <span className="capitalize">{st}</span>
                        </button>
                      ))}
                    </div>

                    {/* Package and Notes */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-custom">
                          Package Balance: <b className="font-mono text-ink">{item.pkg ? `${item.pkg.classes_remaining} / ${item.pkg.classes_total}` : '0 / 0'}</b>
                        </span>
                        {isLow && (
                          <span className="text-[8px] font-bold px-1.5 bg-red-50 border border-red-100 text-hot-custom rounded">
                            Low Balance
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Add student note (optional)..."
                        value={item.note}
                        onChange={e => handleNoteChange(item.student.id, e.target.value)}
                        className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none"
                      />
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Action Row */}
            <div className="flex justify-end pt-4 border-t border-line">
              <button 
                type="submit" 
                disabled={isSaving}
                className="bg-forest hover:bg-forest/90 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving to DB...
                  </>
                ) : (isOnline ? 'Save & Sync Records' : '☁ Queue Offline')}
              </button>
            </div>

          </div>
        )}
      </form>
    </div>
  );
};
