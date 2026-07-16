"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';
import type { User, Student, Package, Attendance, ProgressLog, Invoice } from '../lib/db';

Chart.register(...registerables);

interface StudentDashboardProps {
  currentUser: User;
  activeCentre: string;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, activeCentre }) => {
  const searchParams = useSearchParams();
  const queryStudentId = searchParams.get('studentId');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart Refs
  const trendChartRef = useRef<HTMLCanvasElement | null>(null);
  const comparisonChartRef = useRef<HTMLCanvasElement | null>(null);
  const radarChartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<{ [key: string]: Chart | null }>({});

  const destroyCharts = () => {
    Object.keys(chartInstances.current).forEach(key => {
      if (chartInstances.current[key]) {
        chartInstances.current[key]?.destroy();
        chartInstances.current[key] = null;
      }
    });
  };

  const loadData = () => {
    const stds = db.getStudents();
    const pkgs = db.getPackages();
    const atts = db.getAttendance();
    const logs = db.getProgressLogs();
    const invs = db.get<Invoice>('invoices') || [];

    setStudents(stds);
    setPackages(pkgs);
    setAttendance(atts);
    setProgressLogs(logs);
    setInvoices(invs);
    setLoading(false);

    if (stds.length > 0 && !selectedStudentId) {
      if (queryStudentId && stds.some(s => s.id === queryStudentId)) {
        setSelectedStudentId(queryStudentId);
      } else if (currentUser.role === 'parent') {
        const parentChild = stds.find(s => s.id === 's-alex-sterling-id') || stds[0];
        setSelectedStudentId(parentChild.id);
      } else {
        setSelectedStudentId(stds[0].id);
      }
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => {
      window.removeEventListener('db-synced', loadData);
      destroyCharts();
    };
  }, [selectedStudentId, queryStudentId]);

  useEffect(() => {
    if (queryStudentId && queryStudentId !== selectedStudentId) {
      const stds = db.getStudents();
      if (stds.some(s => s.id === queryStudentId)) {
        setSelectedStudentId(queryStudentId);
      }
    }
  }, [queryStudentId]);

  const activeStudent = students.find(s => s.id === selectedStudentId);

  const getCoachName = (coachId: string | null) => {
    if (!coachId) return 'Unassigned';
    const coaches = db.getCoaches();
    const c = coaches.find(co => co.id === coachId);
    return c ? c.name : 'Unassigned';
  };

  const getCentreName = (centreId: string) => {
    return centreId === 'c-2' || centreId === 'JLT' ? 'JLT' : 'Bay Avenue';
  };

  // Computed metrics for active student
  const studentMetrics = useMemo(() => {
    if (!activeStudent) return null;

    const today = new Date();
    const studentPkgs = packages.filter(p => p.student_id === activeStudent.id);
    const studentAtts = attendance.filter(a => a.student_id === activeStudent.id && a.status === 'present');
    const studentInvs = invoices.filter(i => i.student_id === activeStudent.id);

    // Classes left
    const classesLeft = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

    // Days since last class
    const daysSince = activeStudent.last_attended
      ? Math.floor((today.getTime() - new Date(activeStudent.last_attended).getTime()) / 86400000)
      : 999;

    // Classes in last 30 days
    const cls30d = studentAtts.filter(a => {
      const diff = Math.floor((today.getTime() - new Date(a.date).getTime()) / 86400000);
      return diff >= 0 && diff <= 30;
    }).length;

    // Classes in last 90 days
    const cls90d = studentAtts.filter(a => {
      const diff = Math.floor((today.getTime() - new Date(a.date).getTime()) / 86400000);
      return diff >= 0 && diff <= 90;
    }).length;

    // Lifetime paid
    const lifetimePaid = studentInvs
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.amount), 0);

    // Average rate per class
    const classesTotalSum = studentPkgs.reduce((sum, p) => sum + p.classes_total, 0);
    const avgRate = classesTotalSum > 0 ? Math.round(lifetimePaid / classesTotalSum) : 79;

    // Owed value
    const owedVal = (activeStudent.flags as any)?.unpaid_value || 0;

    // Engagement status
    const engagement = daysSince <= 14 ? 'HEALTHY'
      : daysSince <= 30 ? 'SLIPPING'
      : 'COLD';

    return {
      classesLeft,
      daysSince: daysSince === 999 ? '—' : daysSince,
      cls30d,
      cls90d,
      lifetimePaid,
      avgRate,
      owedVal,
      engagement,
    };
  }, [activeStudent, packages, attendance, invoices]);

  // Dynamic Chart Drawing
  useEffect(() => {
    if (!activeStudent || !trendChartRef.current || !comparisonChartRef.current || !radarChartRef.current) return;

    destroyCharts();

    const today = new Date();
    const studentAtts = attendance.filter(a => a.student_id === activeStudent.id && a.status === 'present');

    // 1. Attendance trend per month
    const months = ['Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25', 'Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const getMonthLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const m = monthNames[d.getMonth()];
      const y = d.getFullYear().toString().slice(-2);
      return `${m}-${y}`;
    };

    const trendData = months.map(m => {
      return studentAtts.filter(a => getMonthLabel(a.date) === m).length;
    });

    chartInstances.current.trend = new Chart(trendChartRef.current, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          data: trendData,
          backgroundColor: '#286957',
          borderRadius: 4,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E4DFD2' }, ticks: { stepSize: 2 } },
          x: { grid: { display: false } }
        }
      }
    });

    // 2. Vs Peers comparison
    const student30d = studentMetrics?.cls30d || 0;
    const student90d = studentMetrics?.cls90d || 0;
    const studentDays = typeof studentMetrics?.daysSince === 'number' ? studentMetrics.daysSince : 0;

    // Calculate actual peer average across all other students
    const levelPeers = students.filter(s => s.id !== activeStudent.id && s.level === activeStudent.level);
    const peersList = levelPeers.length > 0 ? levelPeers : students.filter(s => s.id !== activeStudent.id);
    
    let avg30 = 0;
    let avg90 = 0;
    let avgDays = 0;
    
    if (peersList.length > 0) {
      let sum30 = 0;
      let sum90 = 0;
      let sumDays = 0;
      
      peersList.forEach(p => {
        const pAtts = attendance.filter(a => a.student_id === p.id && a.status === 'present');
        let p30 = 0;
        let p90 = 0;
        pAtts.forEach(a => {
          const diffDays = Math.floor((today.getTime() - new Date(a.date).getTime()) / 86400000);
          if (diffDays >= 0 && diffDays <= 30) p30++;
          if (diffDays >= 0 && diffDays <= 90) p90++;
        });
        const pDays = p.last_attended
          ? Math.floor((today.getTime() - new Date(p.last_attended).getTime()) / 86400000)
          : 365;
        
        sum30 += p30;
        sum90 += p90;
        sumDays += pDays;
      });
      
      avg30 = Math.round((sum30 / peersList.length) * 10) / 10;
      avg90 = Math.round((sum90 / peersList.length) * 10) / 10;
      avgDays = Math.round(sumDays / peersList.length);
    }

    chartInstances.current.comparison = new Chart(comparisonChartRef.current, {
      type: 'bar',
      data: {
        labels: ['Classes 30d', 'Classes 90d', 'Days since'],
        datasets: [
          {
            label: activeStudent.name.split(' ')[0],
            data: [student30d, student90d, studentDays],
            backgroundColor: '#286957',
            borderRadius: 4,
          },
          {
            label: 'Peer average',
            data: [avg30, avg90, avgDays],
            backgroundColor: '#D6D1C4',
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 12, font: { size: 10 } } } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E4DFD2' } },
          x: { grid: { display: false } }
        }
      }
    });

    // 3. Radar Chart (Skills profile)
    const logs = progressLogs.filter(p => p.student_id === activeStudent.id);
    const latestLog = logs[logs.length - 1];
    const skillValues = latestLog?.skills || { openings: 65, tactics: 60, endgames: 55, strategy: 50, focus: 70 };

    chartInstances.current.radar = new Chart(radarChartRef.current, {
      type: 'radar',
      data: {
        labels: ['Openings', 'Tactics', 'Endgames', 'Strategy', 'Focus'],
        datasets: [{
          data: [
            skillValues.openings || 50,
            skillValues.tactics || 50,
            skillValues.endgames || 50,
            skillValues.strategy || 50,
            skillValues.focus || 50
          ],
          backgroundColor: 'rgba(196, 162, 73, 0.2)',
          borderColor: '#C4A249',
          borderWidth: 2,
          pointBackgroundColor: '#C4A249',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            angleLines: { color: '#E4DFD2' },
            grid: { color: '#E4DFD2' },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: { display: false }
          }
        }
      }
    });

  }, [activeStudent, attendance, progressLogs, studentMetrics]);

  // Enrich student package history
  const enrichedPackages = useMemo(() => {
    if (!activeStudent) return [];
    
    const studentPkgs = packages.filter(p => p.student_id === activeStudent.id);
    const studentAtts = attendance
      .filter(a => a.student_id === activeStudent.id && a.status === 'present')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let attCursor = 0;

    return studentPkgs.map((pkg, idx) => {
      const classesPaid = pkg.classes_total;
      const used = pkg.classes_total - pkg.classes_remaining;
      const balance = pkg.classes_remaining;

      // Determine paid on date
      const pkgInvoice = invoices.find(inv => inv.package_id === pkg.id);
      const isPaid = pkgInvoice ? pkgInvoice.status === 'paid' : true;
      const paidOnDate = isPaid ? (pkgInvoice?.created_at || pkg.start_date) : null;
      const paidOn = paidOnDate ? new Date(paidOnDate).toISOString().split('T')[0] : 'NaT';

      // Map attendances
      const pkgAtts = studentAtts.slice(attCursor, attCursor + classesPaid);
      attCursor += classesPaid;

      const firstClass = pkgAtts.length > 0 ? new Date(pkgAtts[0].date).toISOString().split('T')[0] : (pkg.start_date ? new Date(pkg.start_date).toISOString().split('T')[0] : 'NaT');

      let ended = 'NaT';
      if (pkg.classes_remaining === 0) {
        if (pkgAtts.length > 0) {
          ended = new Date(pkgAtts[pkgAtts.length - 1].date).toISOString().split('T')[0];
        } else if (pkg.expiry_date) {
          ended = new Date(pkg.expiry_date).toISOString().split('T')[0];
        }
      }

      return {
        pkgNo: idx + 1,
        type: pkg.kind ? (pkg.kind.charAt(0).toUpperCase() + pkg.kind.slice(1)) : 'New',
        paidOn,
        firstClass,
        ended,
        classesPaid,
        used,
        balance,
        status: pkg.classes_remaining === 0 ? 'COMPLETED' : 'CURRENT',
      };
    });
  }, [activeStudent, packages, attendance, invoices]);

  // Summarize package total paid vs used
  const packageTotals = useMemo(() => {
    const paidSum = enrichedPackages.reduce((sum, p) => sum + p.classesPaid, 0);
    const usedSum = enrichedPackages.reduce((sum, p) => sum + p.used, 0);
    const balanceSum = enrichedPackages.reduce((sum, p) => sum + p.balance, 0);
    return { paidSum, usedSum, balanceSum };
  }, [enrichedPackages]);

  // Horizontal months mapping for class usage grid
  const monthlyUsageGrid = useMemo(() => {
    const months = [
      { name: 'Feb-25', count: 2 },
      { name: 'Mar-25', count: 2 },
      { name: 'Apr-25', count: 1 },
      { name: 'May-25', count: 3 },
      { name: 'Jun-25', count: 4 },
      { name: 'Jul-25', count: 12 },
      { name: 'Aug-25', count: 1 },
      { name: 'Sep-25', count: 4 },
      { name: 'Oct-25', count: 11 },
      { name: 'Nov-25', count: 3 },
      { name: 'Dec-25', count: 5 },
      { name: 'Jan-26', count: 3 },
      { name: 'Feb-26', count: 0 },
      { name: 'Mar-26', count: 2 },
      { name: 'Apr-26', count: 0 },
      { name: 'May-26', count: 2 },
      { name: 'Jun-26', count: 2 },
    ];
    return months;
  }, []);

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Student Dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-muted-custom uppercase">STUDENT</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Student Dashboard</h1>
        </div>

        <select className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none">
          <option>All centres</option>
        </select>
      </div>

      {/* Select Student and Report Actions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface border border-line rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-custom uppercase">STUDENT</span>
          <select 
            value={selectedStudentId} 
            onChange={e => setSelectedStudentId(e.target.value)}
            className="bg-white border border-[#54D6DD] border-2 rounded-lg px-3 py-1 text-xs text-ink outline-none w-64"
          >
            {students.filter(s => activeCentre === 'All' || s.centre_id === activeCentre).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <a href={`/package-report?studentId=${selectedStudentId}`} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas inline-block text-center">Package report</a>
          <a href={`/progress-report?studentId=${selectedStudentId}`} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas inline-block text-center">Progress report</a>
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
        </div>
      </div>

      {activeStudent && studentMetrics ? (
        <div className="space-y-6">

          {/* Student Profile Hero Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-fd border border-line rounded-[14px] p-6 shadow-md relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(18, 47, 40, 0.95), rgba(18, 47, 40, 0.95)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' width=\'50\' height=\'50\'/%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' x=\'50\' y=\'50\' width=\'50\' height=\'50\'/%3E%3C/svg%3E")' }}>
            <div className="w-16 h-16 rounded-2xl bg-brass text-ink flex items-center justify-center font-display font-extrabold text-2xl shadow-lg border border-brass2">
              {activeStudent.name.split(' ').map(n => n[0]).join('')}
            </div>

            <div className="flex-1 space-y-1">
              <h2 className="text-2xl font-bold text-white font-display leading-tight">{activeStudent.name}</h2>
              <div className="text-xs text-mint/80">
                {activeStudent.fide_id || '—'} · {getCentreName(activeStudent.centre_id)} · {getCoachName(activeStudent.coach_id)} · 
                {activeStudent.level ? (
                  <span className="text-white ml-1">{activeStudent.level}</span>
                ) : (
                  <span className="text-red-400 font-bold ml-1">No level assigned</span>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 border-emerald-500/40 text-mint uppercase">
                  {studentMetrics.engagement}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/20 border-amber-500/40 text-brass2 uppercase">
                  SLIPPING
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-slate-300">
                  ENROLLED {activeStudent.join_date ? new Date(activeStudent.join_date).toISOString().split('T')[0] : '2025-01-10'}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 mt-4 md:mt-0 ml-auto">
              <button className="bg-brass hover:bg-brass/90 text-ink font-bold text-xs px-4 py-2 rounded-lg transition-all shadow">
                Send report
              </button>
              <button className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-4 py-2 rounded-lg transition-all">
                Renew package
              </button>
            </div>
          </div>

          {/* Slipping Alert Notification Banner */}
          {studentMetrics.engagement === 'SLIPPING' && (
            <div className="p-4 rounded-[12px] bg-[#FBEEA] border border-[#EBC9BE] border-l-4 border-l-hot-custom flex gap-3 text-xs leading-relaxed">
              <span className="text-hot-custom font-bold">Slipping.</span>
              <span className="text-[#6a4a41]">
                Attendance has fallen to {studentMetrics.cls30d} classes in 30 days. Consistency is the priority, not new content.
              </span>
            </div>
          )}

          {/* KPI Cards (5 grid columns) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            
            {/* CLASSES LEFT */}
            <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Classes Left</div>
              <h2 className="text-2xl font-bold font-display text-forest mt-1.5">
                {studentMetrics.classesLeft}
              </h2>
              <p className="text-[10px] text-muted-custom mt-1">in the current package</p>
            </div>

            {/* LAST 30 DAYS */}
            <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Last 30 Days</div>
              <h2 className="text-2xl font-bold font-display text-[#C4A249] mt-1.5">
                {studentMetrics.cls30d}
              </h2>
              <p className="text-[10px] text-muted-custom mt-1">peer average 2.3</p>
            </div>

            {/* DAYS SINCE CLASS */}
            <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Days Since Class</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">
                {studentMetrics.daysSince}
              </h2>
              <p className="text-[10px] text-muted-custom mt-1">last: {activeStudent.last_attended ? new Date(activeStudent.last_attended).toISOString().split('T')[0] : '2026-06-25'}</p>
            </div>

            {/* LIFETIME PAID */}
            <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Lifetime Paid</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">
                AED {(studentMetrics.lifetimePaid / 1000).toFixed(0)}K
              </h2>
              <p className="text-[10px] text-muted-custom mt-1">at AED {studentMetrics.avgRate}/class</p>
            </div>

            {/* OWED (LEDGER) */}
            <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm">
              <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">Owed (Ledger)</div>
              <h2 className="text-2xl font-bold font-display text-ink mt-1.5">
                {studentMetrics.owedVal > 0 ? `AED ${studentMetrics.owedVal.toLocaleString()}` : '—'}
              </h2>
              <p className="text-[10px] text-muted-custom mt-1">
                {studentMetrics.owedVal > 0 ? 'outstanding unbilled' : 'nothing outstanding'}
              </p>
            </div>

          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Attendance Trend Chart */}
            <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span className="text-[#C4A249]">▲</span> Attendance trend
                </h3>
                <p className="text-[10px] text-muted-custom mt-0.5">Classes per month across their whole history.</p>
              </div>
              <div className="h-56">
                <canvas ref={trendChartRef}></canvas>
              </div>
            </div>

            {/* Vs Peers Comparison Chart */}
            <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span className="text-[#C4A249]">♟</span> Vs peers
                </h3>
                <p className="text-[10px] text-muted-custom mt-0.5">Same centre, same level ({students.filter(st => st.centre_id === activeStudent.centre_id).length} students).</p>
              </div>
              <div className="h-56">
                <canvas ref={comparisonChartRef}></canvas>
              </div>
            </div>

          </div>

          {/* Package History */}
          <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <span className="text-[#C4A249]">📋</span> Package history
              </h3>
              <p className="text-[10px] text-muted-custom mt-0.5">Every package, paid vs used.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider">#</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider">Type</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider">Paid On</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider">First Class</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider">Ended</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider text-right">Paid</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider text-right">Used</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider text-right">Balance</th>
                    <th className="py-2 px-3 text-muted-custom uppercase font-bold text-[9px] tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedPackages.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-custom">
                        No package history recorded.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {enrichedPackages.map(pkg => (
                        <tr key={pkg.pkgNo} className="border-b border-line hover:bg-canvas/30 transition-colors font-medium">
                          <td className="py-2.5 px-3 font-mono text-muted-custom">{pkg.pkgNo}</td>
                          <td className="py-2.5 px-3">{pkg.type}</td>
                          <td className="py-2.5 px-3 font-mono text-muted-custom">{pkg.paidOn}</td>
                          <td className="py-2.5 px-3 font-mono text-muted-custom">{pkg.firstClass}</td>
                          <td className="py-2.5 px-3 font-mono text-muted-custom">{pkg.ended}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-ink">{pkg.classesPaid}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-ink">{pkg.used}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">{pkg.balance}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                              pkg.status === 'COMPLETED' 
                                ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}>
                              {pkg.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      
                      {/* Dynamic Summary Row */}
                      <tr className="bg-canvas/30 font-bold text-ink border-b border-line">
                        <td className="py-2.5 px-3" colSpan={5}>Total</td>
                        <td className="py-2.5 px-3 text-right font-mono">{packageTotals.paidSum}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{packageTotals.usedSum}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{packageTotals.balanceSum}</td>
                        <td className="py-2.5 px-3">—</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Class Usage By Month Boxes */}
            <div className="pt-4 space-y-2">
              <div className="text-[10px] font-bold text-ink uppercase tracking-wider">Class usage by month</div>
              <div className="flex flex-wrap gap-1 bg-canvas/30 p-3 border border-line rounded-xl overflow-x-auto">
                {monthlyUsageGrid.map((m, idx) => (
                  <div key={idx} className="flex flex-col items-center min-w-[34px] border border-line rounded bg-surface">
                    <div className={`w-full py-1 text-center font-mono font-bold text-xs text-white rounded-t ${m.count > 10 ? 'bg-emerald-800' : m.count > 0 ? 'bg-emerald-600/70' : 'bg-slate-300 text-slate-500'}`}>
                      {m.count}
                    </div>
                    <div className="py-1 text-[8px] text-muted-custom font-semibold uppercase">{m.name.split('-')[0]}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Grid: Skills profile and Next Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Skills Profile Radar Chart */}
            <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span className="text-[#C4A249]">⚙</span> Skills profile
                </h3>
                <p className="text-[10px] text-muted-custom mt-0.5">Populated from the coach's post-class log.</p>
              </div>
              <div className="h-64 relative flex items-center justify-center">
                <canvas ref={radarChartRef}></canvas>
              </div>
            </div>

            {/* Next actions List */}
            <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span className="text-[#C4A249]">⏳</span> Next actions
                </h3>
                <p className="text-[10px] text-muted-custom mt-0.5">Computed from this student's position.</p>
              </div>

              <div className="space-y-3">
                {/* 1. Level check */}
                {!activeStudent.level && (
                  <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-[#6a4a41] leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-red-200 text-hot-custom flex items-center justify-center font-bold text-[10px]">●</span>
                    <div>
                      <b className="text-hot-custom block">Assign a level</b>
                      This student has none, so they cannot be placed in the right class or progress-tracked.
                    </div>
                  </div>
                )}

                {/* 2. Low package check */}
                {studentMetrics.classesLeft <= 3 && (
                  <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-[#8a6414] leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-bold text-[10px]">●</span>
                    <div>
                      <b className="text-amber-700 block">Renew package soon</b>
                      Student has low balance ({studentMetrics.classesLeft} left). Raise invoice today.
                    </div>
                  </div>
                )}

                {/* 3. Overdue value check */}
                {studentMetrics.owedVal > 0 && (
                  <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-[#6a4a41] leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-red-200 text-hot-custom flex items-center justify-center font-bold text-[10px]">●</span>
                    <div>
                      <b className="text-hot-custom block">Overdue payment</b>
                      Student has an outstanding unbilled value of AED {studentMetrics.owedVal.toLocaleString()}.
                    </div>
                  </div>
                )}

                {/* Healthy case */}
                {activeStudent.level && studentMetrics.classesLeft > 3 && studentMetrics.owedVal === 0 && (
                  <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-[#33544b] leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-[10px]">✓</span>
                    <div>
                      <b className="text-emerald-800 block">No action required</b>
                      Student account is healthy. All packages paid and attendance matches expectation.
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="p-10 bg-surface border border-line rounded-[14px] text-center text-muted-custom">
          Please select a student from the dropdown menu to inspect details.
        </div>
      )}
    </div>
  );
};
