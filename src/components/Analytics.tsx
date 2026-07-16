// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';

Chart.register(...registerables);

interface AnalyticsProps {
  activeCentre: string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ activeCentre }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'builder'>('dashboard');

  const [students, setStudents] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bayCentreId = useMemo(() => centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1', [centres]);
  const jltCentreId = useMemo(() => centres.find(c => c.name === 'JLT')?.id || 'c-2', [centres]);

  const loadData = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setAttendance(db.getAttendance());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
    setInvoices(db.get<any>('invoices') || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'builder') {
        setActiveTab('builder');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [typeof window !== 'undefined' ? window.location.search : '']);

  // Dashboard Slices / Filters
  const [filterCentre, setFilterCentre] = useState('All');
  const [filterSegment, setFilterSegment] = useState('All');
  const [filterEngagement, setFilterEngagement] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [diceBy, setDiceBy] = useState('By Centre');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut' | 'table'>('bar');

  // Report Builder State
  const [reportTitle, setReportTitle] = useState('My custom report');
  const [activeSectionId, setActiveSectionId] = useState<number>(1);
  const [sectionTitle, setSectionTitle] = useState('Key numbers');
  const [selectedMeasures, setSelectedMeasures] = useState<string[]>([
    'Students', 'Run-rate AED / month', 'Unbilled value — ledger (AED)'
  ]);

  // Chart Refs
  const studentsChartRef = useRef<HTMLCanvasElement | null>(null);
  const enrolmentsChartRef = useRef<HTMLCanvasElement | null>(null);
  const comparisonChartRef = useRef<HTMLCanvasElement | null>(null);
  const builderChartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<{ [key: string]: Chart | null }>({});

  const destroyCharts = () => {
    Object.keys(chartInstances.current).forEach(key => {
      if (chartInstances.current[key]) {
        chartInstances.current[key]?.destroy();
        chartInstances.current[key] = null;
      }
    });
  };

  useEffect(() => {
    destroyCharts();
    if (activeTab === 'dashboard') {
      drawDashboardCharts();
    } else {
      drawBuilderCharts();
    }
    return () => destroyCharts();
  }, [activeTab, filterCentre, filterSegment, filterEngagement, filterLevel, diceBy, chartType, selectedMeasures, loading]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (filterCentre !== 'All' && s.centre_id !== (filterCentre === 'JLT' ? jltCentreId : bayCentreId)) return false;
      if (filterLevel !== 'All' && s.level !== filterLevel) return false;
      
      // Filter segment
      if (filterSegment !== 'All') {
        const heat = (s.flags?.low_package) ? 'HOT' : 'HEALTHY';
        if (heat !== filterSegment) return false;
      }
      
      // Filter engagement
      if (filterEngagement !== 'All') {
        const today = new Date();
        const daysSince = s.last_attended
          ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000)
          : 999;
        const engStatus = daysSince <= 14 ? 'Engaged' : daysSince <= 30 ? 'Slipping' : 'Dormant';
        if (engStatus.toLowerCase() !== filterEngagement.toLowerCase()) return false;
      }
      return true;
    });
  }, [students, filterCentre, filterSegment, filterEngagement, filterLevel]);

  const drawDashboardCharts = () => {
    if (loading) return;

    // 1. Students by Centre Chart
    if (studentsChartRef.current) {
      const bayCount = filteredStudents.filter(s => s.centre_id === bayCentreId).length;
      const jltCount = filteredStudents.filter(s => s.centre_id === jltCentreId).length;

      chartInstances.current.students = new Chart(studentsChartRef.current, {
        type: 'bar',
        data: {
          labels: ['Bay Avenue', 'JLT'],
          datasets: [{
            label: 'Students',
            data: [bayCount, jltCount],
            backgroundColor: ['#286957', '#C4A249'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#E4DFD2' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 2. Enrolments per month Chart
    if (enrolmentsChartRef.current) {
      const monthsLabels = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
      const bayData = monthsLabels.map(mLabel => {
        return filteredStudents.filter(s => {
          const joinMonth = s.join_date ? new Date(s.join_date).toISOString().slice(0, 7) : '';
          return joinMonth === mLabel && s.centre_id === bayCentreId;
        }).length;
      });
      const jltData = monthsLabels.map(mLabel => {
        return filteredStudents.filter(s => {
          const joinMonth = s.join_date ? new Date(s.join_date).toISOString().slice(0, 7) : '';
          return joinMonth === mLabel && s.centre_id === jltCentreId;
        }).length;
      });

      chartInstances.current.enrolments = new Chart(enrolmentsChartRef.current, {
        type: 'bar',
        data: {
          labels: monthsLabels,
          datasets: [
            {
              label: 'Bay Avenue',
              data: bayData,
              backgroundColor: '#286957'
            },
            {
              label: 'JLT',
              data: jltData,
              backgroundColor: '#9DDDCB'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'top' } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#E4DFD2' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Centre comparison Chart
    if (comparisonChartRef.current) {
      const activeBay = filteredStudents.filter(s => s.status === 'active' && s.centre_id === bayCentreId).length;
      const activeJlt = filteredStudents.filter(s => s.status === 'active' && s.centre_id === jltCentreId).length;
      const inactiveBay = filteredStudents.filter(s => s.status === 'inactive' && s.centre_id === bayCentreId).length;
      const inactiveJlt = filteredStudents.filter(s => s.status === 'inactive' && s.centre_id === jltCentreId).length;

      chartInstances.current.comparison = new Chart(comparisonChartRef.current, {
        type: 'bar',
        data: {
          labels: ['Bay Avenue', 'JLT'],
          datasets: [
            {
              label: 'Active',
              data: [activeBay, activeJlt],
              backgroundColor: '#286957'
            },
            {
              label: 'Inactive',
              data: [inactiveBay, inactiveJlt],
              backgroundColor: '#E4DFD2'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'top' } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#E4DFD2' } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  };

  const drawBuilderCharts = () => {
    if (!builderChartRef.current || loading) return;

    const bayRev = invoices
      .filter(i => i.status === 'paid' && filteredStudents.some(s => s.id === i.student_id) && students.find(s => s.id === i.student_id)?.centre_id === bayCentreId)
      .reduce((sum, i) => sum + Number(i.amount), 0);
    const jltRev = invoices
      .filter(i => i.status === 'paid' && filteredStudents.some(s => s.id === i.student_id) && students.find(s => s.id === i.student_id)?.centre_id === jltCentreId)
      .reduce((sum, i) => sum + Number(i.amount), 0);

    chartInstances.current.builder = new Chart(builderChartRef.current, {
      type: 'bar',
      data: {
        labels: ['Bay Avenue', 'JLT'],
        datasets: [{
          label: 'Revenue (AED)',
          data: [bayRev, jltRev],
          backgroundColor: '#286957'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E4DFD2' } },
          x: { grid: { display: false } }
        }
      }
    });
  };

  // Variables calculated from database
  const totalStudents = students.length;
  
  const activeStudentsCount = students.filter(s => {
    if (!s.last_attended) return false;
    const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
    return diff >= 0 && diff <= 30 && s.status === 'active';
  }).length;
  
  const activePercent = totalStudents > 0 ? Math.round((activeStudentsCount / totalStudents) * 100) : 0;

  const activePackages = packages.filter(p => p.classes_remaining > 0);
  
  const getPackagePrice = (pkg: any) => {
    const tiersList = db.getTiers();
    const t = tiersList.find(tier => tier.id === pkg.tier_id);
    return t ? Number(t.price) : 1000;
  };

  const totalRunrate = activePackages.reduce((sum, p) => sum + getPackagePrice(p), 0);
  const runRateK = (totalRunrate / 1000).toFixed(0);

  const totalUnbilled = students.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const unbilledK = (totalUnbilled / 1000).toFixed(0);
  const unbilledClasses = students.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const newEnrolmentsThisMonth = students.filter(s => s.join_date && new Date(s.join_date).toISOString().slice(0, 7) === currentMonthStr).length;
  
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
  const newEnrolmentsPrevMonth = students.filter(s => s.join_date && new Date(s.join_date).toISOString().slice(0, 7) === prevMonthStr).length;

  const totalCollected = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0);
  const totalCollectedM = (totalCollected / 1000000).toFixed(2);

  // Bay Avenue metrics
  const bayStudents = students.filter(s => s.centre_id === bayCentreId);
  const activeBay = bayStudents.filter(s => {
    if (!s.last_attended) return false;
    const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
    return diff >= 0 && diff <= 30 && s.status === 'active';
  }).length;
  const activeRateBay = bayStudents.length > 0 ? Math.round((activeBay / bayStudents.length) * 100) : 0;
  const bayClasses30d = attendance.filter(a => a.status === 'present' && bayStudents.some(s => s.id === a.student_id) && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 30)).length;
  const bayRunrate = packages.filter(p => p.classes_remaining > 0 && bayStudents.some(s => s.id === p.student_id)).reduce((sum, p) => sum + getPackagePrice(p), 0);
  const bayUnbilled = bayStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const newBayThisMonth = bayStudents.filter(s => s.join_date && new Date(s.join_date).toISOString().slice(0, 7) === currentMonthStr).length;
  const bayCoaches = new Set(bayStudents.filter(s => s.coach_id).map(s => s.coach_id)).size;

  // JLT metrics
  const jltStudents = students.filter(s => s.centre_id === jltCentreId);
  const activeJlt = jltStudents.filter(s => {
    if (!s.last_attended) return false;
    const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
    return diff >= 0 && diff <= 30 && s.status === 'active';
  }).length;
  const activeRateJlt = jltStudents.length > 0 ? Math.round((activeJlt / jltStudents.length) * 100) : 0;
  const jltClasses30d = attendance.filter(a => a.status === 'present' && jltStudents.some(s => s.id === a.student_id) && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 30)).length;
  const jltRunrate = packages.filter(p => p.classes_remaining > 0 && jltStudents.some(s => s.id === p.student_id)).reduce((sum, p) => sum + getPackagePrice(p), 0);
  const jltUnbilled = jltStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const newJltThisMonth = jltStudents.filter(s => s.join_date && new Date(s.join_date).toISOString().slice(0, 7) === currentMonthStr).length;
  const jltCoaches = new Set(jltStudents.filter(s => s.coach_id).map(s => s.coach_id)).size;

  const activeAdvocates = useMemo(() => {
    return students.map(s => {
      const classes30d = attendance.filter(a => a.student_id === s.id && a.status === 'present' && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 30)).length;
      
      const stPkgs = packages.filter(p => p.student_id === s.id);
      const totalRemaining = stPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);
      
      const coach = coaches.find(c => c.id === s.coach_id);
      const coachName = coach ? coach.name : 'Unassigned';

      const segment = (s.flags?.low_package) ? 'HOT' : 'HEALTHY';

      return {
        ...s,
        classes30d,
        left: totalRemaining,
        coachName,
        segment
      };
    })
    .sort((a, b) => b.classes30d - a.classes30d)
    .slice(0, 10);
  }, [students, attendance, packages, coaches]);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header tab switches */}
      <div className="flex justify-between items-start pb-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">MASTER MOVES</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">
            {activeTab === 'dashboard' ? 'Club Dashboard' : 'Report Builder'}
          </h1>
          {activeTab === 'dashboard' && (
            <p className="text-xs text-muted-custom mt-1">
              Master Moves at a glance. <span className="font-semibold text-ink/80">Note:</span> July 2026 is 12 days old — "this month" figures are month-to-date.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {activeTab === 'dashboard' ? (
            <button 
              onClick={() => setActiveTab('builder')}
              className="bg-[#C4A249] hover:bg-[#C4A249]/90 text-ink font-semibold text-xs px-4 py-2 rounded-lg transition-all"
            >
              + Build a custom report
            </button>
          ) : (
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="bg-forest hover:bg-forest/90 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Slice and Dice Controls bar */}
          <div className="bg-surface border border-line rounded-[14px] p-3 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center text-xs">
              <span className="font-bold text-[#C4A249] uppercase tracking-wider">SLICE</span>
              <select value={filterCentre} onChange={e => setFilterCentre(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="All">All centres</option>
                <option value="Bay Avenue">Bay Avenue</option>
                <option value="JLT">JLT</option>
              </select>
              <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="All">All segments</option>
                <option value="HOT">HOT</option>
                <option value="HEALTHY">HEALTHY</option>
              </select>
              <select value={filterEngagement} onChange={e => setFilterEngagement(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="All">All engagement</option>
                <option value="Engaged">Engaged</option>
                <option value="Slipping">Slipping</option>
              </select>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="All">All levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-3 items-center text-xs">
              <span className="font-bold text-[#C4A249] uppercase tracking-wider">DICE</span>
              <select value={diceBy} onChange={e => setDiceBy(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="By Centre">By Centre</option>
                <option value="By Coach">By Coach</option>
              </select>

              {/* Chart Visual toggles */}
              <div className="flex border border-line rounded-lg overflow-hidden bg-white text-xs">
                {(['bar', 'line', 'donut', 'table'] as const).map(t => (
                  <button 
                    key={t} 
                    onClick={() => setChartType(t)}
                    className={`px-3 py-1 border-r border-line last:border-r-0 font-semibold capitalize transition-all ${chartType === t ? 'bg-[#173F35] text-white' : 'text-muted-custom hover:bg-canvas'}`}
                  >
                    {t === 'donut' ? 'Donut' : t}
                  </button>
                ))}
              </div>

              <button className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all">Reset</button>
              <button className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all">↓ Excel</button>
              <button className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all">PDF</button>
            </div>
          </div>

          {/* Top KPIs row (Dark Green blocks with white text) */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { label: 'TOTAL STUDENTS', value: `${totalStudents}`, desc: 'on the book' },
              { label: 'ACTIVE STUDENTS', value: `${activeStudentsCount}`, desc: `attended in last 30 days · ${activePercent}%` },
              { label: 'RUN-RATE', value: `AED ${runRateK}K`, desc: `per month · AED ${(totalRunrate * 12 / 1000000).toFixed(2)}M annualised` },
              { label: 'UNBILLED', value: `AED ${unbilledK}K`, desc: `${unbilledClasses} classes · ledger-verified` },
              { label: 'ENROLMENTS', value: `${newEnrolmentsThisMonth}`, desc: `MTD · ${newEnrolmentsPrevMonth} prev month` },
              { label: 'LIFETIME COLLECTED', value: `AED ${totalCollectedM}M`, desc: 'zero external capital' }
            ].map((kpi, idx) => (
              <div key={idx} className="bg-[#173F35] text-white border border-[#122F28] rounded-[14px] p-5 shadow-sm space-y-1 relative overflow-hidden">
                <div className="text-[9px] font-bold text-[#9DDDCB] tracking-wider uppercase">{kpi.label}</div>
                <div className="text-2xl font-bold font-display text-white">{kpi.value}</div>
                <div className="text-[10px] text-[#CFE3DC] mt-0.5 leading-tight">{kpi.desc}</div>
              </div>
            ))}
          </div>

          {/* Center Detailed Panel widgets (Exactly as shown in Image 5) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bay Avenue */}
            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-xl font-display text-ink">Bay Avenue</h3>
                <div className="text-[9px] font-bold text-muted-custom tracking-wider uppercase">BUSINESS BAY · FLAGSHIP</div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center border-b border-line pb-4">
                <div><div className="font-bold text-lg text-ink">{bayStudents.length}</div><div className="text-[8px] text-muted-custom uppercase">Students</div></div>
                <div><div className="font-bold text-lg text-ink">{activeBay}</div><div className="text-[8px] text-[#286957] uppercase font-semibold">Active (30d)</div></div>
                <div><div className="font-bold text-lg text-ink">{activeRateBay}%</div><div className="text-[8px] text-muted-custom uppercase">Active Rate</div></div>
                <div><div className="font-bold text-lg text-ink">{bayClasses30d}</div><div className="text-[8px] text-muted-custom uppercase">Classes/30d</div></div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div><div className="font-bold text-sm text-[#286957]">AED ${(bayRunrate / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase">Run-rate /mo</div></div>
                <div><div className="font-bold text-sm text-hot-custom">AED ${(bayUnbilled / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase">Unbilled</div></div>
                <div><div className="font-bold text-sm text-ink">{newBayThisMonth}</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono">New MTD</div></div>
                <div><div className="font-bold text-sm text-ink">{bayCoaches}</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono">Coaches</div></div>
              </div>
            </div>

            {/* JLT */}
            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-xl font-display text-ink">JLT</h3>
                <div className="text-[9px] font-bold text-muted-custom tracking-wider uppercase">SABA TOWER 1 · GROWTH ENGINE</div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center border-b border-line pb-4">
                <div><div className="font-bold text-lg text-ink">{jltStudents.length}</div><div className="text-[8px] text-muted-custom uppercase">Students</div></div>
                <div><div className="font-bold text-lg text-ink">{activeJlt}</div><div className="text-[8px] text-[#286957] uppercase font-semibold font-mono">Active (30d)</div></div>
                <div><div className="font-bold text-lg text-ink">{activeRateJlt}%</div><div className="text-[8px] text-muted-custom uppercase">Active Rate</div></div>
                <div><div className="font-bold text-lg text-ink">{jltClasses30d}</div><div className="text-[8px] text-muted-custom uppercase font-mono">Classes/30d</div></div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div><div className="font-bold text-sm text-[#286957]">AED ${(jltRunrate / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase font-semibold">Run-rate /mo</div></div>
                <div><div className="font-bold text-sm text-hot-custom">AED ${(jltUnbilled / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase">Unbilled</div></div>
                <div><div className="font-bold text-sm text-ink">{newJltThisMonth}</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono">New MTD</div></div>
                <div><div className="font-bold text-sm text-ink">{jltCoaches}</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono">Coaches</div></div>
              </div>
            </div>

            {/* Town Square */}
            <div className="bg-surface border border-[#C4A249] rounded-[14px] p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xl font-display text-ink">Town Square</h3>
                  <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-line bg-canvas text-muted-custom uppercase tracking-wider">Opens 2027</span>
                </div>
                <div className="text-[9px] font-bold text-[#C4A249] tracking-wider uppercase mt-1">ZAHRA BREEZE · OPENS 2027</div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 text-center border-b border-line pb-2 text-xs">
                <div><div className="font-bold text-ink">~32K</div><div className="text-[8px] text-muted-custom uppercase">Target /mo</div></div>
                <div><div className="font-bold text-ink">0</div><div className="text-[8px] text-muted-custom uppercase">Unbilled</div></div>
                <div><div className="font-bold text-ink">—</div><div className="text-[8px] text-muted-custom uppercase">New</div></div>
                <div><div className="font-bold text-ink">2-3</div><div className="text-[8px] text-muted-custom uppercase">Coaches</div></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center pt-2 text-xs">
                <div><div className="font-bold text-[#286957]">≥60%</div><div className="text-[8px] text-muted-custom uppercase">Target Rate</div></div>
                <div><div className="font-bold text-ink">~320</div><div className="text-[8px] text-muted-custom uppercase">Target /30d</div></div>
              </div>

              <div className="text-[9px] text-[#C4A249] font-bold tracking-widest uppercase text-center border-t border-line pt-3 mt-1 leading-normal">
                Modelled on JLT's ramp — the only evidence of a Master Moves centre from a standing start.
              </div>
            </div>
          </div>

          {/* Row 3 - Students by Centre & Enrolments charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold font-display text-ink">Students by Centre</h3>
                  <p className="text-xs text-muted-custom">Dice this with the bar above · All data</p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">↓ Excel</button>
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">PDF</button>
                </div>
              </div>
              <div className="h-60"><canvas ref={studentsChartRef}></canvas></div>
            </div>

            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold font-display text-ink">Enrolments per month</h3>
                  <p className="text-xs text-muted-custom">New students joining · All data. Jul-26 is month-to-date.</p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">↓ Excel</button>
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">PDF</button>
                </div>
              </div>
              <div className="h-60"><canvas ref={enrolmentsChartRef}></canvas></div>
            </div>
          </div>

          {/* Row 4 - Most active this month & Centre comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
            
            {/* Left - Active student roster list */}
            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
                    <span className="text-forest">♟</span> Most active this month
                  </h3>
                  <p className="text-xs text-muted-custom">Top attenders in the last 30 days - All data.</p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">↓ Excel</button>
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">PDF</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-line text-muted-custom">
                      <th className="text-left text-xs font-bold py-2 px-3">#</th>
                      <th className="text-left text-xs font-bold py-2 px-3">Student</th>
                      <th className="text-left text-xs font-bold py-2 px-3">Centre</th>
                      <th className="text-left text-xs font-bold py-2 px-3">Coach</th>
                      <th className="text-right text-xs font-bold py-2 px-3">Classes /30d</th>
                      <th className="text-right text-xs font-bold py-2 px-3">Left</th>
                      <th className="text-right text-xs font-bold py-2 px-3">Segment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAdvocates.map((row, idx) => (
                      <tr key={row.id} className="border-b border-line hover:bg-canvas/40 transition-all text-xs">
                        <td className="py-2.5 px-3 text-muted-custom">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-ink">{row.name}</td>
                        <td className="py-2.5 px-3 text-ink">{row.centre_id === jltCentreId ? 'JLT' : 'Bay Avenue'}</td>
                        <td className="py-2.5 px-3 text-ink">{row.coachName}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-ink">{row.classes30d}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{row.left}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${
                            row.segment === 'HEALTHY' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                              : 'bg-red-50 border border-red-200 text-hot-custom'
                          }`}>
                            {row.segment}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-muted-custom pt-1">
                These are your advocates — the referral and testimonial pool.
              </div>
            </div>

            {/* Right - Centre comparison & comparison matrix */}
            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold font-display text-ink">Centre comparison</h3>
                <p className="text-xs text-muted-custom">Active vs inactive, side by side · All data</p>
              </div>
              <div className="h-44"><canvas ref={comparisonChartRef}></canvas></div>
              
              {/* Metrics Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted-custom">
                      <th className="text-left py-2 font-bold uppercase tracking-wider">Metric</th>
                      <th className="text-right py-2 font-bold uppercase tracking-wider">Bay Avenue</th>
                      <th className="text-right py-2 font-bold uppercase tracking-wider">JLT</th>
                      <th className="text-right py-2 font-bold uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { m: 'Students', bay: bayStudents.length.toString(), jlt: jltStudents.length.toString(), tot: students.length.toString() },
                      { m: 'Active (30d)', bay: activeBay.toString(), jlt: activeJlt.toString(), tot: (activeBay + activeJlt).toString() },
                      { m: 'Active rate', bay: `${activeRateBay}%`, jlt: `${activeRateJlt}%`, tot: `${students.length > 0 ? Math.round(((activeBay + activeJlt) / students.length) * 100) : 0}%` },
                      { m: 'Classes / 30d', bay: bayClasses30d.toString(), jlt: jltClasses30d.toString(), tot: (bayClasses30d + jltClasses30d).toString() },
                      { m: 'Run-rate / month', bay: `AED ${bayRunrate.toLocaleString()}`, jlt: `AED ${jltRunrate.toLocaleString()}`, tot: `AED ${(bayRunrate + jltRunrate).toLocaleString()}` },
                      { m: 'Unbilled', bay: `AED ${bayUnbilled.toLocaleString()}`, jlt: `AED ${jltUnbilled.toLocaleString()}`, tot: `AED ${(bayUnbilled + jltUnbilled).toLocaleString()}` },
                      { m: 'Enrolments (Jul MTD)', bay: newBayThisMonth.toString(), jlt: newJltThisMonth.toString(), tot: (newBayThisMonth + newJltThisMonth).toString() },
                    ].map((row, idx) => (
                      <tr key={idx} className="border-b border-line hover:bg-canvas/30 text-ink">
                        <td className="py-2.5 font-medium">{row.m}</td>
                        <td className="py-2.5 text-right font-mono">{row.bay}</td>
                        <td className="py-2.5 text-right font-mono">{row.jlt}</td>
                        <td className="py-2.5 text-right font-mono font-bold">{row.tot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <div className="text-[10px] text-muted-custom text-center pt-2">
            • Live data · {students.length} students · {packages.length} packages - as at 12 Jul 2026. All figures computed, none hard-coded.
          </div>

        </div>
      )}

      {/* REPORT BUILDER TAB */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          
          {/* Left Form side options */}
          <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-6">
            <div>
              <h3 className="font-bold text-sm text-ink mb-1">Sections</h3>
              <p className="text-[10px] text-muted-custom">Click a section to edit. 2 in this report.</p>
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => { setActiveSectionId(1); setSectionTitle('Key numbers'); }}
                className={`w-full text-left p-3 rounded-lg border text-xs font-semibold transition-all ${activeSectionId === 1 ? 'border-[#C4A249] bg-[#C4A249]/5 text-ink' : 'border-line text-muted-custom hover:bg-canvas'}`}
              >
                ♦ 1. Key numbers
              </button>
              <button 
                onClick={() => { setActiveSectionId(2); setSectionTitle('Breakdown'); }}
                className={`w-full text-left p-3 rounded-lg border text-xs font-semibold transition-all ${activeSectionId === 2 ? 'border-[#C4A249] bg-[#C4A249]/5 text-ink' : 'border-line text-muted-custom hover:bg-canvas'}`}
              >
                ⚙ 2. Breakdown
              </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-line">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-custom uppercase">Section Title</label>
                <input 
                  type="text" 
                  value={sectionTitle} 
                  onChange={e => setSectionTitle(e.target.value)}
                  className="bg-white border border-line rounded-lg px-2 py-1 text-xs text-ink outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-custom uppercase">Measures (KPI Cards)</label>
                <div className="flex flex-wrap gap-1">
                  {[
                    'Students', 'Run-rate AED / month', 'Unbilled value — ledger (AED)',
                    'Lifetime paid (AED)', 'Unbilled classes — ledger', 'Student-classes 30d',
                    'Student-classes 90d', 'Avg rate / class (AED)', 'Avg days since last class',
                    'Avg lifetime paid (AED)', '% Engaged'
                  ].map(m => {
                    const isPicked = selectedMeasures.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => handleMeasureToggle(m)}
                        className={`text-[9px] px-2 py-1 rounded-full border transition-all ${isPicked ? 'bg-forest text-white border-forest' : 'bg-white border-line text-muted-custom'}`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-4 border-t border-line">
                <label className="text-[10px] font-bold text-muted-custom uppercase">Filters — This section only</label>
                <select className="bg-white border border-line rounded-lg px-2 py-1 text-xs text-ink outline-none">
                  <option>All centres</option>
                  <option>Bay Avenue</option>
                  <option>JLT</option>
                </select>
                <select className="bg-white border border-line rounded-lg px-2 py-1 text-xs text-ink outline-none">
                  <option>All buckets</option>
                </select>
                <select className="bg-white border border-line rounded-lg px-2 py-1 text-xs text-ink outline-none">
                  <option>All engagement</option>
                </select>
                <select className="bg-white border border-line rounded-lg px-2 py-1 text-xs text-ink outline-none">
                  <option>All levels</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Live Report preview */}
          <div className="space-y-6">
            
            {/* Header builder bar */}
            <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-muted-custom uppercase">Report</span>
                <input 
                  type="text" 
                  value={reportTitle} 
                  onChange={e => setReportTitle(e.target.value)}
                  className="bg-white border border-line rounded-lg px-3 py-1 font-semibold text-ink w-64 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-muted-custom uppercase">Template</span>
                <select className="bg-white border border-line rounded-lg px-2 py-1 text-xs text-ink outline-none">
                  <option>Start from...</option>
                </select>
                <button className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1 rounded-lg">Definition (JSON)</button>
                <button className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1 rounded-lg">Import</button>
                <button className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1 rounded-lg">PDF</button>
              </div>
            </div>

            {/* Custom Report Live Preview Document */}
            <div className="bg-surface border border-line rounded-[14px] overflow-hidden shadow-sm">
              <div className="p-6 bg-fd text-white">
                <div className="text-[10px] font-bold tracking-widest text-[#9DDDCB] uppercase font-display">MASTER MOVES · CUSTOM REPORT</div>
                <h2 className="text-2xl font-bold font-display mt-1 text-white">{reportTitle}</h2>
                <p className="text-xs text-[#CFE3DC] mt-1">Computed live from the platform dataset - 362 students - ledger-basis financials</p>
              </div>

              {/* Preview Content sections */}
              <div className="p-6 space-y-6">
                
                {/* 1. Key Numbers Section */}
                <div className="border border-line rounded-[14px] p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-line pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#C4A249]">♦ {sectionTitle}</h4>
                      <span className="text-[10px] text-muted-custom">All students · 362 students</span>
                    </div>
                    <div className="flex gap-1 text-[10px] text-muted-custom">
                      <button className="border border-line rounded px-1.5 py-0.5 hover:bg-canvas">↑</button>
                      <button className="border border-line rounded px-1.5 py-0.5 hover:bg-canvas">↓</button>
                      <button className="border border-line rounded px-1.5 py-0.5 hover:bg-canvas">✕</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedMeasures.includes('Students') && (
                      <div className="bg-canvas/30 border border-line rounded-lg p-3">
                        <div className="text-[9px] font-bold text-muted-custom uppercase">Students</div>
                        <div className="text-2xl font-bold mt-1 text-ink">{totalStudents}</div>
                        <div className="text-[10px] text-muted-custom mt-0.5">{totalStudents} students in scope</div>
                      </div>
                    )}
                    {selectedMeasures.includes('Run-rate AED / month') && (
                      <div className="bg-canvas/30 border border-line rounded-lg p-3">
                        <div className="text-[9px] font-bold text-muted-custom uppercase">Run-rate AED / month</div>
                        <div className="text-2xl font-bold mt-1 text-ink">AED {runRateK}K</div>
                        <div className="text-[10px] text-muted-custom mt-0.5">{totalStudents} students in scope</div>
                      </div>
                    )}
                    {selectedMeasures.includes('Unbilled value — ledger (AED)') && (
                      <div className="bg-canvas/30 border border-line rounded-lg p-3">
                        <div className="text-[9px] font-bold text-muted-custom uppercase">Unbilled value — ledger (AED)</div>
                        <div className="text-2xl font-bold mt-1 text-ink">AED {unbilledK}K</div>
                        <div className="text-[10px] text-muted-custom mt-0.5">{totalStudents} students in scope</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Breakdown Section */}
                <div className="border border-line rounded-[14px] p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-line pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#C4A249]">⚙ Breakdown</h4>
                      <span className="text-[10px] text-muted-custom">All students · {totalStudents} students</span>
                    </div>
                    <div className="flex gap-1 text-[10px] text-muted-custom">
                      <button className="border border-line rounded px-1.5 py-0.5 hover:bg-canvas">↑</button>
                      <button className="border border-line rounded px-1.5 py-0.5 hover:bg-canvas">↓</button>
                      <button className="border border-line rounded px-1.5 py-0.5 hover:bg-canvas">✕</button>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs">
                    2 groups by Centre. Top: <b className="text-forest">Bay Avenue at AED {(bayRunrate / 1000).toFixed(0)}K</b> ({totalRunrate > 0 ? Math.round((bayRunrate / totalRunrate) * 100) : 0}% of AED {runRateK}K). Scope: {totalStudents} students.
                  </div>

                  <div className="h-44"><canvas ref={builderChartRef}></canvas></div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
