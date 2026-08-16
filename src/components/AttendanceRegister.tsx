"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, Coach, Centre } from '../lib/db';
import { updateAttendanceDB, deleteAttendanceDB, syncDatabaseToClient } from '../app/actions';
import { exportTableToCSV, exportToPDF } from '../lib/export';
interface AttendanceRegisterProps {
  currentUser: User;
  activeCentre: string;
}

export const AttendanceRegister: React.FC<AttendanceRegisterProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  // Filters
  const [filterCentre, setFilterCentre] = useState<string>('All centres');
  const [filterCoach, setFilterCoach] = useState<string>('All coaches');
  const [filterSegment, setFilterSegment] = useState<string>('All segments');
  const [filterEngagement, setFilterEngagement] = useState<string>('All engagement');
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'students' | 'logs'>('students');

  const handleResetFilters = () => {
    setFilterCentre('All centres');
    setFilterCoach('All coaches');
    setFilterSegment('All segments');
    setFilterEngagement('All engagement');
    setSearch('');
  };

  // Sorting
  const [sortCol, setSortCol] = useState<string>('studentName');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Editing state
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentLogs, setStudentLogs] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedStudent) {
      const logs = attendance.filter(a => a.student_id === selectedStudent.id);
      setStudentLogs(logs);
    } else {
      setStudentLogs([]);
    }
  }, [selectedStudent, attendance]);

  const handleUpdateStatus = async (logId: string, newStatus: string) => {
    try {
      await updateAttendanceDB(logId, newStatus);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setMessage({ text: '✓ Attendance record updated.', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
      setMessage({ text: 'Error updating attendance: ' + e.message, type: 'error' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (deleteConfirmId !== logId) {
      setDeleteConfirmId(logId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }
    try {
      await deleteAttendanceDB(logId);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setDeleteConfirmId(null);
      setMessage({ text: '✓ Attendance record deleted.', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
      setMessage({ text: 'Error deleting attendance: ' + e.message, type: 'error' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const refresh = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
    setAttendance(db.getAttendance());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('db-synced', refresh);
    return () => window.removeEventListener('db-synced', refresh);
  }, []);

  // Sync activeCentre prop -> filter
  useEffect(() => {
    if (activeCentre && activeCentre !== 'All') {
      const match = db.getCentres().find(c => c.id === activeCentre);
      if (match) {
        setFilterCentre(match.name);
      }
    } else {
      setFilterCentre('All centres');
    }
  }, [activeCentre]);

  // Enrich student records with attendance metrics
  const enriched = useMemo(() => {
    const today = new Date();
    return students.map(s => {
      const centre = centres.find(c => c.id === s.centre_id);
      const coach = coaches.find(c => c.id === s.coach_id);
      const centreName = centre?.name || '—';
      const coachName = coach?.name ? coach.name.toUpperCase() : 'UNASSIGNED';

      // Auto-generated BAY/JLT style ID
      const prefix = (centre?.name || 'BAY').slice(0, 3).toUpperCase();
      const numPart = s.fide_id || s.id.replace(/\D/g, '').slice(0, 3) || '000';
      const displayId = s.flags?.custom_student_id || `${prefix}-${numPart}`;

      // Days since last class
      const daysSince = s.last_attended
        ? Math.max(0, Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000))
        : 999;

      // Calculate 30D and 90D attendance metrics from real records (counting rows, status in ['present', 'absent', 'makeup'])
      const studentAtts = attendance.filter(a => a.student_id === s.id && ['present', 'absent', 'makeup'].includes(a.status));
      let cls30d = 0;
      let cls90d = 0;

      studentAtts.forEach(a => {
        const attDate = new Date(a.date);
        const diffDays = Math.floor((today.getTime() - attDate.getTime()) / 86400000);
        const amt = typeof a.duration === 'number' ? a.duration : 1;
        if (diffDays >= -1 && diffDays <= 30) cls30d += amt;
        if (diffDays >= -1 && diffDays <= 90) cls90d += amt;
      });

      // Classes left across packages
      const pkgs = packages.filter(p => p.student_id === s.id && !p.frozen);
      const classesLeft = pkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

      // Segment calculation
      const segment = s.level === 'Pro-Track' ? 'Pro-Track'
        : s.level === 'Advanced' ? 'Juniors-Advanced'
        : s.level === 'Intermediate' ? 'Juniors-Intermediate B'
        : 'Early Starters-Beginner 2';

      // Engagement status pill
      const engagement = daysSince <= 14 ? 'ENGAGED'
        : daysSince <= 30 ? 'SLIPPING'
        : daysSince <= 60 ? 'COLD'
        : 'DORMANT';

      return {
        id: s.id,
        studentName: s.name,
        displayId: displayId || '—',
        centreName,
        coachName,
        level: s.level || '—',
        segment,
        engagement,
        cls30d,
        cls90d,
        daysSince: daysSince === 999 ? null : daysSince,
        lastClass: s.last_attended ? new Date(s.last_attended).toISOString().split('T')[0] : '—',
        classesLeft,
      };
    });
  }, [students, packages, coaches, centres, attendance]);

  // Filter and sort the enriched list
  const filtered = useMemo(() => {
    let rows = enriched;

    if (filterCentre !== 'All centres') {
      rows = rows.filter(r => r.centreName === filterCentre);
    }
    if (filterCoach !== 'All coaches') {
      rows = rows.filter(r => r.coachName.toUpperCase() === filterCoach.toUpperCase());
    }
    if (filterSegment !== 'All segments') {
      rows = rows.filter(r => r.segment === filterSegment);
    }
    if (filterEngagement !== 'All engagement') {
      rows = rows.filter(r => r.engagement === filterEngagement);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => 
        r.studentName.toLowerCase().includes(q) || 
        r.displayId.toLowerCase().includes(q)
      );
    }

    return rows.sort((a, b) => {
      let av = a[sortCol];
      let bv = b[sortCol];

      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [enriched, filterCentre, filterCoach, filterSegment, filterEngagement, search, sortCol, sortAsc]);

  // Memoized consolidated logs list of all days
  const filteredLogs = useMemo(() => {
    let rows = attendance.map(log => {
      const student = students.find(s => s.id === log.student_id);
      const studentName = student?.name || 'Unknown';
      
      const centre = centres.find(c => c.id === student?.centre_id);
      const centreName = centre?.name || '—';
      
      const coach = coaches.find(c => c.id === log.coach_id);
      const coachName = coach?.name || 'UNASSIGNED';

      return {
        ...log,
        studentName,
        centreName,
        coachName
      };
    });

    if (filterCentre !== 'All centres') {
      rows = rows.filter(r => r.centreName === filterCentre);
    }
    if (filterCoach !== 'All coaches') {
      rows = rows.filter(r => r.coachName.toUpperCase() === filterCoach.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => 
        r.studentName.toLowerCase().includes(q) || 
        r.topic?.toLowerCase().includes(q)
      );
    }

    // Sort by date descending
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendance, students, coaches, centres, filterCentre, filterCoach, search]);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const SortTh = ({ col, children, right }: { col: string; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`text-[9px] font-bold text-muted-custom tracking-widest uppercase py-3 px-4 cursor-pointer select-none hover:text-ink whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {children}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  const engagementBadge = (eng: string) => {
    switch (eng) {
      case 'NEW':
        return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'ENGAGED':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'SLIPPING':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'COLD':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'DORMANT':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const uniqueCoaches = useMemo(() => {
    return [...new Set(enriched.map(r => r.coachName))].sort();
  }, [enriched]);

  const uniqueSegments = useMemo(() => {
    return [...new Set(enriched.map(r => r.segment))].sort();
  }, [enriched]);

  const parentChild = useMemo(() => {
    return students[0] || null;
  }, [students]);

  const childLogs = useMemo(() => {
    if (!parentChild) return [];
    return attendance.filter(a => a.student_id === parentChild.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [parentChild, attendance]);

  const parentCoach = useMemo(() => {
    if (!parentChild || !parentChild.coach_id) return null;
    return coaches.find(c => c.id === parentChild.coach_id) || null;
  }, [parentChild, coaches]);

  if (currentUser.role === 'parent') {
    return (
      <div className="p-8 max-w-5xl mx-auto w-full space-y-6 text-ink">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">PARENT PORTAL</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Attendance Register</h1>
          <p className="text-xs text-muted-custom mt-1">
            Viewing attendance logs for <b className="text-ink">{parentChild?.name}</b> · Coach: {parentCoach?.name || 'Unassigned'}
          </p>
        </div>

        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
              <span className="text-forest">♞</span> Class Logs
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => exportTableToCSV('#parent-attendance-table', 'attendance.csv')}
                className="bg-white border border-line text-ink font-bold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1 cursor-pointer transition-all"
              >
                ↓ Excel
              </button>
              <button 
                onClick={exportToPDF}
                className="bg-white border border-line text-ink font-bold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1 cursor-pointer transition-all"
              >
                ⎙ PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table id="parent-attendance-table" className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-left text-muted-custom text-[9px] uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3 w-12">S.No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Topic</th>
                  <th className="py-2.5 px-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {childLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-custom">
                      No attendance logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  childLogs.map((log, idx) => (
                    <tr key={log.id} className="border-b border-line hover:bg-canvas/30 transition-colors font-medium">
                      <td className="py-2.5 px-3 font-mono text-muted-custom w-12">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono">{log.date}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                          log.status === 'present' 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : log.status === 'absent' 
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : log.status === 'informed'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{log.topic || '—'}</td>
                      <td className="py-2.5 px-3 text-muted-custom">{log.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto w-full space-y-4 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">OUTPUT · RAW</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Attendance Register</h1>
        </div>

        <select 
          value={filterCentre}
          onChange={e => setFilterCentre(e.target.value)}
          className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none"
        >
          <option>All centres</option>
          {centres.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-custom">
        Attendance register. Class counts per student by period — download for your own attendance checks.
      </p>

      {message && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${
          message.type === 'error' ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tab Switcher & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-line pb-1 gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('students')}
            className={`py-2 px-3 text-xs font-bold transition-all border-b-2 -mb-[6px] ${
              activeTab === 'students'
                ? 'border-forest text-forest font-bold'
                : 'border-transparent text-muted-custom hover:text-ink'
            }`}
          >
            👤 Student Summary
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-3 text-xs font-bold transition-all border-b-2 -mb-[6px] ${
              activeTab === 'logs'
                ? 'border-forest text-forest font-bold'
                : 'border-transparent text-muted-custom hover:text-ink'
            }`}
          >
            📋 Class Logs (All Days)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-bold text-muted-custom uppercase tracking-widest mr-1">Filter</span>

          <select
            value={filterCentre}
            onChange={e => setFilterCentre(e.target.value)}
            className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
          >
            <option>All centres</option>
            {centres.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>

          <select
            value={filterCoach}
            onChange={e => setFilterCoach(e.target.value)}
            className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
          >
            <option>All coaches</option>
            {uniqueCoaches.map(coach => <option key={coach} value={coach}>{coach}</option>)}
          </select>

          {activeTab === 'students' && (
            <>
              <select
                value={filterSegment}
                onChange={e => setFilterSegment(e.target.value)}
                className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
              >
                <option>All segments</option>
                {uniqueSegments.map(seg => <option key={seg} value={seg}>{seg}</option>)}
              </select>

              <select
                value={filterEngagement}
                onChange={e => setFilterEngagement(e.target.value)}
                className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
              >
                <option>All engagement</option>
                {['ENGAGED', 'SLIPPING', 'COLD', 'DORMANT'].map(eng => <option key={eng} value={eng}>{eng}</option>)}
              </select>
            </>
          )}

          <input
            type="text"
            placeholder="Search student..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white border border-line rounded px-3 py-1 text-xs text-ink outline-none focus:border-forest w-40"
          />

          {(filterCentre !== 'All centres' || filterCoach !== 'All coaches' || filterSegment !== 'All segments' || filterEngagement !== 'All engagement' || search !== '') && (
            <button
              onClick={handleResetFilters}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[10px] px-2.5 py-1 rounded transition-all cursor-pointer"
            >
              ✕ Reset
            </button>
          )}

          <div className="flex items-center gap-2 no-print ml-2">
            <span className="text-xs text-muted-custom font-semibold">
              {activeTab === 'students' ? filtered.length : filteredLogs.length} rows
            </span>
            <button 
              onClick={() => exportTableToCSV(activeTab === 'students' ? '#attendance-table' : '#logs-table', 'attendance_register.csv')}
              className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1"
            >
              ↓ Excel
            </button>
            <button 
              onClick={exportToPDF}
              className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1"
            >
              ⎙ PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Grid Conditional on Tab */}
      {activeTab === 'students' ? (
        <div className="bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table id="attendance-table" className="w-full border-collapse text-xs">
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="py-2.5 px-4 text-left font-semibold text-muted-custom w-12">S.No</th>
                  <SortTh col="studentName">Student</SortTh>
                  <SortTh col="displayId">ID</SortTh>
                  <SortTh col="centreName">Centre</SortTh>
                  <SortTh col="coachName">Coach</SortTh>
                  <SortTh col="level">Level</SortTh>
                  <SortTh col="cls30d" right>Classes 30D</SortTh>
                  <SortTh col="cls90d" right>Classes 90D</SortTh>
                  <SortTh col="daysSince" right>Days Since Last</SortTh>
                  <SortTh col="lastClass">Last Class</SortTh>
                  <SortTh col="engagement">Engagement</SortTh>
                  <SortTh col="classesLeft" right>Classes Left</SortTh>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-muted-custom text-xs">
                      No records match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedStudent(row)}
                      className="border-b border-line hover:bg-canvas/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{idx + 1}</td>
                      {/* Student */}
                      <td className="py-3 px-4 font-semibold text-ink whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <a href={`/student-dashboard?studentId=${row.id}`} className="hover:text-forest hover:underline">
                          {row.studentName}
                        </a>
                      </td>

                      {/* ID */}
                      <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.displayId}</td>

                      {/* Centre */}
                      <td className="py-3 px-4 text-muted-custom whitespace-nowrap">{row.centreName}</td>

                      {/* Coach */}
                      <td className="py-3 px-4 text-[10px] font-semibold text-ink/90 whitespace-nowrap uppercase">{row.coachName}</td>

                      {/* Level */}
                      <td className="py-3 px-4 text-muted-custom whitespace-nowrap">{row.level}</td>

                      {/* Classes 30D */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-ink">{row.cls30d}</td>

                      {/* Classes 90D */}
                      <td className="py-3 px-4 text-right font-mono text-ink">{row.cls90d}</td>

                      {/* Days Since Last */}
                      <td className="py-3 px-4 text-right font-mono text-ink">
                        {row.daysSince !== null ? row.daysSince : '—'}
                      </td>

                      {/* Last Class */}
                      <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.lastClass}</td>

                      {/* Engagement */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${engagementBadge(row.engagement)}`}>
                          {row.engagement}
                        </span>
                      </td>

                      {/* Classes Left */}
                      <td className={`py-3 px-4 text-right font-mono font-bold ${row.classesLeft === 0 ? 'text-hot-custom' : 'text-ink'}`}>
                        {row.classesLeft}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="border-t-2 border-line bg-canvas font-bold text-ink">
                  <tr>
                    <td className="py-3 px-4 font-mono text-muted-custom">Total</td>
                    <td className="py-3 px-4">—</td>
                    <td className="py-3 px-4 font-mono text-muted-custom">—</td>
                    <td className="py-3 px-4 text-muted-custom">—</td>
                    <td className="py-3 px-4 text-[10px] font-semibold text-ink/90 uppercase">—</td>
                    <td className="py-3 px-4 text-muted-custom">—</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                      {filtered.reduce((sum, row) => sum + row.cls30d, 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-ink">
                      {filtered.reduce((sum, row) => sum + row.cls90d, 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-ink">—</td>
                    <td className="py-3 px-4 font-mono text-muted-custom">—</td>
                    <td className="py-3 px-4">—</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                      {filtered.reduce((sum, row) => sum + row.classesLeft, 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table id="logs-table" className="w-full border-collapse text-xs">
              <thead className="border-b border-line bg-canvas">
                <tr className="text-left text-muted-custom text-[9px] uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-4 w-12">S.No</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Centre</th>
                  <th className="py-2.5 px-4">Coach</th>
                  <th className="py-2.5 px-4">Topic / Lesson</th>
                  <th className="py-2.5 px-4">Duration</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-custom text-xs">
                      No attendance logs match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={log.id} className="border-b border-line hover:bg-canvas/30 transition-colors font-medium">
                      <td className="py-3 px-4 font-mono text-muted-custom w-12">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono text-ink whitespace-nowrap">
                        {new Date(log.date).toISOString().split('T')[0]}
                      </td>
                      <td className="py-3 px-4 font-bold text-ink whitespace-nowrap">
                        {log.studentName}
                      </td>
                      <td className="py-3 px-4 text-muted-custom whitespace-nowrap">
                        {log.centreName}
                      </td>
                      <td className="py-3 px-4 uppercase text-[10px] text-ink whitespace-nowrap">
                        {log.coachName}
                      </td>
                      <td className="py-3 px-4 text-ink max-w-xs truncate">
                        {log.topic || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">
                        {log.duration || 2} hrs
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                          log.status === 'present' 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : log.status === 'absent' 
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : log.status === 'informed'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <select
                            value={log.status}
                            onChange={(e) => handleUpdateStatus(log.id, e.target.value)}
                            className="bg-white border border-line rounded px-1.5 py-0.5 text-xs text-ink outline-none focus:border-forest cursor-pointer"
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="informed">Informed</option>
                          </select>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className={`w-6 h-6 flex items-center justify-center rounded border text-xs cursor-pointer ${
                              deleteConfirmId === log.id 
                                ? 'bg-red-600 text-white border-red-600 font-bold' 
                                : 'border-red-200 text-hot-custom hover:bg-red-50'
                            }`}
                            title={deleteConfirmId === log.id ? "Click again to confirm" : "Delete Attendance Log"}
                          >
                            {deleteConfirmId === log.id ? "!" : "×"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-[#173F35] text-white p-6 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-200 uppercase">Attendance History</div>
                <h2 className="text-xl font-bold mt-1">{selectedStudent.studentName}</h2>
                <div className="text-xs text-emerald-200 mt-0.5">{selectedStudent.centreName}</div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
            </div>

            {/* List Body */}
            <div className="p-6 space-y-4 flex-1">
              <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">RAW ATTENDANCE LOGS</h3>
              {studentLogs.length === 0 ? (
                <p className="text-xs text-muted-custom py-4 text-center">No attendance logs found for this student.</p>
              ) : (
                <div className="space-y-3">
                  {studentLogs.map((log) => {
                    const coachObj = coaches.find(c => c.id === log.coach_id);
                    const coachName = coachObj?.name || 'Unassigned';
                    return (
                      <div key={log.id} className="border border-line rounded-lg p-3 flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <div className="font-mono text-ink">{new Date(log.date).toISOString().split('T')[0]}</div>
                          <div className="text-[10px] text-muted-custom">Coach: {coachName}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={log.status}
                            onChange={(e) => handleUpdateStatus(log.id, e.target.value)}
                            className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="informed">Informed</option>
                          </select>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className={`w-6 h-6 flex items-center justify-center rounded border text-xs cursor-pointer ${
                              deleteConfirmId === log.id 
                                ? 'bg-red-600 text-white border-red-600 font-bold' 
                                : 'border-red-200 text-hot-custom hover:bg-red-50'
                            }`}
                            title={deleteConfirmId === log.id ? "Click again to confirm" : "Delete Attendance Log"}
                          >
                            {deleteConfirmId === log.id ? "!" : "×"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-line bg-canvas">
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-full bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
