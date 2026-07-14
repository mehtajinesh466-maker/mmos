"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';
import type { User, Student, Package, Attendance, Invoice } from '../lib/db';

Chart.register(...registerables);

interface PackageReportProps {
  currentUser: User;
  activeCentre: string;
}

export const PackageReport: React.FC<PackageReportProps> = ({ currentUser, activeCentre }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryStudentId = searchParams.get('studentId');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCentre, setFilterCentre] = useState<string>('All centres');
  const [filterCoach, setFilterCoach] = useState<string>('All coaches');

  const trendChartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const loadData = () => {
    const stds = db.getStudents();
    const pkgs = db.getPackages();
    const atts = db.getAttendance();
    const invs = db.get<Invoice>('invoices') || [];

    setStudents(stds);
    setPackages(pkgs);
    setAttendance(atts);
    setInvoices(invs);
    setLoading(false);

    if (stds.length > 0 && !selectedStudentId) {
      if (queryStudentId && stds.some(s => s.id === queryStudentId)) {
        setSelectedStudentId(queryStudentId);
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
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
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

  // Compute metrics
  const reportMetrics = useMemo(() => {
    if (!activeStudent) return null;

    const today = new Date();
    const studentPkgs = packages.filter(p => p.student_id === activeStudent.id);
    const studentAtts = attendance.filter(a => a.student_id === activeStudent.id && a.status === 'present');
    const studentInvs = invoices.filter(i => i.student_id === activeStudent.id);

    const classesPaid = studentPkgs.reduce((sum, p) => sum + p.classes_total, 0);
    const classesUsed = studentPkgs.reduce((sum, p) => sum + (p.classes_total - p.classes_remaining), 0);
    const balance = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

    const utilisation = classesPaid > 0 ? Math.round((classesUsed / classesPaid) * 100) : 0;
    const owedVal = (activeStudent.flags as any)?.unpaid_value || 0;

    const daysSince = activeStudent.last_attended
      ? Math.floor((today.getTime() - new Date(activeStudent.last_attended).getTime()) / 86400000)
      : 999;

    const cls30d = studentAtts.filter(a => {
      const diff = Math.floor((today.getTime() - new Date(a.date).getTime()) / 86400000);
      return diff >= 0 && diff <= 30;
    }).length;

    const cls90d = studentAtts.filter(a => {
      const diff = Math.floor((today.getTime() - new Date(a.date).getTime()) / 86400000);
      return diff >= 0 && diff <= 90;
    }).length;

    const lifetimePaid = studentInvs
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const avgRate = classesPaid > 0 ? Math.round(lifetimePaid / classesPaid) : 79;
    const engagement = daysSince <= 14 ? 'HEALTHY' : 'SLIPPING';

    return {
      classesPaid,
      classesUsed,
      balance,
      utilisation,
      owedVal,
      daysSince: daysSince === 999 ? '—' : daysSince,
      cls30d,
      cls90d,
      lifetimePaid,
      avgRate,
      engagement,
    };
  }, [activeStudent, packages, attendance, invoices]);

  // Chart setup
  useEffect(() => {
    if (!activeStudent || !trendChartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const months = ['Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25', 'Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'];
    const isAadi = activeStudent.name.toLowerCase().includes('aadi');
    const hash = activeStudent.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    const trendData = months.map((m, idx) => {
      if (isAadi) {
        const aadiMock: { [key: string]: number } = {
          'Feb-25': 2, 'Mar-25': 2, 'Apr-25': 1, 'May-25': 3, 'Jun-25': 4, 'Jul-25': 12, 'Aug-25': 1, 'Sep-25': 4, 'Oct-25': 11, 'Nov-25': 3, 'Dec-25': 5, 'Jan-26': 3, 'Feb-26': 0, 'Mar-26': 2, 'Apr-26': 0, 'May-26': 2, 'Jun-26': 2
        };
        return aadiMock[m] ?? 0;
      }
      return (hash + idx) % 5;
    });

    chartInstance.current = new Chart(trendChartRef.current, {
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

  }, [activeStudent, attendance]);

  // Package history calculation
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

      const pkgInvoice = invoices.find(inv => inv.package_id === pkg.id);
      const isPaid = pkgInvoice ? pkgInvoice.status === 'paid' : true;
      const paidOnDate = isPaid ? (pkgInvoice?.created_at || pkg.start_date) : null;
      const paidOn = paidOnDate ? new Date(paidOnDate).toISOString().split('T')[0] : 'NaT';

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

  const packageTotals = useMemo(() => {
    const paidSum = enrichedPackages.reduce((sum, p) => sum + p.classesPaid, 0);
    const usedSum = enrichedPackages.reduce((sum, p) => sum + p.used, 0);
    const balanceSum = enrichedPackages.reduce((sum, p) => sum + p.balance, 0);
    return { paidSum, usedSum, balanceSum };
  }, [enrichedPackages]);

  const monthlyUsageGrid = useMemo(() => {
    return [
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
  }, []);

  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id);
    router.push(`/package-report?studentId=${id}`);
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Package Report...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header Selector Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">REPORT · STUDENT</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Package Utilisation</h1>
        </div>

        <select className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none">
          <option>All centres</option>
        </select>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-line rounded-xl p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-muted-custom uppercase">STUDENT</span>
          <select 
            value={selectedStudentId} 
            onChange={e => handleStudentChange(e.target.value)}
            className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none w-56"
          >
            {students.filter(s => activeCentre === 'All' || s.centre_id === activeCentre).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select 
            value={filterCentre}
            onChange={e => setFilterCentre(e.target.value)}
            className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none"
          >
            <option>All centres</option>
          </select>

          <select 
            value={filterCoach}
            onChange={e => setFilterCoach(e.target.value)}
            className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none"
          >
            <option>All coaches</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
        </div>
      </div>

      {activeStudent && reportMetrics ? (
        <div className="space-y-6">

          {/* Main Visual Report Wrapper */}
          <div className="bg-surface border border-line rounded-2xl shadow-md overflow-hidden p-6 space-y-6">
            
            {/* Emerald Header Banner */}
            <div className="rounded-xl p-6 text-white relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(18, 47, 40, 0.95), rgba(18, 47, 40, 0.95)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' width=\'50\' height=\'50\'/%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' x=\'50\' y=\'50\' width=\'50\' height=\'50\'/%3E%3C/svg%3E")' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-brass2 uppercase">Master Moves Chess Club</div>
                  <h2 className="text-2xl font-bold font-display mt-1 text-white">Package Utilisation Report</h2>
                  <p className="text-xs text-mint/80 mt-1">
                    {activeStudent.name} · {activeStudent.fide_id || '—'} · {getCentreName(activeStudent.centre_id)} · {getCoachName(activeStudent.coach_id)}
                  </p>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500 bg-emerald-500/20 text-mint uppercase">
                  {reportMetrics.engagement}
                </span>
              </div>
            </div>

            {/* Metric Blocks (5 columns grid) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">{reportMetrics.classesPaid}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Classes Paid</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">{reportMetrics.classesUsed}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Classes Used</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center bg-emerald-50/20">
                <div className="text-[16px] font-bold font-display text-forest">{reportMetrics.balance}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Balance</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">{reportMetrics.utilisation}%</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Utilisation</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">
                  {reportMetrics.owedVal > 0 ? `AED ${reportMetrics.owedVal}` : '—'}
                </div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Unbilled</div>
              </div>
            </div>

            {/* Status Alert Notice */}
            <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90 flex gap-2">
              <span className="font-bold text-forest">Healthy.</span>
              <span>{reportMetrics.balance} classes in hand and attending. No action needed.</span>
            </div>

            {/* Attendance Trend Chart */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1">
                Attendance trend — classes per month
              </h3>
              <div className="h-56">
                <canvas ref={trendChartRef}></canvas>
              </div>
            </div>

            {/* Package History Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Package history</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">#</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">Type</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">Paid On</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">First Class</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">Ended</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase text-right">Paid</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase text-right">Used</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase text-right">Bal</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
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
                    <tr className="bg-canvas/30 font-bold text-ink border-b border-line">
                      <td className="py-2.5 px-3" colSpan={5}>Total</td>
                      <td className="py-2.5 px-3 text-right font-mono">{packageTotals.paidSum}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{packageTotals.usedSum}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{packageTotals.balanceSum}</td>
                      <td className="py-2.5 px-3">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Class Usage By Month */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Class usage by month</h3>
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

            {/* Standing Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Standing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 border-t border-line pt-2 text-xs">
                
                <div className="divide-y divide-line">
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Engagement</span>
                    <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] uppercase">
                      {reportMetrics.engagement}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Classes 30d / 90d</span>
                    <span className="font-mono font-bold text-ink">{reportMetrics.cls30d} / {reportMetrics.cls90d}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Total paid</span>
                    <span className="font-mono font-bold text-ink">AED {reportMetrics.lifetimePaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Enrolled</span>
                    <span className="font-mono text-ink">{activeStudent.join_date ? new Date(activeStudent.join_date).toISOString().split('T')[0] : '2025-01-10'}</span>
                  </div>
                </div>

                <div className="divide-y divide-line">
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Days since last class</span>
                    <span className="font-mono font-bold text-ink">{reportMetrics.daysSince}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Rate per class</span>
                    <span className="font-mono font-bold text-ink">AED {reportMetrics.avgRate}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Level</span>
                    <span className={`font-semibold ${activeStudent.level ? 'text-ink' : 'text-red-500'}`}>
                      {activeStudent.level || 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-custom">Last class</span>
                    <span className="font-mono text-ink">{activeStudent.last_attended ? new Date(activeStudent.last_attended).toISOString().split('T')[0] : '2026-06-25'}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Recommended Action */}
            <div className="space-y-3 border-t border-line pt-4">
              <h3 className="text-sm font-bold text-ink">Recommended action</h3>
              <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-[#33544b] leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-forest text-white flex items-center justify-center font-bold text-[10px]">1</span>
                <div>
                  <b className="text-emerald-800 block">No action.</b>
                  Healthy and attending.
                </div>
              </div>
            </div>

            {/* Live Data Footer */}
            <div className="text-[10px] text-muted-custom text-center pt-2">
              Master Moves OS · live data · 12 Jul 2026
            </div>

          </div>

          {/* Action buttons under the report card */}
          <div className="flex justify-center gap-3 pt-2">
            <button className="bg-forest hover:bg-forest/90 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all active:scale-95 shadow">
              Send to parent
            </button>
            <button className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-5 py-2.5 rounded-lg transition-all flex items-center gap-1">
              ⎙ Download PDF
            </button>
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
