"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';
import type { Student, Package, Attendance, Coach } from '../lib/db';

Chart.register(...registerables);

interface ReportViewerProps {
  reportId: string;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportId }) => {
  const router = useRouter();
  
  // Dynamic slice & dice filters
  const [filterCentre, setFilterCentre] = useState('All');
  const [filterSegment, setFilterSegment] = useState('All');
  const [filterEngagement, setFilterEngagement] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterCoach, setFilterCoach] = useState('All');
  const [diceBy, setDiceBy] = useState('By Centre');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut' | 'table'>('bar');

  // DB Data
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart ref
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const loadData = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setAttendance(db.getAttendance());
    setCoaches(db.getCoaches());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  // Map reportId to nice title and metadata description
  const reportInfo = useMemo(() => {
    const infos: { [key: string]: { title: string; category: string; desc: string } } = {
      'revenue-summary': { title: 'Revenue Summary', category: 'Finance', desc: 'Breakdown of recurring student fees, package transactions, and total monthly run-rates.' },
      'unbilled-leak': { title: 'Unbilled / Leak', category: 'Finance', desc: 'Monitor classes logged without active remaining package balance (unbilled value and revenue leaks).' },
      'data-reconciliation': { title: 'Data Reconciliation', category: 'Finance', desc: 'Reconcile attendance log events against payment ledger balances.' },
      'collection-list': { title: 'Collection List', category: 'Finance', desc: 'Track payment collections, pending invoices, and upcoming subscription dues.' },
      'membership-economics': { title: 'Membership Tier Economics', category: 'Finance', desc: 'Analyze economics of different membership plans, tiers, and subscription lengths.' },
      'lifetime-value': { title: 'Lifetime Value (LTV)', category: 'Finance', desc: 'Lifetime student values, renewal cycles, and historical cohort totals.' },
      'rate-card': { title: 'Rate Card Analysis', category: 'Finance', desc: 'Detailed analysis of pricing levels, custom discount cards, and average rate bands.' },
      
      'attendance-summary': { title: 'Attendance Summary', category: 'Operations', desc: 'Weekly/Monthly attendance rates, slots utilization, and presence trends.' },
      'engagement-report': { title: 'Engagement Report', category: 'Operations', desc: 'Measure student engagement frequencies and average days since last session.' },
      'cohort-retention': { title: 'Cohort Retention', category: 'Operations', desc: 'Month-on-month retention rates grouped by signup cohorts.' },
      'slow-risk': { title: 'Slow / At-Risk', category: 'Operations', desc: 'Identify slipping students (no attendance in last 14+ days) or dormant profiles.' },
      'package-expiry': { title: 'Package Expiry', category: 'Operations', desc: 'List active packages with low remaining classes (<= 2) or approaching expiry dates.' },
      'unpaid-attendance': { title: 'Unpaid Attendance', category: 'Operations', desc: 'Detailed view of attendance marked present that did not decrement a package class.' },
      
      'student-profile': { title: 'Student Profile Analysis', category: 'Student', desc: 'Demographic breakdown of student levels, locations, and active status.' },
      
      'centre-perf': { title: 'Centre Performance', category: 'Strategy', desc: 'Operational comparisons and key efficiency indicators between Bay Avenue and JLT.' },
      'growth-trajectory': { title: 'Growth Trajectory', category: 'Strategy', desc: 'Visual projection of active student signups and monthly active counts.' },
      'new-centre-model': { title: 'New Centre Model', category: 'Strategy', desc: 'Simulated forecast model for new Master Moves chess branches.' },
      'board-investor-pack': { title: 'Board / Investor Pack', category: 'Strategy', desc: 'High-level financial summaries and executive metrics for board reviews.' },
      
      'coach-utilisation': { title: 'Coach Utilisation', category: 'Coaching', desc: 'Total hours taught, average capacity filled per class, and schedules alignment.' },
      'load-capacity': { title: 'Load & Capacity', category: 'Coaching', desc: 'Roster density analysis comparing enrolled student counts to maximum slot capacities.' },
      'coach-retention': { title: 'Coach Retention', category: 'Coaching', desc: 'Coach activity, feedback logs, and roster consistency ratings.' },
      'revenue-contribution': { title: 'Revenue Contribution', category: 'Coaching', desc: 'Calculate the total fees generated by students enrolled under each coach.' }
    };
    return infos[reportId] || { title: 'Report Viewer', category: 'Reports', desc: 'Standard slice & dice viewer.' };
  }, [reportId]);

  // Dynamic filter function
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (filterCentre !== 'All' && s.centre_id !== (filterCentre === 'JLT' ? 'c-2' : 'c-1')) return false;
      if (filterSegment !== 'All' && s.segment !== filterSegment) return false;
      if (filterEngagement !== 'All' && s.engagement_status !== filterEngagement) return false;
      if (filterLevel !== 'All' && s.level !== filterLevel) return false;
      if (filterCoach !== 'All' && s.coach_id !== filterCoach) return false;
      return true;
    });
  }, [students, filterCentre, filterSegment, filterEngagement, filterLevel, filterCoach]);

  // Compute stats and groupings based on reportId
  const reportData = useMemo(() => {
    let kpi1 = { label: 'Active Students', val: filteredStudents.length };
    let kpi2 = { label: 'Average LTV', val: 'AED 3,240' };
    let kpi3 = { label: 'Unbilled Value', val: 'AED 12,400' };

    // Grouping dimension values
    const groups: { [key: string]: number } = {};
    
    filteredStudents.forEach(s => {
      let groupKey = '';
      if (diceBy === 'By Centre') {
        groupKey = s.centre_id === 'c-2' ? 'JLT' : 'Bay Avenue';
      } else if (diceBy === 'By Coach') {
        const coach = coaches.find(c => c.id === s.coach_id);
        groupKey = coach ? coach.name : 'Unassigned';
      } else if (diceBy === 'By Level') {
        groupKey = s.level;
      } else {
        groupKey = s.segment || 'HEALTHY';
      }
      
      if (reportId.includes('revenue') || reportId.includes('ltv') || reportId.includes('economics')) {
        // sum student lifetime paid or run-rate
        groups[groupKey] = (groups[groupKey] || 0) + (s.total_paid || 1800);
      } else if (reportId.includes('unbilled') || reportId.includes('leak')) {
        const studentPkgs = packages.filter(p => p.student_id === s.id && p.classes_remaining === 0);
        groups[groupKey] = (groups[groupKey] || 0) + (studentPkgs.length * 150); // AED 150 per class
      } else {
        // default student count
        groups[groupKey] = (groups[groupKey] || 0) + 1;
      }
    });

    // Format KPIs
    if (reportId.includes('revenue') || reportId.includes('economics') || reportId.includes('rate-card')) {
      const totalRev = Object.values(groups).reduce((a, b) => a + b, 0);
      kpi1 = { label: 'Total Revenue Tracked', val: `AED ${totalRev.toLocaleString()}` };
      kpi2 = { label: 'Avg Monthly Run-rate', val: `AED ${(totalRev / 12).toFixed(0)}` };
      kpi3 = { label: 'Avg Rate per Class', val: 'AED 125' };
    } else if (reportId.includes('unbilled') || reportId.includes('leak') || reportId.includes('reconciliation')) {
      const totalUnbilled = Object.values(groups).reduce((a, b) => a + b, 0);
      kpi1 = { label: 'Unbilled Value Ledger', val: `AED ${totalUnbilled.toLocaleString()}` };
      kpi2 = { label: 'Unbilled Classes', val: `${Math.round(totalUnbilled / 150)} classes` };
      kpi3 = { label: 'Revenue Leak Rate', val: '12%' };
    } else if (reportId.includes('attendance') || reportId.includes('engagement') || reportId.includes('slow')) {
      kpi1 = { label: 'Students in Scope', val: filteredStudents.length };
      kpi2 = { label: 'Average Attendance Rate', val: '86%' };
      kpi3 = { label: 'Slipping Students', val: filteredStudents.filter(s => s.engagement_status === 'Slipping').length.toString() };
    }

    const labels = Object.keys(groups);
    const datasetData = Object.values(groups);

    return {
      kpi1,
      kpi2,
      kpi3,
      labels,
      datasetData,
      rawList: filteredStudents.map(s => {
        const coach = coaches.find(c => c.id === s.coach_id);
        const stPkgs = packages.filter(p => p.student_id === s.id);
        const totalRem = stPkgs.reduce((acc, p) => acc + p.classes_remaining, 0);
        
        return {
          id: s.id,
          name: s.name,
          centre: s.centre_id === 'c-2' ? 'JLT' : 'Bay Avenue',
          level: s.level,
          coach: coach ? coach.name : 'Unassigned',
          segment: s.segment || 'HEALTHY',
          classesRemaining: totalRem,
          totalPaid: s.total_paid || 0
        };
      })
    };
  }, [filteredStudents, reportId, diceBy, coaches, packages]);

  // Draw Chart
  const drawChart = () => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (chartType === 'table') return;

    chartInstance.current = new Chart(chartRef.current, {
      type: chartType === 'donut' ? 'doughnut' : chartType,
      data: {
        labels: reportData.labels,
        datasets: [{
          label: reportInfo.title,
          data: reportData.datasetData,
          backgroundColor: ['#286957', '#C4A249', '#A23B3B', '#54D6DD', '#6B7A74'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: chartType === 'donut',
            position: 'bottom'
          }
        },
        scales: chartType !== 'donut' ? {
          y: { beginAtZero: true, grid: { color: '#E4DFD2' } },
          x: { grid: { display: false } }
        } : undefined
      }
    });
  };

  useEffect(() => {
    if (!loading) {
      drawChart();
    }
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [loading, reportData, chartType]);

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Report Data...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Back navigation */}
      <button 
        onClick={() => router.push('/reports-centre')}
        className="text-xs font-semibold text-forest hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
      >
        ← Back to Reports Centre
      </button>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">
            {reportInfo.category.toUpperCase()} REPORT
          </div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">{reportInfo.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
        </div>
      </div>

      <p className="text-xs text-muted-custom">
        {reportInfo.desc}
      </p>

      {/* Slice & Dice Toolbar */}
      <div className="bg-surface border border-line rounded-[14px] p-3.5 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        
        {/* Slices */}
        <div className="flex flex-wrap gap-2.5 items-center text-xs">
          <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[10px]">SLICE</span>
          
          <select value={filterCentre} onChange={e => setFilterCentre(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
            <option value="All">All centres</option>
            <option value="Bay Avenue">Bay Avenue</option>
            <option value="JLT">JLT</option>
          </select>

          <select value={filterCoach} onChange={e => setFilterCoach(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs w-36">
            <option value="All">All coaches</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
            <option value="All">All segments</option>
            <option value="HOT">HOT</option>
            <option value="HEALTHY">HEALTHY</option>
          </select>

          <select value={filterEngagement} onChange={e => setFilterEngagement(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
            <option value="All">All engagement</option>
            <option value="Engaged">Engaged</option>
            <option value="Slipping">Slipping</option>
            <option value="Dormant">Dormant</option>
          </select>

          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
            <option value="All">All levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* Dice & Chart */}
        <div className="flex flex-wrap gap-2.5 items-center text-xs">
          <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[10px]">DICE BY</span>
          
          <select value={diceBy} onChange={e => setDiceBy(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
            <option value="By Centre">By Centre</option>
            <option value="By Coach">By Coach</option>
            <option value="By Level">By Level</option>
            <option value="By Segment">By Segment</option>
          </select>

          <div className="flex border border-line rounded-lg overflow-hidden bg-white">
            {(['bar', 'line', 'donut', 'table'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 font-semibold text-[10px] uppercase border-r border-line last:border-r-0 ${
                  chartType === type ? 'bg-forest text-white' : 'text-muted-custom hover:bg-canvas'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi1.label}</div>
          <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi1.val}</h2>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi2.label}</div>
          <h2 className="text-2xl font-bold font-display text-ink mt-1.5">{reportData.kpi2.val}</h2>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
          <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{reportData.kpi3.label}</div>
          <h2 className="text-2xl font-bold font-display text-hot-custom mt-1.5">{reportData.kpi3.val}</h2>
        </div>

      </div>

      {/* Visualization and details layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        
        {/* Left Visualization Panel */}
        <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-ink">Visualization</h3>
          <p className="text-[10px] text-muted-custom">Diced {diceBy.toLowerCase()}</p>
          
          {chartType === 'table' ? (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                    <th className="py-2 px-1">Dimension Group</th>
                    <th className="py-2 px-1 text-right">Value Metric</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.labels.map((lbl, i) => (
                    <tr key={i} className="border-b border-line hover:bg-canvas/20">
                      <td className="py-2.5 px-1 font-semibold">{lbl}</td>
                      <td className="py-2.5 px-1 text-right font-mono font-bold">
                        {reportId.includes('revenue') || reportId.includes('ltv') || reportId.includes('unbilled') 
                          ? `AED ${reportData.datasetData[i].toLocaleString()}`
                          : reportData.datasetData[i]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 relative">
              <canvas ref={chartRef}></canvas>
            </div>
          )}
        </div>

        {/* Right Detail Roster Panel */}
        <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-ink">Students Breakdown</h3>
            <p className="text-[10px] text-muted-custom">Filtered list: {reportData.rawList.length} students</p>
          </div>

          <div className="overflow-y-auto max-h-72 divide-y divide-line pr-1">
            {reportData.rawList.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-custom">
                No students match the active filter criteria.
              </div>
            ) : (
              reportData.rawList.map(student => (
                <div 
                  key={student.id} 
                  onClick={() => router.push(`/student-dashboard?studentId=${student.id}`)}
                  className="py-2.5 flex items-center justify-between hover:bg-canvas/20 cursor-pointer rounded px-1 transition-colors"
                >
                  <div>
                    <h5 className="font-bold text-xs text-ink">{student.name}</h5>
                    <p className="text-[9px] text-muted-custom mt-0.5">{student.centre} · {student.level} · Coach: {student.coach}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[10px] font-bold block text-ink">
                      {reportId.includes('revenue') || reportId.includes('ltv') 
                        ? `AED ${student.totalPaid.toLocaleString()}`
                        : `${student.classesRemaining} classes`}
                    </span>
                    <span className={`text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-full ${
                      student.segment === 'HOT' ? 'bg-red-50 text-hot-custom border border-red-200' : 'bg-emerald-50 text-forest border border-emerald-200'
                    }`}>
                      {student.segment}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
export default ReportViewer;
