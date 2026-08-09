"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';
import type { Student, Package, Attendance, Coach } from '../lib/db';
import { exportTableToCSV } from '../lib/export';

Chart.register(...registerables);

export const Explorer: React.FC = () => {
  const [selectedCentre, setSelectedCentre] = useState<string>('All');
  const [selectedMeasure, setSelectedMeasure] = useState<string>('Run-rate / month');
  const [filterCentre, setFilterCentre] = useState('All');
  const [filterCoach, setFilterCoach] = useState('All');
  const [filterSegment, setFilterSegment] = useState('All');
  const [filterEngagement, setFilterEngagement] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [diceBy, setDiceBy] = useState('By Centre');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut' | 'table'>('bar');

  const exportExplorerExcel = () => {
    const data = filteredStudents.map((s, idx) => {
      const coachName = coaches.find(c => c.id === s.coach_id)?.name || 'Unassigned';
      const centreName = centres.find(c => c.id === s.centre_id)?.name || '—';
      return {
        Index: idx + 1,
        Name: s.name,
        Level: s.level,
        Status: s.status,
        Centre: centreName,
        Coach: coachName,
        UnbilledValue: (s.flags as any)?.unpaid_value || 0,
        UnbilledClasses: (s.flags as any)?.unpaid_classes || 0,
      };
    });

    if (data.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(fieldName => JSON.stringify((row as any)[fieldName])).join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `explorer_students_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // DB Data
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart ref
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const loadData = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setAttendance(db.getAttendance());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  // Filter students based on active slices
  const filteredStudents = useMemo(() => {
    const bayCentreId = centres.find(c => c.name === 'Bay Avenue')?.id || 'c-1';
    const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';
    return students.filter(s => {
      // Centre slice
      if (filterCentre !== 'All') {
        const targetId = filterCentre === 'JLT' ? jltCentreId : bayCentreId;
        if (s.centre_id !== targetId) return false;
      }
      // Top bar centre selector
      if (selectedCentre !== 'All') {
        const targetId = selectedCentre === 'JLT' ? jltCentreId : bayCentreId;
        if (s.centre_id !== targetId) return false;
      }
      if (filterCoach !== 'All' && s.coach_id !== filterCoach) return false;

      // Segment calculation
      const pkgs = packages.filter(p => p.student_id === s.id && !p.frozen);
      const activePkg = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;
      const classesLeft = activePkg?.classes_remaining ?? 0;
      const pkgSize = activePkg?.classes_total ?? 0;

      let segment = 'HEALTHY';
      if (pkgSize === 0 || classesLeft === 0) segment = 'COLD';
      else if (classesLeft <= 2) segment = 'HOT';
      else if (classesLeft <= 4) segment = 'WARM';

      if (filterSegment !== 'All' && segment !== filterSegment) return false;

      // Engagement calculation
      let engagement = 'Never attended';
      if (s.last_attended) {
        const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
        if (diff <= 14) engagement = 'Engaged';
        else if (diff <= 30) engagement = 'Slipping';
        else if (diff <= 60) engagement = 'Cold';
        else engagement = 'Dormant';
      }
      if (filterEngagement !== 'All' && engagement !== filterEngagement) return false;

      // Level slice
      if (filterLevel !== 'All' && s.level !== filterLevel) return false;

      return true;
    });
  }, [students, packages, filterCentre, filterCoach, filterSegment, filterEngagement, filterLevel, selectedCentre, centres]);

  // Compute metrics grouped by dice dimension
  const computedData = useMemo(() => {
    const groups: { [key: string]: { runRate: number; students: number; unbilled: number } } = {};

    filteredStudents.forEach(s => {
      const jltCentreId = centres.find(c => c.name === 'JLT')?.id || 'c-2';
      let groupKey = '';
      if (diceBy === 'By Centre') {
        groupKey = s.centre_id === jltCentreId ? 'JLT' : 'Bay Avenue';
      } else if (diceBy === 'By Coach') {
        const coach = coaches.find(c => c.id === s.coach_id);
        groupKey = coach ? coach.name : 'Unassigned';
      } else if (diceBy === 'By Level') {
        groupKey = s.level || 'Not assigned';
      } else if (diceBy === 'By Engagement') {
        let engagement = 'Never attended';
        if (s.last_attended) {
          const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
          if (diff <= 14) engagement = 'Engaged';
          else if (diff <= 30) engagement = 'Slipping';
          else if (diff <= 60) engagement = 'Cold';
          else engagement = 'Dormant';
        }
        groupKey = engagement;
      } else if (diceBy === 'By Segment') {
        const pkgs = packages.filter(p => p.student_id === s.id && !p.frozen);
        const activePkg = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;
        const classesLeft = activePkg?.classes_remaining ?? 0;
        const pkgSize = activePkg?.classes_total ?? 0;

        let segment = 'HEALTHY';
        if (pkgSize === 0 || classesLeft === 0) segment = 'COLD';
        else if (classesLeft <= 2) segment = 'HOT';
        else if (classesLeft <= 4) segment = 'WARM';

        groupKey = segment;
      } else if (diceBy === 'By Rate band') {
        const pkgs = packages.filter(p => p.student_id === s.id && !p.frozen);
        const activePkg = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;
        const classesTotal = activePkg?.classes_total ?? 12;
        groupKey = `${classesTotal} classes`;
      } else {
        groupKey = 'Other';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { runRate: 0, students: 0, unbilled: 0 };
      }

      // 1. Students count
      groups[groupKey].students += 1;

      // 2. Run-rate / month
      const activePkgs = packages.filter(p => p.student_id === s.id && !p.frozen && p.classes_remaining > 0);
      const pkgSum = activePkgs.reduce((acc, p) => acc + (p.classes_remaining * 120), 0); // Simulated rate card
      groups[groupKey].runRate += Math.round(pkgSum / 12); // Average monthly slice

      // 3. Unbilled
      const zeroBalancePkgs = packages.filter(p => p.student_id === s.id && p.classes_remaining === 0);
      groups[groupKey].unbilled += zeroBalancePkgs.length * 150; // AED 150 per unbilled place
    });

    // Sums for total row
    let grandStudents = 0;
    let grandRunRate = 0;
    let grandUnbilled = 0;

    const list = Object.keys(groups).map(key => {
      const g = groups[key];
      grandStudents += g.students;
      grandRunRate += g.runRate;
      grandUnbilled += g.unbilled;

      let activeVal = g.runRate;
      if (selectedMeasure === 'Students') {
        activeVal = g.students;
      } else if (selectedMeasure === 'Unbilled') {
        activeVal = g.unbilled;
      }

      return {
        key,
        students: g.students,
        runRate: g.runRate,
        unbilled: g.unbilled,
        activeVal
      };
    });

    return {
      list,
      grandStudents,
      grandRunRate,
      grandUnbilled
    };
  }, [filteredStudents, diceBy, selectedMeasure, packages, coaches]);

  // Render Chart.js
  const drawChart = () => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (chartType === 'table') return;

    const labels = computedData.list.map(item => item.key);
    const dataVals = computedData.list.map(item => item.activeVal);

    chartInstance.current = new Chart(chartRef.current, {
      type: chartType === 'donut' ? 'doughnut' : chartType,
      data: {
        labels,
        datasets: [{
          label: selectedMeasure,
          data: dataVals,
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
  }, [loading, computedData, chartType, selectedMeasure]);

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Explorer Dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-muted-custom uppercase">ANALYTICS</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Explorer — Slice & Dice</h1>
        </div>

        <select 
          value={selectedCentre}
          onChange={e => setSelectedCentre(e.target.value)}
          className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none"
        >
          <option value="All">All centres</option>
          <option value="Bay Avenue">Bay Avenue</option>
          <option value="JLT">JLT</option>
        </select>
      </div>

      <p className="text-xs text-muted-custom">
        Free-form analysis. Any measure, any breakdown, any chart — then export.
      </p>

      {/* Slice & Dice Config Toolbar */}
      <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm space-y-3.5">
        
        {/* Measure & Slice Row */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[9px]">MEASURE</span>
            <select 
              value={selectedMeasure} 
              onChange={e => setSelectedMeasure(e.target.value)} 
              className="bg-white border border-line rounded-lg px-3 py-1 outline-none text-xs font-semibold"
            >
              <option value="Run-rate / month">Run-rate / month</option>
              <option value="Students">Students</option>
              <option value="Unbilled">Unbilled</option>
            </select>
          </div>

          <div className="h-4 w-px bg-line hidden md:block"></div>

          <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[9px]">SLICE</span>
          
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
            <option value="WARM">WARM</option>
            <option value="COLD">COLD</option>
            <option value="HEALTHY">HEALTHY</option>
          </select>

          <select value={filterEngagement} onChange={e => setFilterEngagement(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
            <option value="All">All engagement</option>
            <option value="Engaged">Engaged</option>
            <option value="Slipping">Slipping</option>
            <option value="Dormant">Dormant</option>
            <option value="Cold">Cold</option>
            <option value="Never attended">Never attended</option>
          </select>

          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
            <option value="All">All levels</option>
            <option value="Assessment">Assessment</option>
            <option value="Early Starters-Beginner 1">Early Starters-Beginner 1</option>
            <option value="Early Starters-Beginner 2">Early Starters-Beginner 2</option>
            <option value="Early Starters-Intermediate">Early Starters-Intermediate</option>
            <option value="FIDE rated">FIDE rated</option>
            <option value="Juniors-Beginner">Juniors-Beginner</option>
            <option value="Juniors-Intermediate A">Juniors-Intermediate A</option>
            <option value="Juniors-Intermediate B">Juniors-Intermediate B</option>
            <option value="Not assigned">Not assigned</option>
            <option value="Seniors-Advanced">Seniors-Advanced</option>
            <option value="Seniors-Beginner">Seniors-Beginner</option>
            <option value="Seniors-Intermediate">Seniors-Intermediate</option>
          </select>
        </div>

        {/* Dice & Format Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[9px]">DICE</span>
            <select value={diceBy} onChange={e => setDiceBy(e.target.value)} className="bg-white border border-line rounded-lg px-2 py-1 outline-none text-xs">
              <option value="By Centre">By Centre</option>
              <option value="By Coach">By Coach</option>
              <option value="By Engagement">By Engagement</option>
              <option value="By Segment">By Segment</option>
              <option value="By Level">By Level</option>
              <option value="By Rate band">By Rate band</option>
            </select>

            <div className="flex border border-line rounded-lg overflow-hidden bg-white">
              {(['bar', 'line', 'donut', 'table'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-3 py-1 font-semibold text-[10px] uppercase border-r border-line last:border-r-0 cursor-pointer transition-all ${
                    chartType === type ? 'bg-[#173F35] text-white' : 'text-muted-custom hover:bg-canvas'
                  }`}
                >
                  {type === 'donut' ? 'Donut' : type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => { 
              setFilterCentre('All'); 
              setFilterCoach('All'); 
              setFilterSegment('All'); 
              setFilterEngagement('All'); 
              setFilterLevel('All'); 
              setSelectedCentre('All');
              setSelectedMeasure('Run-rate / month');
              setDiceBy('By Centre');
              setChartType('bar');
            }} className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer">Reset</button>
            <button onClick={exportExplorerExcel} className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold">↓ Excel</button>
            <button onClick={() => window.print()} className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold">PDF</button>
          </div>
        </div>
      </div>

      {/* Main Chart Visualization Card */}
      {chartType !== 'table' && (
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <span className="text-[#C4A249]">☉</span> {selectedMeasure} {diceBy}
            </h3>
            <p className="text-[10px] text-muted-custom mt-0.5">All data · {filteredStudents.length} students in scope</p>
          </div>

          <div className="h-64 relative">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>
      )}

      {/* Grouped Breakdown Grid Card */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <span className="text-[#C4A249]">⚏</span> Breakdown {diceBy}
            </h3>
            <p className="text-[10px] text-muted-custom mt-0.5">Every measure, grouped.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportTableToCSV('#explorer-breakdown-table', 'explorer_breakdown.csv')} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas cursor-pointer transition-all">↓ Excel</button>
            <button onClick={() => window.print()} className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas cursor-pointer transition-all">⎙ PDF</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table id="explorer-breakdown-table" className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted-custom text-[9px] uppercase tracking-wider font-bold">
                <th className="py-2.5 px-3 w-12">S.No</th>
                <th className="py-2.5 px-3">
                  {diceBy.replace('By ', '').toUpperCase()}
                </th>
                <th className="py-2.5 px-3 text-right">Run-Rate / Month</th>
                <th className="py-2.5 px-3 text-right">Students</th>
                <th className="py-2.5 px-3 text-right">Unbilled</th>
                <th className="py-2.5 px-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {computedData.list.map((row, idx) => {
                const totalMeasure = selectedMeasure === 'Students' 
                  ? computedData.grandStudents 
                  : selectedMeasure === 'Unbilled' 
                    ? computedData.grandUnbilled 
                    : computedData.grandRunRate;
                const percentage = totalMeasure > 0 ? ((row.activeVal / totalMeasure) * 100).toFixed(0) : '0';

                return (
                  <tr key={idx} className="border-b border-line hover:bg-canvas/30 transition-colors font-medium text-ink">
                    <td className="py-2.5 px-3 font-mono text-muted-custom w-12">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold">{row.key}</td>
                    <td className="py-2.5 px-3 text-right font-mono">AED {row.runRate.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{row.students}</td>
                    <td className="py-2.5 px-3 text-right font-mono">AED {row.unbilled.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{percentage}%</td>
                  </tr>
                );
              })}
              {/* Grand Total Row */}
              <tr className="bg-canvas/30 font-bold text-ink border-b border-line">
                <td className="py-2.5 px-3">Total</td>
                <td className="py-2.5 px-3 text-right font-mono">AED {computedData.grandRunRate.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right font-mono">{computedData.grandStudents}</td>
                <td className="py-2.5 px-3 text-right font-mono">AED {computedData.grandUnbilled.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right font-mono">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* Explanatory footnote */}
      <div className="text-[10px] text-muted-custom flex items-center gap-1">
        <span>◆</span> Every combination computes live from the same dataset every other report uses.
      </div>

    </div>
  );
};
export default Explorer;
