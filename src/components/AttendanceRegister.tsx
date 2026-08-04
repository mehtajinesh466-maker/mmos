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
      alert('✓ Attendance record updated.');
    } catch (e: any) {
      alert('Error updating attendance: ' + e.message);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this attendance log?')) return;
    try {
      await deleteAttendanceDB(logId);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      alert('✓ Attendance record deleted.');
    } catch (e: any) {
      alert('Error deleting attendance: ' + e.message);
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
      const displayId = s.fide_id ? s.fide_id : `${prefix}-${numPart}`;

      // Days since last class
      const daysSince = s.last_attended
        ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000)
        : 999;

      // Calculate 30D and 90D attendance metrics from real records
      const studentAtts = attendance.filter(a => a.student_id === s.id && a.status === 'present');
      let cls30d = 0;
      let cls90d = 0;

      studentAtts.forEach(a => {
        const attDate = new Date(a.date);
        const diffDays = Math.floor((today.getTime() - attDate.getTime()) / 86400000);
        if (diffDays >= 0 && diffDays <= 30) cls30d++;
        if (diffDays >= 0 && diffDays <= 90) cls90d++;
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
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Topic</th>
                  <th className="py-2.5 px-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {childLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-custom">
                      No attendance logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  childLogs.map(log => (
                    <tr key={log.id} className="border-b border-line hover:bg-canvas/30 transition-colors font-medium">
                      <td className="py-2.5 px-3 font-mono">{log.date}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                          log.status === 'present' 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : log.status === 'absent' 
                            ? 'bg-red-100 text-red-700 border-red-200' 
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 py-2">
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

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white border border-line rounded px-3 py-1 text-xs text-ink outline-none focus:border-forest w-40"
        />

        {(filterCentre !== 'All centres' || filterCoach !== 'All coaches' || filterSegment !== 'All segments' || filterEngagement !== 'All engagement' || search !== '') && (
          <button
            onClick={handleResetFilters}
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[10px] px-2.5 py-1 rounded transition-all cursor-pointer"
          >
            ✕ Reset Filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 no-print">
          <span className="text-xs text-muted-custom font-semibold">{filtered.length} rows</span>
          <button 
            onClick={() => exportTableToCSV('#attendance-table', 'attendance_register.csv')}
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

      {/* Main Table Grid */}
      <div className="bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table id="attendance-table" className="w-full border-collapse text-xs">
            <thead className="border-b border-line bg-canvas">
              <tr>
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
                  <td colSpan={11} className="py-12 text-center text-muted-custom text-xs">
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedStudent(row)}
                    className="border-b border-line hover:bg-canvas/40 transition-colors cursor-pointer"
                  >
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
          </table>
        </div>
      </div>

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
                          </select>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="w-6 h-6 flex items-center justify-center rounded border border-red-200 text-hot-custom text-xs hover:bg-red-50"
                          >
                            ×
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
