"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../lib/db';
import type { User, Student, Package, ScheduleSlot, Attendance, Coach } from '../lib/db';
import { logAttendance, syncDatabaseToClient } from '../app/actions';

interface ScheduleProps {
  currentUser: User;
  activeCentre: string;
}

export const Schedule: React.FC<ScheduleProps> = ({ currentUser, activeCentre }) => {
  const router = useRouter();
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [activeDay, setActiveDay] = useState<string>('Monday');
  const [expandedSlots, setExpandedSlots] = useState<{ [slotId: string]: boolean }>({});
  
  // Local markings state to dynamically update dashboard counters
  const [markings, setMarkings] = useState<{ [key: string]: 'present' | 'absent' | 'makeup' | null }>({});
  const [classTopic, setClassTopic] = useState<string>('Rook endgames — technique');

  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const loadData = () => {
    const stds = db.getStudents();
    const pkgs = db.getPackages();
    const coas = db.getCoaches();
    const sls = db.getScheduleSlots();
    const atts = db.getAttendance();

    setStudents(stds);
    setPackages(pkgs);
    setCoaches(coas);
    setSlots(sls);
    setAttendance(atts);
    setLoading(false);

    if (coas.length > 0 && !selectedCoachId) {
      // Find James Estrada or default to first coach
      const james = coas.find(c => c.name.toUpperCase().includes('JAMES'));
      setSelectedCoachId(james ? james.id : coas[0].id);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, [selectedCoachId]);

  const activeCoach = coaches.find(c => c.id === selectedCoachId);

  // Group slots by day
  const dailySlotsCount = useMemo(() => {
    const countMap: { [day: string]: number } = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    };
    slots.forEach(s => {
      if (s.coach_id === selectedCoachId) {
        countMap[s.day] = (countMap[s.day] || 0) + 1;
      }
    });
    return countMap;
  }, [slots, selectedCoachId]);

  // Display slot details for selected day
  const activeDaySlots = useMemo(() => {
    return slots.filter(s => s.day === activeDay && s.coach_id === selectedCoachId);
  }, [slots, activeDay, selectedCoachId]);

  // Auto-expand first slot
  useEffect(() => {
    if (activeDaySlots.length > 0) {
      setExpandedSlots({ [activeDaySlots[0].id]: true });
    } else {
      setExpandedSlots({});
    }
  }, [activeDay, selectedCoachId, activeDaySlots]);

  // Check if a student is zero-balance
  const isZeroBalance = (studentId: string) => {
    const studentPkgs = packages.filter(p => p.student_id === studentId);
    if (studentPkgs.length === 0) return true;
    return studentPkgs.every(p => p.classes_remaining === 0);
  };

  // Roster logic per slot
  const getSlotRoster = (slot: ScheduleSlot) => {
    return students.filter(s => 
      s.centre_id === slot.centre_id && 
      s.level === slot.level && 
      s.status === 'active'
    );
  };

  const getCentreName = (centreId: string) => {
    return centreId === 'c-2' || centreId === 'JLT' ? 'JLT' : 'Bay Avenue';
  };

  // Compute full week list and summation rows dynamically
  const fullWeekData = useMemo(() => {
    const list: any[] = [];
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedSlots = [...slots]
      .filter(s => s.coach_id === selectedCoachId)
      .sort((a, b) => {
        const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
        if (dayDiff !== 0) return dayDiff;
        return a.time.localeCompare(b.time);
      });

    let totalStudents = 0;
    let totalZeroBalance = 0;
    const uniqueStudents = new Set<string>();

    sortedSlots.forEach(slot => {
      const roster = getSlotRoster(slot);
      const zeroBal = roster.filter(s => isZeroBalance(s.id)).length;
      totalStudents += roster.length;
      totalZeroBalance += zeroBal;
      roster.forEach(s => uniqueStudents.add(s.id));

      list.push({
        id: slot.id,
        day: slot.day,
        time: slot.time,
        level: slot.level || 'Unassigned level',
        centreName: getCentreName(slot.centre_id),
        studentCount: roster.length,
        zeroBalanceCount: zeroBal
      });
    });

    return {
      list,
      totalStudents,
      totalZeroBalance,
      uniqueStudentsCount: uniqueStudents.size
    };
  }, [slots, selectedCoachId, students, packages]);

  const stats = useMemo(() => {
    const coachSlots = slots.filter(s => s.coach_id === selectedCoachId);
    const classesCount = coachSlots.length;
    const markedCount = Object.values(markings).filter(v => v !== null).length;

    return {
      classesCount,
      totalPlaces: fullWeekData.totalStudents,
      zeroBalancePlaces: fullWeekData.totalZeroBalance,
      studentsTaught: fullWeekData.uniqueStudentsCount,
      markedCount,
    };
  }, [slots, selectedCoachId, fullWeekData, markings]);

  const handleMarkStatus = (slotId: string, studentId: string, status: 'present' | 'absent' | 'makeup') => {
    const key = `${slotId}-${studentId}`;
    const newStatus = markings[key] === status ? null : status;
    
    setMarkings(prev => ({
      ...prev,
      [key]: newStatus
    }));
  };

  const handleSaveAttendance = async (slotId: string) => {
    const slotMarkings = Object.keys(markings).filter(key => key.startsWith(slotId));
    if (slotMarkings.length === 0) {
      setSaveStatus('❌ Error: No students marked for this class slot.');
      setTimeout(() => setSaveStatus(''), 4000);
      return;
    }

    try {
      let savedCount = 0;
      for (const key of slotMarkings) {
        const [_, studentId] = key.split('-');
        const status = markings[key];
        if (status) {
          await logAttendance(studentId, slotId, selectedCoachId, new Date().toISOString().split('T')[0], status, classTopic, '');
          savedCount++;
        }
      }
      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      loadData();
      setSaveStatus(`✓ Saved attendance for ${savedCount} students!`);
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err: any) {
      setSaveStatus(`❌ Error: ${err.message}`);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  const getDayLabel = (day: string) => {
    const labels: { [key: string]: { date: string; label: string } } = {
      Monday: { date: '13 Jul', label: 'Mon' },
      Tuesday: { date: '14 Jul', label: 'Tue' },
      Wednesday: { date: '15 Jul', label: 'Wed' },
      Thursday: { date: '16 Jul', label: 'Thu' },
      Friday: { date: '17 Jul', label: 'Fri' },
      Saturday: { date: '18 Jul', label: 'Sat' },
      Sunday: { date: '19 Jul', label: 'Sun' }
    };
    return labels[day] || { date: '', label: day.substring(0,3) };
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Weekly Schedule...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-muted-custom uppercase">THIS WEEK</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Weekly Schedule</h1>
        </div>

        <select className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none">
          <option>JLT</option>
          <option>Bay Avenue</option>
        </select>
      </div>

      <p className="text-xs text-muted-custom">
        Week of <b className="text-ink">Mon 13 – Sun 19 July 2026</b> · {activeCoach?.name.toUpperCase()} · {stats.classesCount} classes · {stats.totalPlaces} student-places
      </p>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface border border-line rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-custom uppercase">COACH</span>
          <select 
            value={selectedCoachId} 
            onChange={e => setSelectedCoachId(e.target.value)}
            className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none w-64"
          >
            {coaches.map(c => (
              <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${saveStatus.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {saveStatus}
        </div>
      )}

      {/* Zero Balance Warning Notice */}
      <div className="p-4 rounded-[12px] bg-[#FBEEA] border border-[#EBC9BE] border-l-4 border-l-hot-custom flex gap-3 text-xs leading-relaxed">
        <span className="text-xl">⚏</span>
        <div>
          <b className="text-hot-custom block font-bold">{stats.zeroBalancePlaces} student-places this week have zero classes remaining</b>
          <span className="text-[#6a4a41]">
            If they are marked Present, the platform creates an <b className="text-hot-custom">unbilled record</b> and alerts the front desk — it will not silently give the class away. Renew them before their next session.
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* CLASSES THIS WEEK */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Classes This Week</div>
          <h2 className="text-2xl font-bold font-display text-ink mt-1.5">
            {stats.classesCount}
          </h2>
          <p className="text-[10px] text-muted-custom mt-1">{stats.totalPlaces} student-places</p>
        </div>

        {/* MARKED */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Marked</div>
          <h2 className="text-2xl font-bold font-display text-forest mt-1.5">
            {stats.markedCount}
          </h2>
          <p className="text-[10px] text-muted-custom mt-1">
            {stats.markedCount > 0 ? `${stats.markedCount} marked so far` : 'nothing marked yet'}
          </p>
        </div>

        {/* ZERO-BALANCE PLACES */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Zero-Balance Places</div>
          <h2 className="text-2xl font-bold font-display text-hot-custom mt-1.5">
            {stats.zeroBalancePlaces}
          </h2>
          <p className="text-[10px] text-muted-custom mt-1">will raise unbilled records</p>
        </div>

        {/* STUDENTS TAUGHT */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Students Taught</div>
          <h2 className="text-2xl font-bold font-display text-ink mt-1.5">
            {stats.studentsTaught}
          </h2>
          <p className="text-[10px] text-muted-custom mt-1">unique this week</p>
        </div>

      </div>

      {/* Days Tabs selector */}
      <div className="grid grid-cols-7 gap-2">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
          const isActive = activeDay === day;
          const { label, date } = getDayLabel(day);
          const count = dailySlotsCount[day] || 0;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                isActive
                  ? 'bg-[#173F35] border-[#173F35] text-white font-semibold shadow-md'
                  : 'bg-surface border-line text-ink hover:bg-canvas'
              }`}
            >
              <span className="text-xs font-bold">{label}</span>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-300' : 'text-muted-custom'}`}>{date}</span>
              <span className={`text-[9px] font-bold mt-1.5 px-2 py-0.5 rounded-full ${isActive ? 'bg-white/10 text-white' : 'bg-canvas text-muted-custom'}`}>
                {count > 0 ? `${count} class${count > 1 ? 'es' : ''}` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timetable Slots cards list */}
      <div className="space-y-4">
        {activeDaySlots.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-line rounded-2xl text-muted-custom text-xs">
            No class slots scheduled under {activeCoach?.name} for {activeDay}.
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
                      <h4 className="font-bold text-ink text-sm">
                        {slot.level || 'Unassigned level'}
                      </h4>
                      <p className="text-[10px] text-muted-custom mt-0.5">
                        {getCentreName(slot.centre_id)} · {roster.length} student{roster.length > 1 ? 's' : ''} · 
                        {zeroBalCount > 0 ? (
                          <span className="text-hot-custom font-bold ml-1">{zeroBalCount} at zero balance</span>
                        ) : (
                          <span className="text-forest font-bold ml-1">all active packages</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-custom font-mono">
                      {Object.keys(markings).filter(k => k.startsWith(slot.id) && markings[k] !== null).length} / {roster.length} marked
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
                                      className={`px-3 py-1 text-[10px] font-semibold rounded-lg border transition-all ${
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

                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Action Bar below student list */}
                    {roster.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line mt-3">
                        <select
                          value={classTopic}
                          onChange={e => setClassTopic(e.target.value)}
                          className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none"
                        >
                          <option value="Rook endgames — technique">Rook endgames — technique</option>
                          <option value="Back-rank patterns">Back-rank patterns</option>
                          <option value="Knight outposts">Knight outposts</option>
                          <option value="Opening principles">Opening principles</option>
                        </select>

                        <button
                          onClick={() => handleSaveAttendance(slot.id)}
                          className="bg-[#173F35] hover:bg-[#122f28] text-white font-bold text-xs px-4 py-2 rounded-lg transition-all"
                        >
                          Save attendance
                        </button>

                        <button
                          onClick={() => router.push(`/progress?slotId=${slot.id}`)}
                          className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-4 py-2 rounded-lg transition-all"
                        >
                          Log progress
                        </button>

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

      {/* Full Week - All Classes Table */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <span className="text-[#C4A249]">⚏</span> Full week — all classes
            </h3>
            <p className="text-[10px] text-muted-custom mt-0.5">Export the timetable and the rosters.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
            <button className="bg-white border border-line text-[#5c5c5c] font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted-custom text-[9px] uppercase tracking-wider font-bold">
                <th className="py-2.5 px-3">Day</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">Centre</th>
                <th className="py-2.5 px-3 text-right">Students</th>
                <th className="py-2.5 px-3 text-right">At Zero Balance</th>
              </tr>
            </thead>
            <tbody>
              {fullWeekData.list.map((row, idx) => (
                <tr key={idx} className="border-b border-line hover:bg-canvas/30 transition-colors font-medium text-ink">
                  <td className="py-2.5 px-3">
                    <span className="block font-bold">{row.day}</span>
                    <span className="text-[10px] text-muted-custom font-normal">{getDayLabel(row.day).date}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">{row.time}</td>
                  <td className="py-2.5 px-3">{row.level}</td>
                  <td className="py-2.5 px-3 text-muted-custom">{row.centreName}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{row.studentCount}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.zeroBalanceCount > 0 ? (
                      <span className="text-hot-custom font-bold">{row.zeroBalanceCount}</span>
                    ) : (
                      <span className="text-muted-custom/60">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Summation Row */}
              <tr className="bg-canvas/30 font-bold text-ink border-b border-line">
                <td className="py-2.5 px-3" colSpan={4}>Total</td>
                <td className="py-2.5 px-3 text-right font-mono">{fullWeekData.totalStudents}</td>
                <td className="py-2.5 px-3 text-right font-mono text-hot-custom">{fullWeekData.totalZeroBalance}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanatory Scaffolding Banner */}
      <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90 flex gap-2">
        <span>
          <b className="text-emerald-800 block mb-1">On the timetable itself.</b>
          The students, levels, centres and balances above are real, from your live data. The <b className="text-emerald-800">day and time slots are a scaffold</b> — your source workbook holds no schedule fields. Once the platform stores a real timetable (class, day, time, room, recurrence), this screen renders it directly.
        </span>
      </div>

    </div>
  );
};
export default Schedule;
