"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../lib/db';
import type { User, Student, Package, ScheduleSlot, Attendance, Coach } from '../lib/db';
import { logAttendance, syncDatabaseToClient, createScheduleSlot, notifyEnrolledStudents, enrollStudent, unenrollStudent, toggleSummerCampSlot, rescheduleSession, cancelSession } from '../app/actions';
import { exportTableToCSV, exportToPDF } from '../lib/export';

interface ScheduleProps {
  currentUser: User;
  activeCentre: string;
}

export const Schedule: React.FC<ScheduleProps> = ({ currentUser, activeCentre }) => {
  const router = useRouter();
  const isSummerCampGloballyActive = typeof window !== 'undefined' && localStorage.getItem('mmos_summer_camp_active') !== 'false';
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [selectedCentre, setSelectedCentre] = useState<string>('All');
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
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [classSessions, setClassSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const [scheduleTab, setScheduleTab] = useState<'planner' | 'calendar'>('planner');
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month' | 'term'>('week');
  const [anchorCalendarDate, setAnchorCalendarDate] = useState<Date>(new Date());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleSessionId, setRescheduleSessionId] = useState<string>('');
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleNote, setRescheduleNote] = useState<string>('');
  
  // Drawer state for Roster Enrollment Management
  const [rosterModalSlot, setRosterModalSlot] = useState<ScheduleSlot | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);

  // Add Class Slot Modal state
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlotDay, setNewSlotDay] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>('Mon');
  const [newSlotStartTime, setNewSlotStartTime] = useState('16:00');
  const [newSlotEndTime, setNewSlotEndTime] = useState('17:00');
  const [newSlotSummerDeduction, setNewSlotSummerDeduction] = useState(5);
  const [newSlotLevel, setNewSlotLevel] = useState('Beginner');
  const [newSlotCapacity, setNewSlotCapacity] = useState(10);
  const [newSlotCentreId, setNewSlotCentreId] = useState('');
  const [newSlotCoachId, setNewSlotCoachId] = useState('');
  const [newSlotIsSummerCamp, setNewSlotIsSummerCamp] = useState(false);

  // Helper to format a local Date object as YYYY-MM-DD
  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Helper to format a DB date (which could be string or Date object) as YYYY-MM-DD
  const formatDbDate = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.slice(0, 10);
    if (val instanceof Date) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const day = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const parsed = new Date(val);
    if (isNaN(parsed.getTime())) return '';
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const loadData = () => {
    const stds = db.getStudents();
    const pkgs = db.getPackages();
    const coas = db.getCoaches();
    const sls = db.getScheduleSlots();
    const atts = db.getAttendance();
    const enrs = db.getEnrollments ? db.getEnrollments() : [];
    const cens = db.getCentres();

    setStudents(stds);
    setPackages(pkgs);
    setCoaches(coas);
    setSlots(sls);
    setAttendance(atts);
    setEnrollments(enrs);
    setCentres(cens);
    setClassSessions(db.getClassSessions ? db.getClassSessions() : []);
    setLoading(false);

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
  }, []);

  useEffect(() => {
    if (activeCentre) {
      setSelectedCentre(activeCentre);
    }
  }, [activeCentre]);

  const activeCoachId = useMemo(() => {
    if (currentUser.role === 'coach') {
      const coach = coaches.find(c => c.user_id === currentUser.id);
      return coach ? coach.id : '';
    }
    return selectedCoachId;
  }, [currentUser, coaches, selectedCoachId]);

  const activeCoach = coaches.find(c => c.id === activeCoachId);

  // Roster logic per slot: uses only explicit Enrollments now
  const getSlotRoster = (slot: ScheduleSlot) => {
    const slotEnrollments = enrollments.filter(e => e.slot_id === slot.id);
    const enrolledStudentIds = new Set(slotEnrollments.map(e => e.student_id));
    return students.filter(s => enrolledStudentIds.has(s.id));
  };

  // Get dynamic dates for the current week (Monday to Sunday)
  const weekDates = useMemo(() => {
    const current = new Date(anchorCalendarDate); // Represents selected anchor date
    const day = current.getDay();
    const distanceToMonday = day === 0 ? -6 : 1 - day; // Monday is 1, Sunday is 0
    
    const monday = new Date(current);
    monday.setDate(current.getDate() + distanceToMonday);

    const dates = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push({
        dateStr: `${d.getDate()} ${months[d.getMonth()]}`,
        dayNum: d.getDate(),
        monthName: fullMonths[d.getMonth()],
        year: d.getFullYear(),
        isoDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      });
    }
    return dates;
  }, [anchorCalendarDate]);

  const getDayNumber = (day: string): number => {
    const map: Record<string, number> = {
      'sunday': 0, 'sun': 0,
      'monday': 1, 'mon': 1,
      'tuesday': 2, 'tue': 2,
      'wednesday': 3, 'wed': 3,
      'thursday': 4, 'thu': 4,
      'friday': 5, 'fri': 5,
      'saturday': 6, 'sat': 6
    };
    return map[day.toLowerCase()] ?? 1;
  };

  const handleNavigateCalendar = (direction: number) => {
    setAnchorCalendarDate(prev => {
      const d = new Date(prev);
      if (calendarViewMode === 'day') {
        d.setDate(prev.getDate() + direction);
      } else if (calendarViewMode === 'week') {
        d.setDate(prev.getDate() + direction * 7);
      } else if (calendarViewMode === 'month') {
        d.setMonth(prev.getMonth() + direction);
      }
      return d;
    });
  };

  const getCalendarTitle = () => {
    if (calendarViewMode === 'day') {
      return anchorCalendarDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } else if (calendarViewMode === 'week') {
      const start = new Date(anchorCalendarDate);
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getDate()} ${start.toLocaleDateString(undefined, {month:'short'})} - ${end.getDate()} ${end.toLocaleDateString(undefined, {month:'short'})} ${end.getFullYear()}`;
    } else if (calendarViewMode === 'month') {
      return anchorCalendarDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    } else {
      return "All Projected Term Roster Sessions";
    }
  };

  const coachSessions = useMemo(() => {
    const coachSlots = slots.filter(s => s.coach_id === activeCoachId);
    const coachSlotIds = new Set(coachSlots.map(s => s.id));
    return classSessions.filter(s => coachSlotIds.has(s.slot_id));
  }, [classSessions, slots, activeCoachId]);

  const monthSessionsCount = useMemo(() => {
    const year = anchorCalendarDate.getFullYear();
    const month = anchorCalendarDate.getMonth();
    return coachSessions.filter(s => {
      if (!s.scheduled_date) return false;
      const d = new Date(s.scheduled_date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
  }, [coachSessions, anchorCalendarDate]);

  const monthCells = useMemo(() => {
    const year = anchorCalendarDate.getFullYear();
    const month = anchorCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    const startDayOfWeek = firstDay.getDay();
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    for (let i = offset; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      cells.push({ date: d, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      cells.push({ date: d, isCurrentMonth: true });
    }

    const totalCells = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: d, isCurrentMonth: false });
    }

    return cells;
  }, [anchorCalendarDate]);

  const handleReschedule = async () => {
    if (!rescheduleSessionId || !rescheduleDate) return;
    try {
      await rescheduleSession(rescheduleSessionId, rescheduleDate, rescheduleNote);
      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      loadData();
      setShowRescheduleModal(false);
      alert("✓ Class session rescheduled successfully.");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleCancel = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to cancel this class session?")) return;
    try {
      await cancelSession(sessionId, "Cancelled by coach/desk");
      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      loadData();
      alert("✓ Class session cancelled.");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Load markings from DB for the current week's dates
  useEffect(() => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const newMarkings: { [key: string]: 'present' | 'absent' | 'makeup' | null } = {};

    attendance.forEach(a => {
      const recordDate = typeof a.date === 'string' ? a.date.split('T')[0] : '';
      if (!recordDate || !a.slot_id || !a.student_id) return;

      const slot = slots.find(s => s.id === a.slot_id);
      if (!slot) return;

      const normDay = normalizeDay(slot.day);
      const dayIndex = dayOrder.indexOf(normDay);
      if (dayIndex === -1) return;

      const weekDate = weekDates[dayIndex];
      if (weekDate && weekDate.isoDate === recordDate) {
        newMarkings[`${a.slot_id}-${a.student_id}`] = a.status as 'present' | 'absent' | 'makeup';
      }
    });

    setMarkings(newMarkings);
  }, [attendance, slots, weekDates]);

  // Pre-fill class topic from existing attendance record when expanded slot changes
  useEffect(() => {
    const activeSlotId = Object.keys(expandedSlots).find(id => expandedSlots[id]);
    if (!activeSlotId) return;

    const slot = slots.find(s => s.id === activeSlotId);
    if (!slot) return;

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const normDay = normalizeDay(slot.day);
    const dayIndex = dayOrder.indexOf(normDay);
    const weekDate = weekDates[dayIndex];
    const slotDate = weekDate ? weekDate.isoDate : '';

    const existingAtt = attendance.find(a => {
      if (a.slot_id !== activeSlotId) return false;
      const recordDate = typeof a.date === 'string' ? a.date.split('T')[0] : '';
      return recordDate === slotDate;
    });

    if (existingAtt && existingAtt.topic) {
      setClassTopic(existingAtt.topic);
    } else {
      setClassTopic('Rook endgames — technique');
    }
  }, [expandedSlots, attendance, slots, weekDates]);

  const getDayLabel = (dayName: string) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayIndex = days.indexOf(dayName);
    const dateObj = weekDates[dayIndex] || { dateStr: '', year: 2026 };
    const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return {
      date: dateObj.dateStr,
      label: shortNames[dayIndex] || dayName.substring(0, 3)
    };
  };

  const weekRangeText = useMemo(() => {
    if (weekDates.length === 0) return 'Week';
    const mon = weekDates[0];
    const sun = weekDates[6];
    return `Week of Mon ${mon.dayNum} – Sun ${sun.dayNum} ${sun.monthName} ${sun.year}`;
  }, [weekDates]);

  // Filter slots by selected coach and centre
  const filteredSlots = useMemo(() => {
    return slots.filter(s => {
      if (s.coach_id !== activeCoachId) return false;
      if (selectedCentre !== 'All' && s.centre_id !== selectedCentre) return false;
      return true;
    });
  }, [slots, activeCoachId, selectedCentre]);

  // Normalize short vs long day names
  const normalizeDay = (day: string) => {
    if (!day) return 'Monday';
    const map: { [k: string]: string } = {
      'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday',
      'Monday': 'Monday', 'Tuesday': 'Tuesday', 'Wednesday': 'Wednesday', 'Thursday': 'Thursday', 'Friday': 'Friday', 'Saturday': 'Saturday', 'Sunday': 'Sunday'
    };
    return map[day] || day;
  };

  // Group slots by day for tabs
  const dailySlotsCount = useMemo(() => {
    const countMap: { [day: string]: number } = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    };
    filteredSlots.forEach(s => {
      const norm = normalizeDay(s.day);
      countMap[norm] = (countMap[norm] || 0) + 1;
    });
    return countMap;
  }, [filteredSlots]);

  // Display slot details for selected day
  const activeDaySlots = useMemo(() => {
    return filteredSlots.filter(s => normalizeDay(s.day) === normalizeDay(activeDay));
  }, [filteredSlots, activeDay]);

  const formatSlotTime = (t: string) => t ? t.split('::')[0] : '';

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
    const studentPkgs = packages.filter(p => p.student_id === studentId && !p.frozen);
    if (studentPkgs.length === 0) return true;
    const activePkgs = studentPkgs.filter(p => p.classes_remaining > 0 && p.kind !== 'unbilled' && p.kind !== 'settled');
    return activePkgs.length === 0;
  };

  // Filter and sort students for the roster modal (enrolled first)
  const rosterModalStudents = useMemo(() => {
    if (!rosterModalSlot) return [];
    
    // Get all active students for this center
    const centerStudents = students.filter(s => s.centre_id === rosterModalSlot.centre_id && s.status === 'active');
    
    // Map their enrollment status based on getSlotRoster to correctly identify previously present students
    const slotRoster = getSlotRoster(rosterModalSlot);
    const mapped = centerStudents.map(s => {
      const isEnrolled = slotRoster.some(rs => rs.id === s.id);
      return { student: s, isEnrolled };
    });

    // Filter by search query if any
    const filtered = rosterSearch
      ? mapped.filter(item => item.student.name.toLowerCase().includes(rosterSearch.toLowerCase()))
      : mapped;

    // Sort: Enrolled first, then alphabetically by name
    return filtered.sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return a.student.name.localeCompare(b.student.name);
    });
  }, [rosterModalSlot, students, enrollments, rosterSearch]);



  const getCentreName = (centreId: string) => {
    const match = centres.find(c => c.id === centreId);
    return match ? match.name : (centreId === 'c-2' || centreId === 'JLT' ? 'JLT' : 'Bay Avenue');
  };

  // Compute full week list and summation rows dynamically
  const fullWeekData = useMemo(() => {
    const list: any[] = [];
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedSlots = [...filteredSlots]
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
        time: formatSlotTime(slot.time),
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
  }, [filteredSlots, students, packages, centres]);

  const stats = useMemo(() => {
    const classesCount = filteredSlots.length;
    const markedCount = Object.values(markings).filter(v => v !== null).length;

    return {
      classesCount,
      totalPlaces: fullWeekData.totalStudents,
      zeroBalancePlaces: fullWeekData.totalZeroBalance,
      studentsTaught: fullWeekData.uniqueStudentsCount,
      markedCount,
    };
  }, [filteredSlots, fullWeekData, markings]);

  const handleMarkStatus = (slotId: string, studentId: string, status: 'present' | 'absent' | 'makeup' | 'informed') => {
    const key = `${slotId}-${studentId}`;
    const newStatus = markings[key] === status ? null : status;
    
    setMarkings(prev => ({
      ...prev,
      [key]: newStatus
    }));
  };

  const getDefaultDuration = (slot: ScheduleSlot) => {
    let timeStr = slot.time || '';
    if (timeStr.includes('::')) {
      const [t, d] = timeStr.split('::');
      return Number(d) || 1;
    }
    // calculate hours from timeStr
    const [start, end] = timeStr.split('-').map(t => t.trim());
    if (start && end) {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      if (!isNaN(sH) && !isNaN(eH)) {
        const diff = (eH - sH) + ((eM || 0) - (sM || 0)) / 60;
        return diff > 0 ? diff : 1;
      }
    }
    return 1;
  };

  const handleSaveAttendance = async (slotId: string) => {
    if (savingSlotId) return;
    setSavingSlotId(slotId);
    // Only save markings for students currently in this slot's roster
    const slot = slots.find(s => s.id === slotId);
    if (!slot) {
      setSaveStatus('❌ Error: Slot not found.');
      setTimeout(() => setSaveStatus(''), 4000);
      setSavingSlotId(null);
      return;
    }
    const rosterStudentIds = new Set(getSlotRoster(slot).map(s => s.id));
    const slotMarkings = Object.keys(markings).filter(key =>
      key.startsWith(slotId) && rosterStudentIds.has(key.substring(slotId.length + 1))
    );
    if (slotMarkings.length === 0) {
      setSaveStatus('❌ Error: No students marked for this class slot.');
      setTimeout(() => setSaveStatus(''), 4000);
      setSavingSlotId(null);
      return;
    }

    try {
      let savedCount = 0;
      // slot is already fetched above; use it directly

      const normDay = normalizeDay(slot.day);
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const dayIndex = dayOrder.indexOf(normDay);
      const slotDate = weekDates[dayIndex]?.isoDate;

      // Ensure the attendance date is not in the future compared to today's local date
      if (slotDate) {
        const today = new Date();
        const [ty, tm, td] = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
        const [ay, am, ad] = slotDate.split('-').map(Number);
        const todayVal = ty * 10000 + tm * 100 + td;
        const attVal  = ay * 10000 + am * 100 + ad;
        if (attVal > todayVal) {
          setSaveStatus(`❌ Error: Cannot log attendance for a future date (${slotDate}).`);
          setTimeout(() => setSaveStatus(''), 5000);
          setSavingSlotId(null);
          return;
        }
      }

      // Date floor validation: ensure attendance date is not prior to student's join date
      // (slotMarkings is already filtered to roster-only students so no stale entries)
      for (const key of slotMarkings) {
        const studentId = key.substring(slotId.length + 1);
        const student = students.find(s => s.id === studentId);
        if (student && student.join_date && slotDate) {
          // Parse as YYYY-MM-DD local date to avoid UTC midnight vs IST offset issues
          const [jy, jm, jd] = (typeof student.join_date === 'string'
            ? student.join_date.split('T')[0]
            : new Date(student.join_date).toISOString().split('T')[0]
          ).split('-').map(Number);
          const [ay, am, ad] = slotDate.split('-').map(Number);
          // Compare purely as YYYY-MM-DD numbers — no Date object timezone issues
          const joinVal = jy * 10000 + jm * 100 + jd;
          const attVal  = ay * 10000 + am * 100 + ad;
          if (attVal < joinVal) {
            const dateStr = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
            setSaveStatus(`❌ Error: Cannot back-date class for ${student.name} before their join date (${dateStr}).`);
            setTimeout(() => setSaveStatus(''), 5000);
            setSavingSlotId(null);
            return;
          }
        }
      }

      const duration = getDefaultDuration(slot);
      for (const key of slotMarkings) {
        const studentId = key.substring(slotId.length + 1);
        // Skip if student no longer exists in the db (stale marking from removed student)
        const studentExists = students.find(s => s.id === studentId);
        if (!studentExists) continue;
        const status = markings[key];
        const finalDuration = status === 'informed' ? 0 : duration;
        await logAttendance(studentId, status, activeCoachId, slotId, finalDuration, slotDate, classTopic);
        savedCount++;
      }
      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      loadData();
      setSaveStatus(`✓ Saved attendance for ${savedCount} students!`);
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err: any) {
      setSaveStatus(`❌ Error: ${err.message}`);
      setTimeout(() => setSaveStatus(''), 4000);
    } finally {
      setSavingSlotId(null);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Weekly Schedule...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">THIS WEEK</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Weekly Schedule</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex border border-line rounded-lg overflow-hidden bg-white text-xs">
            <button
              onClick={() => setScheduleTab('planner')}
              className={`px-4 py-2 font-semibold transition-all cursor-pointer ${
                scheduleTab === 'planner' ? 'bg-[#173F35] text-white' : 'text-muted-custom hover:bg-canvas'
              }`}
            >
              Planner Timetable
            </button>
            <button
              onClick={() => setScheduleTab('calendar')}
              className={`px-4 py-2 font-semibold transition-all cursor-pointer ${
                scheduleTab === 'calendar' ? 'bg-[#173F35] text-white' : 'text-muted-custom hover:bg-canvas'
              }`}
            >
              📅 Coach Calendar
            </button>
          </div>

          <select 
            value={selectedCentre}
            onChange={e => setSelectedCentre(e.target.value)}
            className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none cursor-pointer font-semibold"
          >
            <option value="All">All centres</option>
            {centres.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>


      <p className="text-xs text-muted-custom">
        {weekRangeText} · {activeCoach?.name.toUpperCase()} · {stats.classesCount} classes · {stats.totalPlaces} student-places
      </p>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface border border-line rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-custom uppercase">COACH</span>
          {currentUser.role === 'coach' ? (
            <div className="bg-canvas border border-line rounded-lg px-3 py-1 text-xs font-bold text-ink w-64">
              {activeCoach?.name.toUpperCase() || 'COACH'}
            </div>
          ) : (
            <select 
              value={selectedCoachId} 
              onChange={e => { setSelectedCoachId(e.target.value); localStorage.setItem('mmos_selected_coach_id', e.target.value); }}
              className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none w-64 cursor-pointer"
            >
              {coaches.map(c => (
                <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {(currentUser.role === 'owner' || currentUser.role === 'front_desk') && (
            <button
              onClick={() => setShowAddSlotModal(true)}
              className="bg-forest hover:bg-forest-light text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span> Add Class Slot
            </button>
          )}
          <button 
            onClick={() => exportTableToCSV(scheduleTab === 'planner' ? '#schedule-table' : '#calendar-table', scheduleTab === 'planner' ? 'weekly_schedule.csv' : 'coach_calendar.csv')}
            className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas cursor-pointer transition-all"
          >
            ↓ Excel
          </button>
          <button 
            onClick={() => exportToPDF()}
            className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas cursor-pointer transition-all"
          >
            ⎙ PDF
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${saveStatus.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {saveStatus}
        </div>
      )}

      {scheduleTab === 'planner' && (
        <>
          {/* Zero Balance Warning Notice */}
      {stats.zeroBalancePlaces > 0 && (
        <div className="p-4 rounded-[12px] bg-[#FBEEEA] border border-[#FBEEEA] border-l-4 border-l-hot-custom flex gap-3 text-xs leading-relaxed">
          <span className="text-xl">⚏</span>
          <div>
            <b className="text-hot-custom block font-bold">{stats.zeroBalancePlaces} student-places this week have zero classes remaining</b>
            <span className="text-[#6a4a41]">
              If they are marked Present, the platform creates an <b className="text-hot-custom">unbilled record</b> and alerts the front desk — it will not silently give the class away. Renew them before their next session.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* CLASSES THIS WEEK */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] before:bg-forest">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Classes This Week</div>
          <h2 className="text-2xl font-bold font-display text-ink mt-1.5">
            {stats.classesCount}
          </h2>
          <p className="text-[10px] text-muted-custom mt-1">{stats.totalPlaces} student-places</p>
        </div>

        {/* MARKED */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] before:bg-warm-custom">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Marked</div>
          <h2 className="text-2xl font-bold font-display text-forest mt-1.5">
            {stats.markedCount}
          </h2>
          <p className="text-[10px] text-muted-custom mt-1">
            {stats.markedCount > 0 ? `${stats.markedCount} marked so far` : 'nothing marked yet'}
          </p>
        </div>

        {/* ZERO-BALANCE PLACES */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] before:bg-hot-custom">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Zero-Balance Places</div>
          <h2 className="text-2xl font-bold font-display text-hot-custom mt-1.5">
            {stats.zeroBalancePlaces}
          </h2>
          <p className="text-[10px] text-muted-custom mt-1">will raise unbilled records</p>
        </div>

        {/* STUDENTS TAUGHT */}
        <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] before:bg-brass">
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
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center cursor-pointer ${
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
                    <span className="font-mono font-bold text-sm text-ink">{formatSlotTime(slot.time)}</span>
                    <div>
                      <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                        {slot.level || 'Unassigned level'}
                        {slot.is_summer_camp && isSummerCampGloballyActive && (
                          <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            ☀️ Summer Camp
                          </span>
                        )}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRosterModalSlot(slot);
                      }}
                      className="bg-white border border-line hover:bg-canvas text-ink text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors"
                    >
                      ⚙ Manage Roster
                    </button>
                    <span className="text-[10px] font-bold text-muted-custom font-mono">
                      {Object.keys(markings).filter(k => k.startsWith(slot.id) && markings[k] !== null).length} / {roster.length} marked
                    </span>
                    <span className="text-muted-custom text-xs">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {/* Expanded Roster Dropdown Panel */}
                {isExpanded && (
                  <div className="border-t border-line bg-canvas/10 p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <span className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">
                        Enrolled Students ({roster.length})
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRosterModalSlot(slot);
                        }}
                        className="bg-forest hover:bg-forest-light text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>⚙</span> Manage Class Roster
                      </button>
                    </div>
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
                          disabled={savingSlotId === slot.id}
                          onClick={() => handleSaveAttendance(slot.id)}
                          className={`bg-[#173F35] hover:bg-[#122f28] text-white font-bold text-xs px-4 py-2 rounded-lg transition-all ${
                            savingSlotId === slot.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {savingSlotId === slot.id ? 'Saving...' : 'Save attendance'}
                        </button>

                        {isSummerCampGloballyActive && (
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink cursor-pointer bg-white border border-line px-3 py-2 rounded-lg hover:bg-canvas transition-all select-none">
                            <input
                              type="checkbox"
                              checked={slot.is_summer_camp || false}
                              onChange={async (e) => {
                                const checked = e.target.checked;
                                const existing = db.getScheduleSlots();
                                const sIdx = existing.findIndex(s => s.id === slot.id);
                                
                                const baseTime = slot.time.split('::')[0];
                                const newTime = checked ? `${baseTime}::1` : baseTime;
                                
                                if (sIdx !== -1) {
                                  existing[sIdx].is_summer_camp = checked;
                                  existing[sIdx].time = newTime;
                                  db.save('schedule_slots', existing);
                                  setSlots([...existing]); // Trigger UI update immediately
                                }
                                try {
                                  await toggleSummerCampSlot(slot.id, checked, newTime);
                                } catch (err) {
                                  console.error("Failed to toggle summer camp on server:", err);
                                }
                              }}
                              className="rounded border-line text-forest focus:ring-forest w-4 h-4 cursor-pointer"
                            />
                            <span>Summer Camp Class ☀️</span>
                          </label>
                        )}

                        {slot.is_summer_camp && isSummerCampGloballyActive && (
                          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-2 py-1.5 rounded-lg text-xs">
                            <span className="font-semibold text-ink">Deduct:</span>
                            <input
                              type="number"
                              min={1}
                              value={getDefaultDuration(slot)}
                              onChange={async (e) => {
                                const newDed = Number(e.target.value);
                                if (!newDed || newDed < 1) return;
                                const baseTime = slot.time.split('::')[0];
                                const newTime = `${baseTime}::${newDed}`;
                                const existing = db.getScheduleSlots();
                                const sIdx = existing.findIndex(s => s.id === slot.id);
                                if (sIdx !== -1) {
                                  existing[sIdx].time = newTime;
                                  db.save('schedule_slots', existing);
                                  setSlots([...existing]); 
                                }
                                try {
                                  await toggleSummerCampSlot(slot.id, true, newTime);
                                } catch (err) {
                                  console.error("Failed to update deduction amount:", err);
                                }
                              }}
                              className="w-12 border border-line rounded px-1.5 py-0.5 text-center outline-none bg-white focus:border-forest text-ink"
                            />
                            <span className="text-muted-custom">classes</span>
                          </div>
                        )}

                        <button
                          onClick={() => router.push(`/progress?slotId=${slot.id}`)}
                          className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
                        >
                          Log progress
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              setSaveStatus('Sending class notifications to enrolled students...');
                              const res = await notifyEnrolledStudents(slot.id);
                              const freshData = await syncDatabaseToClient();
                              db.syncFromNeon(freshData);
                              loadData();
                              setSaveStatus(`✓ WhatsApp & Email reminders sent to ${res.count} parents!`);
                              setTimeout(() => setSaveStatus(''), 5000);
                            } catch (err: any) {
                              setSaveStatus(`❌ Error: ${err.message}`);
                              setTimeout(() => setSaveStatus(''), 5000);
                            }
                          }}
                          className="bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>📢</span> Notify Enrolled
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
            <button 
              onClick={() => exportTableToCSV('#schedule-table', 'weekly_schedule_full.csv')}
              className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas cursor-pointer transition-all"
            >
              ↓ Excel
            </button>
            <button 
              onClick={() => exportToPDF()}
              className="bg-white border border-line text-[#5c5c5c] font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas cursor-pointer transition-all"
            >
              ⎙ PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table id="schedule-table" className="w-full border-collapse text-xs">
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
                  <td className="py-2.5 px-3 cursor-pointer hover:underline text-[#173F35]" onClick={() => { setActiveDay(normalizeDay(row.day)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
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
        </>
      )}

      {/* COACH CALENDAR TAB */}
      {scheduleTab === 'calendar' && (
        <div className="space-y-6">
          
          {/* Calendar Toolbar */}
          <div className="bg-surface border border-line rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex bg-canvas rounded-lg p-0.5 border border-line">
                {(['day', 'week', 'month', 'term'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setCalendarViewMode(mode)}
                    className={`px-3.5 py-1.5 rounded-md font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      calendarViewMode === mode 
                        ? 'bg-[#173F35] text-white shadow-sm' 
                        : 'text-muted-custom hover:text-ink'
                    }`}
                  >
                    {mode === 'term' ? 'Term-wise' : mode}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleNavigateCalendar(-1)}
                  className="bg-white border border-line hover:bg-canvas text-ink p-1.5 rounded-lg font-bold text-xs"
                >
                  ◀ Prev
                </button>
                <button
                  onClick={() => setAnchorCalendarDate(new Date())}
                  className="bg-white border border-line hover:bg-canvas text-ink px-3 py-1.5 rounded-lg font-bold text-xs"
                >
                  Today
                </button>
                <button
                  onClick={() => handleNavigateCalendar(1)}
                  className="bg-white border border-line hover:bg-canvas text-ink p-1.5 rounded-lg font-bold text-xs"
                >
                  Next ▶
                </button>
              </div>
            </div>

            <div className="text-sm font-bold font-display text-ink uppercase tracking-wider">
              {getCalendarTitle()}
            </div>
          </div>

          {/* Day View */}
          {calendarViewMode === 'day' && (
            <div className="bg-surface border border-line rounded-xl p-5 space-y-4 shadow-sm max-w-xl mx-auto font-medium text-ink">
              <div className="text-xs font-bold text-ink border-b border-line pb-2 flex justify-between">
                <span>Class Timetable</span>
                <span className="font-mono text-muted-custom">{anchorCalendarDate.toLocaleDateString()}</span>
              </div>
              {(() => {
                const dateStr = formatLocalDate(anchorCalendarDate);
                const daySessions = coachSessions.filter(s => formatDbDate(s.scheduled_date) === dateStr);
                if (daySessions.length === 0) {
                  return <p className="text-xs text-muted-custom italic text-center py-12">No classes scheduled for this day.</p>;
                }
                return (
                  <div className="space-y-3 font-medium text-ink">
                    {daySessions.map(sess => {
                      const slot = slots.find(s => s.id === sess.slot_id);
                      const student = students.find(s => s.id === sess.student_id);
                      if (!student || !slot) return null;
                      return (
                        <div key={sess.id} className="bg-canvas border border-line rounded-xl p-4 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="font-mono font-bold text-sm text-ink">{slot.time?.split('::')[0]}</span>
                            <h4 className="font-bold text-ink text-sm">{student.name}</h4>
                            <p className="text-[10px] text-muted-custom">{slot.level} · {slot.day}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                              sess.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : sess.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200'
                              : sess.status === 'rescheduled' ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                            }`}>
                              {sess.status}
                            </span>
                            {sess.status === 'scheduled' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setRescheduleSessionId(sess.id);
                                    setRescheduleDate(formatDbDate(sess.scheduled_date));
                                    setRescheduleNote('');
                                    setShowRescheduleModal(true);
                                  }}
                                  className="bg-white border border-line text-amber-700 font-semibold px-2.5 py-1 rounded text-xs hover:bg-canvas"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => handleCancel(sess.id)}
                                  className="bg-white border border-line text-red-700 font-semibold px-2.5 py-1 rounded text-xs hover:bg-canvas"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Week View */}
          {calendarViewMode === 'week' && (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
              <table id="calendar-table" className="w-full text-xs border-collapse min-w-[1000px] table-fixed">
                <thead>
                  <tr className="bg-canvas border-b border-line text-[10px] font-bold text-muted-custom uppercase tracking-wider">
                    <th className="py-3 px-2 border-r border-line w-36 text-center bg-canvas/60">Time Slot</th>
                    {(() => {
                      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                      return daysOfWeek.map((dayName, idx) => {
                        const startOfWeek = new Date(anchorCalendarDate);
                        const day = startOfWeek.getDay();
                        const diff = day === 0 ? -6 : 1 - day;
                        startOfWeek.setDate(startOfWeek.getDate() + diff + idx);
                        const dayNum = startOfWeek.getDate();
                        const monthName = startOfWeek.toLocaleDateString(undefined, { month: 'short' });
                        
                        return (
                          <th key={dayName} className="py-3 px-2 border-r border-line last:border-r-0 text-left w-[13.5%]">
                            <div className="font-extrabold text-ink">{dayName}</div>
                            <div className="text-[9px] text-muted-custom mt-0.5 normal-case font-medium">
                              {dayNum} {monthName}
                            </div>
                          </th>
                        );
                      });
                    })()}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {(() => {
                    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    const daysData = daysOfWeek.map((dayName, idx) => {
                      const startOfWeek = new Date(anchorCalendarDate);
                      const day = startOfWeek.getDay();
                      const diff = day === 0 ? -6 : 1 - day;
                      startOfWeek.setDate(startOfWeek.getDate() + diff + idx);
                      const dateStr = formatLocalDate(startOfWeek);
                      return { dayName, dateStr };
                    });

                    // Hourly row hours from 8:00 AM (8) to 8:00 PM (20)
                    const rowHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

                    const formatHourLabel = (h: number) => {
                      const start = h % 12 === 0 ? 12 : h % 12;
                      const end = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
                      const startAmPm = h >= 12 ? 'PM' : 'AM';
                      const endAmPm = (h + 1) >= 12 ? 'PM' : 'AM';
                      return `${start}:00 ${startAmPm} - ${end}:00 ${endAmPm}`;
                    };

                    return rowHours.map(hour => {
                      return (
                        <tr key={hour} className="hover:bg-canvas/5 align-top transition-colors">
                          <td className="py-4 px-2 border-r border-line font-bold text-[#173F35] text-xs text-center bg-canvas/20 w-36 align-middle">
                            {formatHourLabel(hour)}
                          </td>
                          {daysData.map(({ dayName, dateStr }) => {
                            const daySessions = coachSessions.filter(s => formatDbDate(s.scheduled_date) === dateStr);
                            const cellSessions = daySessions.filter(sess => {
                              const slot = slots.find(sl => sl.id === sess.slot_id);
                              if (!slot) return false;
                              if (selectedCentre !== 'All' && slot.centre_id !== selectedCentre) return false;
                              const cleanTime = slot.time.split('::')[0];
                              const startHour = parseInt(cleanTime.split(':')[0], 10);
                              return startHour === hour;
                            });

                            return (
                              <td key={dayName} className="p-2 border-r border-line last:border-r-0 align-top space-y-1.5 min-h-[70px]">
                                {cellSessions.map(sess => {
                                  const slot = slots.find(s => s.id === sess.slot_id);
                                  const student = students.find(s => s.id === sess.student_id);
                                  if (!student || !slot) return null;

                                  return (
                                    <div key={sess.id} className="bg-canvas border border-[#173F35]/15 p-2 rounded-lg space-y-1 relative group hover:shadow-sm transition-all">
                                      <div className="font-mono font-bold text-[9px] text-[#C4A249] flex items-center justify-between">
                                        <span>{slot.time?.split('::')[0]}</span>
                                        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                                          getCentreName(slot.centre_id).toLowerCase().includes('bay') 
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        }`}>
                                          {getCentreName(slot.centre_id).toLowerCase().includes('bay') ? 'BA' : 'JLT'}
                                        </span>
                                      </div>
                                      <div className="text-[10px] font-bold text-[#173F35] truncate">{student.name}</div>
                                      <div className="text-[9px] text-muted-custom truncate">Level: {slot.level}</div>
                                      <div className="flex justify-between items-center pt-1 border-t border-line mt-1">
                                        <span className={`text-[7px] font-bold px-1 py-0.2 rounded uppercase ${
                                          sess.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : sess.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200'
                                          : sess.status === 'rescheduled' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}>
                                          {sess.status}
                                        </span>
                                        {sess.status === 'scheduled' && (
                                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={() => {
                                                setRescheduleSessionId(sess.id);
                                                setRescheduleDate(formatDbDate(sess.scheduled_date));
                                                setRescheduleNote('');
                                                setShowRescheduleModal(true);
                                              }}
                                              title="Reschedule"
                                              className="text-amber-600 hover:text-amber-800 text-[9px] font-bold cursor-pointer"
                                            >
                                              ✎
                                            </button>
                                            <button
                                              onClick={() => handleCancel(sess.id)}
                                              title="Cancel"
                                              className="text-red-600 hover:text-red-800 text-[9px] font-bold cursor-pointer"
                                            >
                                              ✗
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Month View */}
          {calendarViewMode === 'month' && (
            <div className="space-y-4">
              {/* Month Summary Card */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <div>
                    <h4 className="font-bold text-ink text-xs uppercase tracking-wider">Month Summary</h4>
                    <p className="text-[10px] text-muted-custom">Classes scheduled in this month</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#173F35] font-mono">{monthSessionsCount}</span>
                  <span className="text-[10px] text-muted-custom font-bold uppercase tracking-wider block">Total Classes</span>
                </div>
              </div>

              <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm font-medium text-ink">
                <div className="grid grid-cols-7 border-b border-line bg-canvas text-center py-2 text-xs font-bold text-ink uppercase">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 text-xs">
                  {monthCells.map((cell, idx) => {
                    const dateStr = formatLocalDate(cell.date);
                    const daySessions = coachSessions.filter(s => formatDbDate(s.scheduled_date) === dateStr);

                    return (
                      <div
                        key={idx}
                        className={`min-h-[100px] border-b border-r border-line p-2 flex flex-col justify-between transition-all hover:bg-canvas/5 ${
                          cell.isCurrentMonth ? 'bg-white' : 'bg-canvas/40 text-muted-custom'
                        }`}
                      >
                        <span className="font-mono font-bold text-[10px] self-end text-ink">{cell.date.getDate()}</span>
                        
                        {daySessions.length > 0 && (
                          <div className="flex-1 flex flex-col justify-end mt-1 space-y-1">
                            <div className="text-[9px] font-extrabold bg-[#173F35]/10 text-[#173F35] px-1.5 py-0.5 rounded text-center border border-[#173F35]/15">
                              {daySessions.length} {daySessions.length === 1 ? 'Class' : 'Classes'}
                            </div>
                            <div className="space-y-0.5 max-h-[45px] overflow-hidden">
                              {daySessions.slice(0, 2).map(sess => {
                                const student = students.find(s => s.id === sess.student_id);
                                if (!student) return null;
                                return (
                                  <div key={sess.id} className="text-[8px] text-muted-custom font-semibold truncate">
                                    • {student.name}
                                  </div>
                                );
                              })}
                              {daySessions.length > 2 && (
                                <div className="text-[7px] text-[#C4A249] font-bold text-center">
                                  + {daySessions.length - 2} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Term View */}
          {calendarViewMode === 'term' && (
            <div className="space-y-4 font-medium text-ink">
              {(() => {
                const studentSessions: Record<string, typeof coachSessions> = {};
                coachSessions.forEach(s => {
                  if (!studentSessions[s.student_id]) studentSessions[s.student_id] = [];
                  studentSessions[s.student_id].push(s);
                });

                const activeStudentIds = Object.keys(studentSessions);
                if (activeStudentIds.length === 0) {
                  return <div className="p-12 text-center bg-surface border border-line rounded-2xl text-muted-custom text-xs">No active projected sessions for this coach.</div>;
                }

                return activeStudentIds.map(stId => {
                  const student = students.find(s => s.id === stId);
                  if (!student) return null;
                  const sessions = [...studentSessions[stId]].sort((a,b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

                  return (
                    <div key={stId} className="bg-surface border border-line rounded-xl p-5 shadow-sm space-y-4">
                      <div className="border-b border-line pb-2 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-ink text-sm">{student.name}</h3>
                          <p className="text-[10px] text-muted-custom">{student.level} · {getCentreName(student.centre_id)}</p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-line bg-canvas text-muted-custom uppercase">
                          {sessions.length} sessions projected
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {sessions.map((sess, index) => {
                          const dateObj = new Date(sess.scheduled_date);
                          const displayDate = dateObj.toLocaleDateString(undefined, {month:'short', day:'numeric'});
                          return (
                            <div key={sess.id} className="bg-canvas border border-line p-2.5 rounded-lg space-y-1.5 relative group">
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] font-bold text-muted-custom font-mono">Class {index + 1}</span>
                                <span className={`text-[7px] font-bold px-1 rounded uppercase ${
                                  sess.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                                  : sess.status === 'cancelled' ? 'bg-red-50 text-red-700'
                                  : sess.status === 'rescheduled' ? 'bg-amber-50 text-amber-700'
                                  : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {sess.status === 'rescheduled' ? 'resch.' : sess.status}
                                </span>
                              </div>
                              <div className="font-mono font-bold text-[10px] text-ink">{displayDate}</div>
                              {sess.note && <div className="text-[7px] text-muted-custom italic truncate" title={sess.note}>{sess.note}</div>}

                              {sess.status === 'scheduled' && (
                                <div className="flex gap-2 border-t border-line/50 pt-1.5 mt-1.5 justify-end">
                                  <button
                                    onClick={() => {
                                      setRescheduleSessionId(sess.id);
                                      setRescheduleDate(formatDbDate(sess.scheduled_date));
                                      setRescheduleNote('');
                                      setShowRescheduleModal(true);
                                    }}
                                    className="text-amber-700 hover:text-amber-900 text-[9px] font-bold"
                                  >
                                    Reschedule
                                  </button>
                                  <button
                                    onClick={() => handleCancel(sess.id)}
                                    className="text-red-700 hover:text-red-900 text-[9px] font-bold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-line p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink text-base flex items-center gap-2 font-display">
                <span className="text-forest">✎</span> Reschedule Class Session
              </h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="w-7 h-7 rounded-full bg-canvas border border-line flex items-center justify-center text-ink font-bold hover:bg-line text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink text-xs">New Scheduled Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="bg-white border border-[#173F35]/20 rounded-lg px-3 py-2 text-ink outline-none text-xs focus:border-forest"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink text-xs">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Rescheduled due to travel..."
                  value={rescheduleNote}
                  onChange={e => setRescheduleNote(e.target.value)}
                  className="bg-white border border-[#173F35]/20 rounded-lg px-3 py-2 text-ink outline-none text-xs focus:border-forest"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-line flex gap-3">
              <button
                onClick={handleReschedule}
                className="flex-1 bg-[#173F35] hover:bg-[#122f28] text-white font-bold py-2.5 rounded-xl transition-all text-xs"
              >
                Reschedule Session
              </button>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="bg-white border border-line text-ink font-bold px-4 py-2.5 rounded-xl hover:bg-canvas text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {rosterModalSlot.day} {formatSlotTime(rosterModalSlot.time)} · {rosterModalSlot.level} ({getCentreName(rosterModalSlot.centre_id)})
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
                             onChange={async (e) => {
                               const checked = e.target.checked;
                               try {
                                 if (checked) {
                                   const uuid = typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
                                   db.saveEnrollment({
                                     id: `enr-${uuid}`,
                                     student_id: student.id,
                                     slot_id: rosterModalSlot.id,
                                     enrolled_at: new Date().toISOString()
                                   });
                                   setEnrollments(db.getEnrollments());
                                   await enrollStudent(student.id, rosterModalSlot.id);
                                 } else {
                                   db.removeEnrollment(student.id, rosterModalSlot.id);
                                   setEnrollments(db.getEnrollments());
                                   await unenrollStudent(student.id, rosterModalSlot.id);
                                 }
                                 const freshData = await syncDatabaseToClient();
                                 db.syncFromNeon(freshData);
                                 setEnrollments(db.getEnrollments());
                               } catch (err: any) {
                                 console.error("Enrollment failed:", err);
                                 alert("Roster update failed: " + err.message);
                                 const freshData = await syncDatabaseToClient();
                                 db.syncFromNeon(freshData);
                                 setEnrollments(db.getEnrollments());
                               }
                             }}
                            className="w-4 h-4 rounded border-line text-forest focus:ring-forest cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-xs text-ink block">
                              {student.name}
                              {student.level && rosterModalSlot.level && !student.level.toLowerCase().startsWith(rosterModalSlot.level.toLowerCase()) && !rosterModalSlot.level.toLowerCase().startsWith(student.level.toLowerCase()) && (
                                <span className="inline-block ml-2 text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2" title={`Class level: ${rosterModalSlot.level}`}>
                                  ⚠️ Level Mismatch
                                </span>
                              )}
                            </span>
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

      {/* Add Class Slot Modal */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-line p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-ink text-base flex items-center gap-2 font-display">
                <span className="text-forest">+</span> Create New Class Slot
              </h3>
              <button
                onClick={() => setShowAddSlotModal(false)}
                className="w-7 h-7 rounded-full bg-canvas border border-line flex items-center justify-center text-ink font-bold hover:bg-line text-xs"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const targetCoachId = newSlotCoachId || selectedCoachId || (coaches[0]?.id || '');
                const targetCentreId = newSlotCentreId || (centres[0]?.id || 'c-1');
                
                try {
                  const baseTime = `${newSlotStartTime} - ${newSlotEndTime}`;
                  const finalTime = newSlotIsSummerCamp ? `${baseTime}::${newSlotSummerDeduction}` : baseTime;

                  const newSlot: ScheduleSlot = {
                    id: `slot-${crypto.randomUUID()}`,
                    centre_id: targetCentreId,
                    coach_id: targetCoachId,
                    day: newSlotDay,
                    time: finalTime,
                    level: newSlotLevel,
                    capacity: newSlotCapacity,
                    is_summer_camp: newSlotIsSummerCamp
                  };

                  const existingSlots = db.getScheduleSlots();
                  existingSlots.push(newSlot);
                  db.save('schedule_slots', existingSlots);
                  
                  try {
                    await createScheduleSlot(targetCentreId, targetCoachId, newSlotDay, finalTime, newSlotLevel, newSlotCapacity, newSlotIsSummerCamp, newSlot.id);
                  } catch (err) {
                    console.warn("Server createScheduleSlot fallback:", err);
                  }

                  db.logAudit('create_schedule_slot', 'schedule_slots', null, newSlot);
                  window.dispatchEvent(new Event('db-synced'));
                  
                  setShowAddSlotModal(false);
                  setSaveStatus(`✓ Class slot created: ${newSlotDay} ${formatSlotTime(finalTime)} (${newSlotLevel})`);
                  setTimeout(() => setSaveStatus(''), 4000);
                } catch (err: any) {
                  alert("Error creating slot: " + err.message);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink">Day of Week *</label>
                <select
                  value={newSlotDay}
                  onChange={(e: any) => setNewSlotDay(e.target.value)}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none"
                >
                  <option value="Mon">Monday (Mon)</option>
                  <option value="Tue">Tuesday (Tue)</option>
                  <option value="Wed">Wednesday (Wed)</option>
                  <option value="Thu">Thursday (Thu)</option>
                  <option value="Fri">Friday (Fri)</option>
                  <option value="Sat">Saturday (Sat)</option>
                  <option value="Sun">Sunday (Sun)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink">Start Time *</label>
                  <input
                    type="time"
                    value={newSlotStartTime}
                    onChange={(e) => setNewSlotStartTime(e.target.value)}
                    required
                    className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink">End Time *</label>
                  <input
                    type="time"
                    value={newSlotEndTime}
                    onChange={(e) => setNewSlotEndTime(e.target.value)}
                    required
                    className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink">Level *</label>
                  <select
                    value={newSlotLevel}
                    onChange={(e) => setNewSlotLevel(e.target.value)}
                    className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none"
                  >
                    <option value="Beginner 1">Beginner 1</option>
                    <option value="Beginner 2">Beginner 2</option>
                    <option value="Intermediate 1">Intermediate 1</option>
                    <option value="Intermediate 2">Intermediate 2</option>
                    <option value="Advanced">Advanced</option>
                    <option value="FIDE">FIDE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink">Coach *</label>
                  <select
                    value={newSlotCoachId || selectedCoachId}
                    onChange={(e) => setNewSlotCoachId(e.target.value)}
                    className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none"
                  >
                    {coaches.map(c => (
                      <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink">Centre *</label>
                  <select
                    value={newSlotCentreId || selectedCentre === 'All' ? (centres[0]?.id || '') : selectedCentre}
                    onChange={(e) => setNewSlotCentreId(e.target.value)}
                    className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none"
                    required
                  >
                    {centres.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink">Seat Capacity</label>
                <input
                  type="number"
                  value={newSlotCapacity}
                  onChange={(e) => setNewSlotCapacity(Number(e.target.value))}
                  min={1}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 py-1">
                {isSummerCampGloballyActive && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="newSlotIsSummerCamp"
                      checked={newSlotIsSummerCamp}
                      onChange={(e) => setNewSlotIsSummerCamp(e.target.checked)}
                      className="rounded border-line text-forest focus:ring-forest w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="newSlotIsSummerCamp" className="font-bold text-ink cursor-pointer select-none">
                      Mark as Summer Camp Class ☀️
                    </label>
                  </div>
                )}
                {newSlotIsSummerCamp && isSummerCampGloballyActive && (
                  <div className="flex flex-col gap-1.5 mt-2 ml-6 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <label className="font-bold text-ink text-xs">Classes to deduct per attendance</label>
                    <input
                      type="number"
                      value={newSlotSummerDeduction}
                      onChange={(e) => setNewSlotSummerDeduction(Number(e.target.value))}
                      min={1}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-ink outline-none w-32"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-line flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-forest hover:bg-forest-light text-white font-bold py-2.5 rounded-xl transition-all"
                >
                  Create Class Slot
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSlotModal(false)}
                  className="bg-white border border-line text-ink font-bold px-4 py-2.5 rounded-xl hover:bg-canvas"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Schedule;
