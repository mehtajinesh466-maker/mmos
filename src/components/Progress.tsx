"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { User, Student, ProgressLog } from '../lib/db';
import { logProgress, syncDatabaseToClient } from '../app/actions';

interface ProgressProps {
  currentUser: User;
  activeCentre: string;
}

export const Progress: React.FC<ProgressProps> = ({ currentUser, activeCentre }) => {
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [topicCovered, setTopicCovered] = useState<string>('Rook endgames — technique');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [roster, setRoster] = useState<Array<{
    student: Student;
    mastery: 'Learning' | 'Practising' | 'Mastered';
    note: string;
  }>>([]);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const slots = db.getScheduleSlots();
  const students = db.getStudents();
  const coaches = db.getCoaches();

  const getCoachId = () => {
    if (currentUser.role === 'coach') {
      const coach = coaches.find(c => c.user_id === currentUser.id);
      return coach ? coach.id : '';
    }
    return coaches[0]?.id || '';
  };

  const coachId = getCoachId();

  // Filter slots based on role and centre
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
      setSelectedSlotId(filteredSlots[0].id);
    }
  }, []);

  // Update roster based on selected slot and selected date
  useEffect(() => {
    if (!selectedSlotId) {
      setRoster([]);
      return;
    }

    const slot = slots.find(s => s.id === selectedSlotId);
    if (!slot) return;

    // Load active students matching this slot's roster logic (enrollments or fallback to level/centre)
    const enrollments = db.getEnrollments ? db.getEnrollments() : [];
    const slotEnrollments = enrollments.filter(e => e.slot_id === slot.id);
    let matchedStudents;
    if (slotEnrollments.length > 0) {
      const enrolledIds = new Set(slotEnrollments.map(e => e.student_id));
      matchedStudents = students.filter(s => enrolledIds.has(s.id));
    } else {
      matchedStudents = students.filter(s => 
        s.centre_id === slot.centre_id && 
        s.level === slot.level && 
        s.status === 'active'
      );
    }

    const existingLogs = db.getProgressLogs();
    const targetDateStr = new Date(selectedDate).toISOString().split('T')[0];

    // Try to find if any student in this roster already has a progress log for this date to pre-fill the topic
    const existingLogForDate = existingLogs.find(l => {
      const logDateStr = l.date ? new Date(l.date).toISOString().split('T')[0] : '';
      return logDateStr === targetDateStr && matchedStudents.some(s => s.id === l.student_id);
    });

    if (existingLogForDate) {
      setTopicCovered(existingLogForDate.topic || '');
    } else {
      setTopicCovered('Rook endgames — technique');
    }

    setRoster(matchedStudents.map(student => {
      // Find progress log specifically for this student on the selected date
      const logForDate = existingLogs.find(l => {
        if (l.student_id !== student.id) return false;
        const logDateStr = l.date ? new Date(l.date).toISOString().split('T')[0] : '';
        return logDateStr === targetDateStr;
      });

      return {
        student,
        mastery: logForDate ? logForDate.mastery : 'Learning',
        note: logForDate ? (logForDate.note || '') : ''
      };
    }));
  }, [selectedSlotId, selectedDate]);

  const handleMasteryClick = (studentId: string, level: 'Learning' | 'Practising' | 'Mastered') => {
    setRoster(prev => 
      prev.map(item => 
        item.student.id === studentId ? { ...item, mastery: level } : item
      )
    );
  };

  const handleNoteChange = (studentId: string, text: string) => {
    setRoster(prev => 
      prev.map(item => 
        item.student.id === studentId ? { ...item, note: text } : item
      )
    );
  };

  const handleSaveLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roster.length === 0) return;

    setIsSaving(true);
    let count = 0;
    try {
      for (const item of roster) {
        // Save to local database (localStorage)
        db.saveProgressLog({
          id: 'log-' + crypto.randomUUID(),
          student_id: item.student.id,
          coach_id: coachId,
          date: selectedDate,
          topic: topicCovered,
          mastery: item.mastery,
          skills: { openings: 3, tactics: 3, endgames: 3, strategy: 3, focus: 3 },
          note: item.note
        });
        count++;
      }
      
      try {
        const freshData = await syncDatabaseToClient();
        db.syncFromNeon(freshData);
      } catch (syncErr) {
        console.warn('Server sync skipped:', syncErr);
      }

      setSaveStatus(`✓ Progress saved for ${count} student${count > 1 ? 's' : ''}!`);
    } catch (err: any) {
      setSaveStatus('❌ Error: ' + err.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-6 text-ink">
      
      {/* Header */}
      <div className="flex justify-between items-start pb-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">INPUT</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Post-Class Progress Log</h1>
        </div>

        <div>
          <select className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none">
            <option>All centres</option>
            <option>Bay Avenue</option>
            <option>JLT</option>
          </select>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${saveStatus.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {saveStatus}
        </div>
      )}

      {/* Top Banner */}
      <div className="p-4 rounded-[14px] bg-emerald-50/50 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/80 leading-relaxed">
        ✍ <b className="text-ink">Post-class log — 20 seconds.</b> Tap the topic and a mastery read per student, add one line. The only new habit the platform asks of coaches — and it fills the pace flags, slow-progress alerts and every parent report automatically.
      </div>

      {/* Main Roster Panel Form */}
      <form onSubmit={handleSaveLogs} className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-6">
        
        {/* Class Details Input Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-4 border-b border-line">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">Date</label>
            <input 
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">Class</label>
            <select
              value={selectedSlotId}
              onChange={e => setSelectedSlotId(e.target.value)}
              className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
            >
              <option value="">Select slot...</option>
              {filteredSlots.map(s => {
                const coach = coaches.find(c => c.id === s.coach_id);
                return (
                  <option key={s.id} value={s.id}>
                    {s.day} {s.time} · {s.level} ({coach?.name || 'Unassigned'})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">Topic covered</label>
            <input 
              type="text"
              value={topicCovered}
              onChange={e => setTopicCovered(e.target.value)}
              placeholder="Type skills topic covered..."
              className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
            />
          </div>
        </div>

        {/* Expected Students list */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase">STUDENTS — TAP A MASTERY READ</h3>

          {roster.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-custom font-medium">
              No students matched to the selected class slot.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {roster.map(item => (
                <div key={item.student.id} className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_2fr] gap-6 items-center py-4 first:pt-0 last:pb-0">
                  
                  {/* Student info */}
                  <div>
                    <div className="font-semibold text-xs text-ink">
                      <a href={`/student-dashboard?studentId=${item.student.id}`} className="hover:text-forest hover:underline">
                        {item.student.name}
                      </a>
                    </div>
                    <div className="text-[10px] text-muted-custom mt-0.5 font-mono">7 classes / 30d</div>
                  </div>

                  {/* Mastery buttons */}
                  <div className="flex gap-2">
                    {(['Learning', 'Practising', 'Mastered'] as const).map(level => {
                      const isSelected = item.mastery === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleMasteryClick(item.student.id, level)}
                          className={`flex-1 font-semibold text-xs py-1.5 rounded-lg border transition-all ${
                            isSelected
                              ? level === 'Mastered'
                                ? 'bg-forest border-forest text-white'
                                : 'bg-[#173F35] border-[#173F35] text-white'
                              : 'bg-white border-line text-ink hover:bg-canvas'
                          }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>

                  {/* Notes input */}
                  <div>
                    <input 
                      type="text"
                      placeholder="One line for the parent report..."
                      value={item.note}
                      onChange={e => handleNoteChange(item.student.id, e.target.value)}
                      className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                    />
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="flex justify-start gap-3 pt-6 border-t border-line">
          <button 
            type="submit" 
            disabled={isSaving || roster.length === 0}
            className="bg-forest hover:bg-forest/90 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving to DB...
              </>
            ) : 'Save class log'}
          </button>
          
          <button 
            type="button"
            disabled={isSaving}
            className="bg-white border border-line hover:bg-canvas text-ink font-semibold text-xs px-5 py-2.5 rounded-lg transition-all disabled:opacity-60"
          >
            Preview a report
          </button>
        </div>

      </form>

    </div>
  );
};
