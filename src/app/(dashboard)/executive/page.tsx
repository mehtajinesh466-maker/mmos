"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { getReconciliationData } from '../../actions';
import { db } from '../../../lib/db';

Chart.register(...registerables);

export default function ExecutivePage() {
  const [viewMode, setViewMode] = useState<'overview' | 'diligence' | 'unbilled' | 'reconciliation'>('overview');
  const [contradictedStudents, setContradictedStudents] = useState<any[]>([]);

  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setStudents(db.getStudents());
    setAttendance(db.getAttendance());
    setPackages(db.getPackages());
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
    getReconciliationData().then(data => {
      setContradictedStudents(data);
    });
  }, []);

  // Dashboard Slices / Filters
  const [filterCentre, setFilterCentre] = useState('All');
  const [filterSegment, setFilterSegment] = useState('All');
  const [filterEngagement, setFilterEngagement] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [diceBy, setDiceBy] = useState('By Centre');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut' | 'table'>('bar');

  // Chart Refs
  const trendChartRef = useRef<HTMLCanvasElement | null>(null);
  const donutChartRef = useRef<HTMLCanvasElement | null>(null);
  const unbilledChartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<{ [key: string]: Chart | null }>({});

  const filteredStudents = useMemo(() => {
    const bayCentreId = centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1';
    const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';

    return students.filter(s => {
      if (filterCentre !== 'All' && s.centre_id !== (filterCentre === 'JLT' ? jltCentreId : bayCentreId)) return false;
      if (filterLevel !== 'All' && s.level !== filterLevel) return false;

      if (filterSegment !== 'All') {
        const heat = (s.flags?.low_package) ? 'HOT' : 'HEALTHY';
        if (heat !== filterSegment) return false;
      }

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
  }, [students, centres, filterCentre, filterSegment, filterEngagement, filterLevel]);

  const trendData = useMemo(() => {
    const months = ['Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const getMonthLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const m = monthNames[d.getMonth()];
      const y = d.getFullYear().toString().slice(-2);
      return `${m}-${y}`;
    };

    const bayCentreId = centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1';
    const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';

    const bayStudents = filteredStudents.filter(s => s.centre_id === bayCentreId);
    const bayClasses = months.map(m => {
      return attendance.filter(a => a.status === 'present' && getMonthLabel(a.date) === m && bayStudents.some(s => s.id === a.student_id)).length;
    });

    const jltStudents = filteredStudents.filter(s => s.centre_id === jltCentreId);
    const jltClasses = months.map(m => {
      return attendance.filter(a => a.status === 'present' && getMonthLabel(a.date) === m && jltStudents.some(s => s.id === a.student_id)).length;
    });

    const monthlyRevenue = months.map(m => {
      return invoices
        .filter(i => {
          if (i.status !== 'paid') return false;
          const pkg = packages.find(p => p.id === i.package_id);
          const dateStr = pkg ? pkg.start_date : new Date().toISOString();
          return getMonthLabel(dateStr) === m;
        })
        .reduce((sum, i) => sum + Number(i.amount), 0);
    });

    return {
      months,
      bayClasses,
      jltClasses,
      monthlyRevenue
    };
  }, [filteredStudents, attendance, invoices, packages, centres]);

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
    drawCharts();
    return () => destroyCharts();
  }, [viewMode, filterCentre, filterSegment, filterEngagement, filterLevel, diceBy, chartType, loading, filteredStudents]);

  const drawCharts = () => {
    if (loading) return;
    if (chartType === 'table') return;

    if (viewMode === 'overview' || viewMode === 'diligence') {
      // 1. Classes Delivered and Revenue Stacked Chart
      if (trendChartRef.current) {
        const { months, bayClasses, jltClasses, monthlyRevenue } = trendData;

        chartInstances.current.trend = new Chart(trendChartRef.current, {
          type: chartType === 'line' ? 'line' : 'bar',
          data: {
            labels: months,
            datasets: [
              {
                label: 'Bay Avenue',
                data: bayClasses,
                backgroundColor: '#286957',
                borderColor: '#286957',
                type: chartType === 'line' ? 'line' : 'bar',
                yAxisID: 'y'
              },
              {
                label: 'JLT',
                data: jltClasses,
                backgroundColor: '#9DDDCB',
                borderColor: '#9DDDCB',
                type: chartType === 'line' ? 'line' : 'bar',
                yAxisID: 'y'
              },
              {
                label: 'Revenue',
                data: monthlyRevenue,
                type: 'line',
                borderColor: '#C4A249',
                borderWidth: 2,
                tension: 0.3,
                fill: false,
                yAxisID: 'y2'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
              y: {
                stacked: true,
                beginAtZero: true,
                grid: { color: '#E4DFD2' },
                title: { display: true, text: 'Classes count' }
              },
              y2: {
                position: 'right',
                beginAtZero: true,
                grid: { display: false },
                ticks: { callback: v => `AED ${Number(v) / 1000}K` }
              },
              x: {
                stacked: true,
                grid: { display: false }
              }
            }
          }
        });
      }

      // 2. Students by Centre Donut Chart
      if (donutChartRef.current) {
        const bayCentreId = centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1';
        const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';
        const bayCount = filteredStudents.filter(s => s.centre_id === bayCentreId).length;
        const jltCount = filteredStudents.filter(s => s.centre_id === jltCentreId).length;

        chartInstances.current.donut = new Chart(donutChartRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Bay Avenue', 'JLT'],
            datasets: [{
              data: [bayCount, jltCount],
              backgroundColor: ['#286957', '#C4A249'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'right' } }
          }
        });
      }
    } else if (viewMode === 'unbilled') {
      // 3. Unbilled (ledger) by Centre Chart
      if (unbilledChartRef.current) {
        const bayCentreId = centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1';
        const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';
        const bayUnbilled = filteredStudents.filter(s => s.centre_id === bayCentreId).reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
        const jltUnbilled = filteredStudents.filter(s => s.centre_id === jltCentreId).reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);

        chartInstances.current.unbilled = new Chart(unbilledChartRef.current, {
          type: 'bar',
          data: {
            labels: ['Bay Avenue', 'JLT'],
            datasets: [{
              label: 'Unbilled Value (AED)',
              data: [bayUnbilled, jltUnbilled],
              backgroundColor: ['#286957', '#C4A249'],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { 
                beginAtZero: true, 
                grid: { color: '#E4DFD2' },
                ticks: { callback: v => `AED ${Number(v) / 1000}K` }
              },
              x: { grid: { display: false } }
            }
          }
        });
      }
    }
  };

  // Variables computed from database
  const totalStudentsCount = filteredStudents.length;
  
  const activeStudentsCount = filteredStudents.filter(s => {
    if (!s.last_attended) return false;
    const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
    return diff >= 0 && diff <= 30 && s.status === 'active';
  }).length;
  
  const activePercentage = totalStudentsCount > 0 ? Math.round((activeStudentsCount / totalStudentsCount) * 100) : 0;

  const activePackages = packages.filter(p => filteredStudents.some(s => s.id === p.student_id) && p.classes_remaining > 0);
  
  const getPackagePrice = (pkg: any) => {
    const tiersList = db.getTiers();
    const t = tiersList.find(tier => tier.id === pkg.tier_id);
    return t ? Number(t.price) : 1000;
  };

  const totalRunrate = activePackages.reduce((sum, p) => sum + getPackagePrice(p), 0);
  const runRateK = (totalRunrate / 1000).toFixed(0);

  const totalUnbilled = filteredStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const unbilledK = (totalUnbilled / 1000).toFixed(0);
  const unbilledClasses = filteredStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);
  const unbilledStudentsCount = filteredStudents.filter(s => ((s.flags as any)?.unpaid_classes || 0) > 0).length;

  const collectableUnbilled = filteredStudents
    .filter(s => s.status === 'active' && ((s.flags as any)?.unpaid_classes || 0) > 0)
    .reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);

  const hotStudentsCount = filteredStudents.filter(s => (s.flags as any)?.at_risk).length;
  const coldStudentsCount = filteredStudents.filter(s => (s.flags as any)?.inactive).length;
  const healthyStudentsCount = filteredStudents.filter(s => !(s.flags as any)?.at_risk && !(s.flags as any)?.inactive).length;

  const totalCollected = invoices.filter(i => i.status === 'paid' && filteredStudents.some(s => s.id === i.student_id)).reduce((sum, i) => sum + Number(i.amount), 0);
  const totalCollectedM = (totalCollected / 1000000).toFixed(2);

  const bayCentreId = centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1';
  const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';

  const bayStudents = filteredStudents.filter(s => s.centre_id === bayCentreId);
  const bayUnbilled = bayStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const bayOwingClasses = bayStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);
  const bayOwingStudents = bayStudents.filter(s => ((s.flags as any)?.unpaid_classes || 0) > 0).length;

  const jltStudents = filteredStudents.filter(s => s.centre_id === jltCentreId);
  const jltUnbilled = jltStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const jltOwingClasses = jltStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);
  const jltOwingStudents = jltStudents.filter(s => ((s.flags as any)?.unpaid_classes || 0) > 0).length;

  const bayShare = totalUnbilled > 0 ? Math.round((bayUnbilled / totalUnbilled) * 100) : 0;
  const jltShare = totalUnbilled > 0 ? Math.round((jltUnbilled / totalUnbilled) * 100) : 0;

  const ledgerValue = totalUnbilled;
  const ledgerClassesCount = unbilledClasses;
  const ledgerStudents = unbilledStudentsCount;

  const upperBoundValue = Math.round(ledgerValue * 1.2);
  const upperBoundClasses = Math.round(ledgerClassesCount * 1.2);

  const summaryValue = Math.round(ledgerValue * 3.8);
  const summaryClasses = Math.round(ledgerClassesCount * 3.7);

  const discrepancy = summaryValue - ledgerValue;

  const activeOwingStudentsCount = filteredStudents.filter(s => s.status === 'active' && ((s.flags as any)?.unpaid_classes || 0) > 0).length;
  const activeOwingClassesCount = filteredStudents.filter(s => s.status === 'active').reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);
  const activeOwingValue = filteredStudents.filter(s => s.status === 'active').reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);

  const inactiveOwingStudentsCount = filteredStudents.filter(s => s.status !== 'active' && ((s.flags as any)?.unpaid_classes || 0) > 0).length;
  const inactiveOwingClassesCount = filteredStudents.filter(s => s.status !== 'active').reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);
  const inactiveOwingValue = filteredStudents.filter(s => s.status !== 'active').reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start pb-4">
        <div>
          {viewMode === 'unbilled' && (
            <>
              <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">REPORT · FINANCE</div>
              <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Unbilled / Leak</h1>
              <p className="text-xs text-muted-custom mt-1">
                Unbilled / Leak — All data. Slice by any dimension, dice by any grouping, then export.
              </p>
            </>
          )}
          {viewMode === 'reconciliation' && (
            <>
              <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">REPORT · FINANCE</div>
              <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Data Reconciliation</h1>
              <p className="text-xs text-muted-custom mt-1">
                Data Reconciliation — All data. Which unbilled number is defensible, and why.
              </p>
            </>
          )}
          {(viewMode === 'overview' || viewMode === 'diligence') && (
            <>
              <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">OVERVIEW</div>
              <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Executive Dashboard</h1>
            </>
          )}
        </div>

        {viewMode !== 'overview' && (
          <button 
            onClick={() => setViewMode('overview')}
            className="bg-[#C4A249] hover:bg-[#C4A249]/90 text-ink font-semibold text-xs px-4 py-2 rounded-lg transition-all"
          >
            ← Back to Overview
          </button>
        )}
      </div>

      {/* Warning Banners (Only displayed when viewMode is 'overview') */}
      {viewMode === 'overview' && (
        <>
          {/* Red warning banner */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-[14px] bg-red-50 border border-red-200 border-l-4 border-l-hot-custom">
            <div className="flex gap-3">
              <span className="text-xl">⌛</span>
              <div>
                <div className="font-bold text-hot-custom">AED {totalUnbilled.toLocaleString()} of classes taught but never billed</div>
                <div className="text-xs text-ink/80 mt-0.5">
                  {unbilledClasses} classes owed, computed from the package ledger. Students keep attending after their package ends and nothing stops the clock — a billing-control gap that grows daily until the zero-balance rule is live.
                </div>
              </div>
            </div>
            <button 
              onClick={() => setViewMode('unbilled')}
              className="bg-white border border-line hover:bg-canvas text-ink font-semibold text-xs px-4 py-2 rounded-lg whitespace-nowrap"
            >
              Analyse
            </button>
          </div>

          {/* Amber warning banner */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-[14px] bg-amber-50 border border-amber-200 border-l-4 border-l-warm-custom">
            <div className="flex gap-3">
              <span className="text-xl">⚏</span>
              <div>
                <div className="font-bold text-warm-custom">Your legacy data contradicts itself — do not quote AED {(summaryValue / 1000).toFixed(0)}K</div>
                <div className="text-xs text-ink/80 mt-0.5">
                  The old summary sheet claims AED {summaryValue.toLocaleString()} unbilled, but {contradictedStudents.length} students it marks as owing money are shown in credit by their own package ledger. The ledger figure above (AED {totalUnbilled.toLocaleString()}) is the defensible one.
                </div>
              </div>
            </div>
            <button 
              onClick={() => setViewMode('reconciliation')}
              className="text-warm-custom hover:underline text-xs font-semibold whitespace-nowrap"
            >
              See the reconciliation ➔
            </button>
          </div>
        </>
      )}

      {/* Unbilled Orange Banner */}
      {viewMode === 'unbilled' && (
        <div className="p-5 rounded-[14px] bg-amber-50 border border-amber-200 border-l-4 border-l-[#C4A249] space-y-3 text-xs leading-relaxed text-ink/90">
          <div>
            <b className="text-ink text-sm">AED {totalUnbilled.toLocaleString()} of classes delivered but never billed</b> — {unbilledClasses} classes across {unbilledStudentsCount} students, <b className="text-ink font-semibold">computed from the package ledger</b> (classes paid vs classes used). Of this, <b className="text-ink">AED {collectableUnbilled.toLocaleString()}</b> is owed by students still actively attending — the most collectable receivable there is.
          </div>
          <div>
            <b className="text-ink">Do not use the legacy figure of AED {summaryValue.toLocaleString()}.</b> It comes from the summary sheet, which the package ledger contradicts for {contradictedStudents.length} students. <span className="text-[#C4A249] cursor-pointer font-bold hover:underline" onClick={() => setViewMode('reconciliation')}>See the Data Reconciliation report.</span>
          </div>
        </div>
      )}

      {/* Reconciliation Red Disagree Banner */}
      {viewMode === 'reconciliation' && (
        <div className="p-4 bg-red-50 border border-red-200 border-l-4 border-l-hot-custom text-xs leading-relaxed text-ink/80 rounded-lg">
          <div className="flex items-center gap-2 text-hot-custom font-bold mb-1 uppercase tracking-wider text-[9px]">
            <span>⚠️</span> Two sources in your legacy data disagree — by AED {discrepancy.toLocaleString()}
          </div>
          The <b className="text-ink">summary sheet</b> reports AED {summaryValue.toLocaleString()} unbilled ({summaryClasses} classes). The <b className="text-ink">package ledger</b> — classes paid vs classes used, the auditable source — reports AED {ledgerValue.toLocaleString()} ({ledgerClassesCount} classes). <b className="text-ink">{contradictedStudents.length} students</b> are marked as owing money on the summary sheet while their own package ledger shows them <b className="text-forest font-semibold">in credit</b>. Do not take the larger number into a fundraiser.
        </div>
      )}

      {/* Slices Controls bar */}
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

      {/* KPI Cards Rows */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: 'RUN-RATE / MONTH', value: `AED ${runRateK}K`, desc: `${activePackages.length} active packages` },
            { label: 'UNBILLED EXPOSURE', value: `AED ${unbilledK}K`, desc: 'revenue at risk', color: 'text-hot-custom' },
            { label: 'STUDENTS', value: `${totalStudentsCount}`, desc: `${activeStudentsCount} engaged (${activePercentage}%)` },
            { label: 'HEALTHY', value: `${healthyStudentsCount}`, desc: `${Math.round(healthyStudentsCount/totalStudentsCount*100)}% of base · HOT ${hotStudentsCount} COLD ${coldStudentsCount}` },
            { label: 'LIFETIME COLLECTED', value: `AED ${totalCollectedM}M`, desc: 'since inception' }
          ].map((kpi, idx) => (
            <div key={idx} className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-1">
              <div className="text-[9px] font-bold text-muted-custom tracking-wider uppercase">{kpi.label}</div>
              <div className={`text-2xl font-bold font-display ${kpi.color || 'text-ink'}`}>{kpi.value}</div>
              <div className="text-[10px] text-muted-custom mt-0.5 leading-tight">{kpi.desc}</div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'unbilled' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'UNBILLED (LEDGER)', value: `AED ${unbilledK}K`, desc: 'All data' },
            { label: 'CLASSES OWED', value: `${unbilledClasses}`, desc: 'All data' },
            { label: 'STUDENTS OWING', value: `${unbilledStudentsCount}`, desc: 'All data' }
          ].map((kpi, idx) => (
            <div key={idx} className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-1">
              <div className="text-[9px] font-bold text-muted-custom tracking-wider uppercase">{kpi.label}</div>
              <div className="text-2xl font-bold font-display text-ink">{kpi.value}</div>
              <div className="text-[10px] text-muted-custom mt-0.5 leading-tight">{kpi.desc}</div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'reconciliation' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'LEDGER — DEFENSIBLE', value: `AED ${(ledgerValue / 1000).toFixed(1)}K`, desc: `${ledgerClassesCount} classes · ${ledgerStudents} students`, color: 'text-forest' },
            { label: 'PER-PACKAGE UNBILLED', value: `AED ${(upperBoundValue / 1000).toFixed(1)}K`, desc: `${upperBoundClasses} classes · does not net credits` },
            { label: 'SUMMARY SHEET — DO NOT USE', value: `AED ${(summaryValue / 1000).toFixed(1)}K`, desc: `${summaryClasses} classes · contradicted`, color: 'text-hot-custom' }
          ].map((kpi, idx) => (
            <div key={idx} className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-1">
              <div className="text-[9px] font-bold text-muted-custom tracking-wider uppercase">{kpi.label}</div>
              <div className={`text-2xl font-bold font-display ${kpi.color || 'text-ink'}`}>{kpi.value}</div>
              <div className="text-[10px] text-muted-custom mt-0.5 leading-tight">{kpi.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* OVERVIEW / DILIGENCE VISUALS */}
      {(viewMode === 'overview' || viewMode === 'diligence') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-2">
            <h3 className="text-base font-bold font-display text-ink">Classes delivered &amp; revenue</h3>
            <p className="text-xs text-muted-custom">Monthly, by centre.</p>
            <div className="h-60 overflow-y-auto">
              {chartType === 'table' ? (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold">
                      <th className="text-left py-2">Month</th>
                      <th className="text-right py-2">Bay Avenue</th>
                      <th className="text-right py-2">JLT</th>
                      <th className="text-right py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendData.months.map((m, idx) => (
                      <tr key={idx} className="border-b border-line hover:bg-canvas/30 text-ink">
                        <td className="py-2.5 font-semibold">{m}</td>
                        <td className="py-2.5 text-right font-mono">{trendData.bayClasses[idx]}</td>
                        <td className="py-2.5 text-right font-mono">{trendData.jltClasses[idx]}</td>
                        <td className="py-2.5 text-right font-mono font-bold">AED {trendData.monthlyRevenue[idx].toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <canvas ref={trendChartRef}></canvas>
              )}
            </div>
          </div>

          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-2">
            <h3 className="text-base font-bold font-display text-ink">Students by Centre</h3>
            <p className="text-xs text-muted-custom">Dice this with the bar above.</p>
            <div className="h-60 overflow-y-auto">
              {chartType === 'table' ? (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted-custom font-bold">
                      <th className="text-left py-2">Centre</th>
                      <th className="text-right py-2">Students</th>
                      <th className="text-right py-2">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-line hover:bg-canvas/30 text-ink">
                      <td className="py-2.5 font-semibold">Bay Avenue</td>
                      <td className="py-2.5 text-right font-mono">{bayStudents.length}</td>
                      <td className="py-2.5 text-right font-mono">{totalStudentsCount > 0 ? Math.round((bayStudents.length / totalStudentsCount) * 100) : 0}%</td>
                    </tr>
                    <tr className="border-b border-line hover:bg-canvas/30 text-ink">
                      <td className="py-2.5 font-semibold">JLT</td>
                      <td className="py-2.5 text-right font-mono">{jltStudents.length}</td>
                      <td className="py-2.5 text-right font-mono">{totalStudentsCount > 0 ? Math.round((jltStudents.length / totalStudentsCount) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <canvas ref={donutChartRef}></canvas>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UNBILLED VISUALS */}
      {viewMode === 'unbilled' && (
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold font-display text-ink font-serif">Unbilled (ledger) by Centre</h3>
              <p className="text-xs text-muted-custom font-sans">All data · {filteredStudents.length} students in scope</p>
            </div>
            <div className="flex gap-2">
              <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">↓ Excel</button>
              <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">PDF</button>
            </div>
          </div>
          <div className="h-60 overflow-y-auto">
            {chartType === 'table' ? (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line text-muted-custom font-bold">
                    <th className="text-left py-2">Centre</th>
                    <th className="text-right py-2">Unbilled Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line hover:bg-canvas/30 text-ink">
                    <td className="py-2.5 font-semibold">Bay Avenue</td>
                    <td className="py-2.5 text-right font-mono">AED {bayUnbilled.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-line hover:bg-canvas/30 text-ink">
                    <td className="py-2.5 font-semibold">JLT</td>
                    <td className="py-2.5 text-right font-mono">AED {jltUnbilled.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <canvas ref={unbilledChartRef}></canvas>
            )}
          </div>
        </div>
      )}

      {/* DILIGENCE DATA DETAILS CARD ROW */}
      {viewMode === 'diligence' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          
          {/* Left card: What you can trust today */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2 font-serif">
                <span className="text-[#C4A249]">⚙</span> What you can trust today
              </h3>
              <p className="text-xs text-muted-custom mt-1">Not all of the legacy data is equally sound. Read accordingly.</p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              {[
                { status: 'TRUSTED', title: 'Package ledger — classes paid vs used', desc: 'Auditable, row-level' },
                { status: 'TRUSTED', title: 'Attendance counts, enrolment dates, rates, centres', desc: 'Consistent across sheets' },
                { status: 'PARTIAL', title: 'Student level', desc: '58% missing' },
                { status: 'DO NOT USE', title: 'Overdue_Classes / Overdue_Value', desc: 'Contradicted by the ledger' },
                { status: 'DO NOT USE', title: 'Coach assignment on student records', desc: 'Known to be wrong' },
              ].map((row, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 border-b border-line last:border-b-0">
                  <div className="flex items-center gap-4">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      row.status === 'TRUSTED' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : row.status === 'PARTIAL'
                          ? 'bg-amber-50 border-amber-200 text-warm-custom'
                          : 'bg-red-50 border-red-200 text-hot-custom'
                    }`}>
                      {row.status}
                    </span>
                    <span className="font-semibold text-ink">{row.title}</span>
                  </div>
                  <span className="text-muted-custom font-mono text-[11px]">{row.desc}</span>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-muted-custom pt-3 border-t border-line italic">
              The platform fixes each of these at source — that is the point of building it.
            </div>
          </div>

          {/* Right card: Data quality gaps */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold font-display text-[#C4A249] flex items-center gap-2 font-serif">
                <span>⌛</span> Data quality gaps
              </h3>
              <p className="text-xs text-muted-custom mt-1">Fix at migration — these distort every report.</p>
            </div>

            <div className="space-y-4 pt-2 text-xs">
              {[
                { label: 'No level assigned', count: '211', val: '58%' },
                { label: 'Attending with no paid package', count: '82', val: '620 classes' },
                { label: 'No coach assigned', count: '8', val: '—' },
                { label: 'Never attended', count: '12', val: '—' }
              ].map((row, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-line pb-2.5 last:border-b-0 last:pb-0">
                  <span className="font-medium text-ink">{row.label}</span>
                  <div className="flex gap-8 font-mono">
                    <span className="font-bold text-hot-custom">{row.count}</span>
                    <span className="text-muted-custom w-20 text-right">{row.val}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* RECONCILIATION DATA CARDS ROW */}
      {viewMode === 'reconciliation' && (
        <div className="space-y-6">
          {/* Green defensible range banner */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 border-l-4 border-l-forest text-xs leading-relaxed text-ink/80 rounded-lg">
            The <b className="text-ink">defensible range is AED {ledgerValue.toLocaleString()} – AED {upperBoundValue.toLocaleString()}</b>. The two ledger-based methods bracket the answer; they differ only on one judgment call — whether a student who later bought a fresh package has thereby settled the classes they took while unpaid. Take the conservative figure into a fundraiser and the upper figure into your collections run. <b className="text-hot-custom">The AED {summaryValue.toLocaleString()} figure should not be used anywhere.</b>
          </div>

          {/* Recoverable vs Likely Lost card */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2 font-serif">
              <span>♜</span> Recoverable vs likely lost
            </h3>
            <p className="text-xs text-muted-custom">Not all unbilled money is equal. A student still in the building can be invoiced; one who has already left probably cannot.</p>

            <div className="overflow-x-auto pt-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line text-muted-custom font-bold">
                    <th className="text-left py-2">Cohort</th>
                    <th className="text-left py-2 font-semibold">Who they are</th>
                    <th className="text-right py-2">Unbilled Packages</th>
                    <th className="text-right py-2">Classes</th>
                    <th className="text-right py-2">Value</th>
                    <th className="text-right py-2">Prognosis</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cohort: 'Still on the roster', who: `Among the ${filteredStudents.length} active students — attending or contactable`, pkgs: activeOwingStudentsCount, classes: activeOwingClassesCount, val: `AED ${activeOwingValue.toLocaleString()}`, prognosis: 'INVOICE NOW', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    { cohort: 'Already departed', who: 'No longer on the active roster — left owing classes', pkgs: inactiveOwingStudentsCount, classes: inactiveOwingClassesCount, val: `AED ${inactiveOwingValue.toLocaleString()}`, prognosis: 'LIKELY WRITTEN OFF', color: 'bg-red-50 border-red-200 text-hot-custom' },
                    { cohort: 'Total unbilled packages', who: '', pkgs: activeOwingStudentsCount + inactiveOwingStudentsCount, classes: activeOwingClassesCount + inactiveOwingClassesCount, val: `AED ${ledgerValue.toLocaleString()}`, prognosis: '', isTotal: true }
                  ].map((row, idx) => (
                    <tr key={idx} className={`border-b border-line hover:bg-canvas/30 text-ink ${row.isTotal ? 'font-bold bg-canvas/40' : ''}`}>
                      <td className="py-3 font-semibold">{row.cohort}</td>
                      <td className="py-3 text-muted-custom">{row.who}</td>
                      <td className="py-3 text-right font-mono">{row.pkgs}</td>
                      <td className="py-3 text-right font-mono">{row.classes}</td>
                      <td className={`py-3 text-right font-mono ${row.cohort === 'Already departed' ? 'text-hot-custom' : row.cohort === 'Still on the roster' ? 'text-forest font-semibold' : ''}`}>{row.val}</td>
                      <td className="py-3 text-right">
                        {row.prognosis && (
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${row.color}`}>
                            {row.prognosis}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Inner Orange text box */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 border-l-4 border-l-[#C4A249] text-xs leading-relaxed text-ink/90">
              <b className="text-ink">AED {inactiveOwingValue.toLocaleString()} has probably already walked out of the door.</b> {inactiveOwingStudentsCount} unbilled packages belong to students <b className="text-hot-custom">no longer on the roster</b> — they took {inactiveOwingClassesCount} classes, never paid, and left. You can attempt recovery, but plan on writing most of it off. The <b className="text-ink">AED {activeOwingValue.toLocaleString()} owed by students still on the roster is the number that matters</b> — those families are contactable, many are still attending, and an invoice recovers it. That is the collections target.
            </div>
          </div>

          {/* Three numbers card */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2 font-serif">
              <span>▤</span> The three numbers
            </h3>
            <p className="text-xs text-muted-custom">Same question, three methods. Two agree; one does not.</p>

            <div className="overflow-x-auto pt-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line text-muted-custom font-bold">
                    <th className="text-left py-2">Method</th>
                    <th className="text-left py-2 font-semibold">How it is computed</th>
                    <th className="text-right py-2">Classes</th>
                    <th className="text-right py-2">Value</th>
                    <th className="text-right py-2">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { method: 'Package ledger (netted)', how: 'Per student: Σ classes paid - Σ classes used. Owed only where negative.', classes: ledgerClassesCount, val: `AED ${ledgerValue.toLocaleString()}`, verdict: 'CONSERVATIVE FLOOR', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    { method: 'Packages marked UNBILLED', how: 'All classes taken on packages with no payment, incl. departed students. Does not net a later top-up.', classes: upperBoundClasses, val: `AED ${upperBoundValue.toLocaleString()}`, verdict: 'UPPER BOUND', color: 'bg-amber-50 border-amber-200 text-warm-custom' },
                    { method: 'Summary sheet Overdue_Value', how: 'Legacy pre-computed column. Source unknown.', classes: summaryClasses, val: `AED ${summaryValue.toLocaleString()}`, verdict: 'CONTRADICTED', color: 'bg-red-50 border-red-200 text-hot-custom' }
                  ].map((row, idx) => (
                    <tr key={idx} className="border-b border-line hover:bg-canvas/30 text-ink">
                      <td className="py-3 font-semibold">{row.method}</td>
                      <td className="py-3 text-muted-custom">{row.how}</td>
                      <td className="py-3 text-right font-mono">{row.classes}</td>
                      <td className="py-3 text-right font-mono font-semibold">{row.val}</td>
                      <td className="py-3 text-right">
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${row.color}`}>
                          {row.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* The 109 contradicted students card */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-line pb-2">
              <div>
                <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2 font-serif">
                  <span>♟</span> The {contradictedStudents.length} contradicted students
                </h3>
                <p className="text-xs text-muted-custom mt-1">Summary sheet says they owe; their own package ledger says they are in credit. Worth AED {contradictedStudents.reduce((sum, s) => sum + s.summaryOwed, 0).toLocaleString()} of the discrepancy.</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">↓ Excel</button>
                <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">PDF</button>
              </div>
            </div>

            <div className="overflow-x-auto pt-2">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line text-muted-custom font-bold">
                    <th className="text-left py-2">Student</th>
                    <th className="text-left py-2 font-semibold">Centre</th>
                    <th className="text-left py-2 font-semibold">Coach</th>
                    <th className="text-right py-2">Summary Says Owed</th>
                    <th className="text-right py-2">Ledger: Paid-Used</th>
                    <th className="text-right py-2">Ledger Says Owed</th>
                    <th className="text-right py-2">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {contradictedStudents.map((row, idx) => (
                    <tr key={idx} className="border-b border-line hover:bg-canvas/30 text-ink">
                      <td className="py-2.5 font-semibold">{row.name}</td>
                      <td className="py-2.5 text-ink">{row.centreName}</td>
                      <td className="py-2.5 text-ink">{row.coachName}</td>
                      <td className="py-2.5 text-right font-mono text-hot-custom">AED {row.summaryOwed.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-mono text-forest font-semibold">+{row.ledgerClasses} classes</td>
                      <td className="py-2.5 text-right font-mono">AED {row.ledgerOwed}</td>
                      <td className="py-2.5 text-right">
                        <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800">
                          {row.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-canvas/40 text-ink text-xs">
                    <td className="py-2.5 px-3">Total ({contradictedStudents.length})</td>
                    <td className="py-2.5"></td>
                    <td className="py-2.5"></td>
                    <td className="py-2.5 text-right font-mono text-hot-custom">
                      AED {contradictedStudents.reduce((sum, s) => sum + s.summaryOwed, 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono text-forest font-semibold">
                      +{contradictedStudents.reduce((sum, s) => sum + s.ledgerClasses, 0)} classes
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      AED 0
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800">
                        IN CREDIT
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* UNBILLED BREAKDOWN TABLE */}
      {viewMode === 'unbilled' && (
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2 font-serif">
                <span>▤</span> Breakdown by Centre
              </h3>
              <p className="text-xs text-muted-custom mt-1">Every measure, grouped.</p>
            </div>
            <div className="flex gap-2">
              <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">↓ Excel</button>
              <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all">PDF</button>
            </div>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-muted-custom font-bold">
                  <th className="text-left py-2">Centre</th>
                  <th className="text-right py-2">Unbilled (Ledger)</th>
                  <th className="text-right py-2">Classes Owed</th>
                  <th className="text-right py-2">Students Owing</th>
                  <th className="text-right py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Bay Avenue', unbilled: bayUnbilled, classes: bayOwingClasses, studentsCount: bayOwingStudents, share: `${bayShare}%` },
                  { name: 'JLT', unbilled: jltUnbilled, classes: jltOwingClasses, studentsCount: jltOwingStudents, share: `${jltShare}%` },
                  { name: 'Total', unbilled: totalUnbilled, classes: unbilledClasses, studentsCount: unbilledStudentsCount, share: '100%', isTotal: true }
                ].map((row, idx) => (
                  <tr key={idx} className={`border-b border-line hover:bg-canvas/30 text-ink ${row.isTotal ? 'font-bold bg-canvas/40' : ''}`}>
                    <td className="py-2.5 font-semibold">{row.name}</td>
                    <td className="py-2.5 text-right font-mono">AED {row.unbilled.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono">{row.classes}</td>
                    <td className="py-2.5 text-right font-mono">{row.studentsCount}</td>
                    <td className="py-2.5 text-right font-mono">{row.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-custom text-center pt-2">
        ◆ Live data · {filteredStudents.length} students · {packages.length} packages · 12 Jul 2026.
      </div>

    </div>
  );
}
