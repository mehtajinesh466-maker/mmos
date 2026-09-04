"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';

import { getAllAttendanceForCharts } from '../app/actions';

Chart.register(...registerables);

interface ActiveStudentsChartProps {
  attendance: any[];
  students: any[];
  coaches: any[];
  centres: any[];
  slots?: any[];
}

export const ActiveStudentsChart: React.FC<ActiveStudentsChartProps> = ({
  attendance,
  students,
  coaches,
  centres,
  slots = []
}) => {
  const [serverAttendance, setServerAttendance] = useState<any[] | null>(null);
  const [filterCoach, setFilterCoach] = useState<string>('All');
  const [filterCentre, setFilterCentre] = useState<string>('All');
  const [filterSessionTime, setFilterSessionTime] = useState<string>('All');
  const [viewType, setViewType] = useState<'chart' | 'table'>('chart');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const fetchServerAttendance = () => {
    fetch('/api/attendance-chart')
      .then(res => res.json())
      .then(resData => {
        if (resData && resData.success && Array.isArray(resData.data)) {
          setServerAttendance(resData.data);
        }
      })
      .catch(err => console.error('Failed to fetch full chart attendance:', err));
  };

  // Always fetch complete attendance logs from server DB on mount
  useEffect(() => {
    fetchServerAttendance();
  }, []);
  
  // Custom Legend Checkbox States
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showAttendanceCount, setShowAttendanceCount] = useState<boolean>(true);
  const [showDistinctCount, setShowDistinctCount] = useState<boolean>(true);
  const [isSplitAxis, setIsSplitAxis] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const effectiveAttendance = (serverAttendance && serverAttendance.length > 0) ? serverAttendance : attendance;

  // Extract unique coaches list for dropdown
  const coachNames = useMemo(() => {
    const set = new Set<string>();
    coaches.forEach(c => { if (c.name) set.add(c.name); });
    effectiveAttendance.forEach(a => {
      if (a.coach?.name) set.add(a.coach.name);
    });
    return Array.from(set).sort();
  }, [coaches, effectiveAttendance]);

  // Extract unique centre names list
  const centreNames = useMemo(() => {
    const set = new Set<string>();
    centres.forEach(c => { if (c.name) set.add(c.name); });
    students.forEach(s => {
      if (s.centre?.name) set.add(s.centre.name);
    });
    return Array.from(set).sort();
  }, [centres, students]);

  // Extract unique session times list
  const sessionTimes = useMemo(() => {
    const set = new Set<string>();
    slots.forEach(s => {
      if (s.start_time) set.add(s.start_time);
    });
    effectiveAttendance.forEach(a => {
      if (a.slot?.start_time) set.add(a.slot.start_time);
    });
    if (set.size === 0) {
      return ['09:00 AM', '10:00 AM', '11:00 AM', '04:00 PM', '05:00 PM', '06:00 PM'];
    }
    return Array.from(set).sort();
  }, [slots, effectiveAttendance]);

  // Reset all top filters
  const handleResetFilters = () => {
    setFilterCoach('All');
    setFilterCentre('All');
    setFilterSessionTime('All');
  };

  // Group Attendance Month-Wise (Continuous timeline Mar 2024 to Sep 2026)
  const monthlyData = useMemo(() => {
    // 1. Map lookups
    const studentMap = new Map<string, any>();
    students.forEach(s => studentMap.set(s.id, s));

    const coachMap = new Map<string, any>();
    coaches.forEach(c => coachMap.set(c.id, c));

    const centreMap = new Map<string, any>();
    centres.forEach(c => centreMap.set(c.id, c));

    const slotMap = new Map<string, any>();
    slots.forEach(s => slotMap.set(s.id, s));

    // 2. Filter attendance logs by top filter dropdowns
    let logs = effectiveAttendance.filter(a => {
      // Status filter: count attended classes (present, makeup, or any non-absent)
      const st = (a.status || 'present').toLowerCase();
      if (st === 'absent' || st === 'cancelled') return false;

      // Filter Coach
      if (filterCoach !== 'All') {
        const coachObj = coachMap.get(a.coach_id);
        const coachName = coachObj?.name || a.coach?.name || '';
        if (coachName.toLowerCase() !== filterCoach.toLowerCase()) return false;
      }

      // Filter Centre
      if (filterCentre !== 'All') {
        const studentObj = studentMap.get(a.student_id);
        const studentCentre = centreMap.get(studentObj?.centre_id)?.name || studentObj?.centre?.name || '';
        const slotObj = slotMap.get(a.slot_id);
        const slotCentre = centreMap.get(slotObj?.centre_id)?.name || '';
        const logCentre = studentCentre || slotCentre;

        if (logCentre.toLowerCase() !== filterCentre.toLowerCase()) return false;
      }

      // Filter Session Time
      if (filterSessionTime !== 'All') {
        const slotObj = slotMap.get(a.slot_id);
        const startTime = slotObj?.start_time || a.slot?.start_time || '';
        if (startTime !== filterSessionTime) return false;
      }

      return true;
    });

    // 3. Determine timeline bounds (Default Mar 2024 to Sep 2026)
    let minYear = 2024;
    let minMonth = 2; // Mar 2024 (0-indexed: 2)
    let maxYear = 2026;
    let maxMonth = 8; // Sep 2026 (0-indexed: 8)

    // Build continuous month map
    const monthMap = new Map<string, {
      year: number;
      month: number;
      label: string;
      attendanceCount: number;
      studentIds: Set<string>;
    }>();

    let cur = new Date(minYear, minMonth, 1);
    const end = new Date(maxYear, maxMonth, 1);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthStr = cur.toLocaleString('default', { month: 'short' });
      monthMap.set(key, {
        year: y,
        month: m,
        label: `${monthStr} ${y}`,
        attendanceCount: 0,
        studentIds: new Set<string>(),
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    // Populate attendance records into month map
    logs.forEach(a => {
      if (!a.date) return;
      let y: number;
      let m: number;

      if (typeof a.date === 'string' && a.date.includes('-')) {
        const parts = a.date.split('T')[0].split('-');
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
      } else {
        const d = new Date(a.date);
        if (isNaN(d.getTime())) return;
        y = d.getFullYear();
        m = d.getMonth();
      }

      if (isNaN(y) || isNaN(m)) return;
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (monthMap.has(key)) {
        const entry = monthMap.get(key)!;
        entry.attendanceCount++;
        if (a.student_id) {
          entry.studentIds.add(a.student_id);
        }
      }
    });

    let result = Array.from(monthMap.values()).map(d => ({
      label: d.label,
      attendanceCount: d.attendanceCount,
      distinctStudentCount: d.studentIds.size,
      year: d.year,
      month: d.month,
    }));

    if (sortOrder === 'desc') {
      result = [...result].reverse();
    }

    return result;
  }, [effectiveAttendance, students, coaches, centres, slots, filterCoach, filterCentre, filterSessionTime, sortOrder]);

  // Render Chart.js Line Chart
  useEffect(() => {
    if (viewType !== 'chart' || !canvasRef.current || isCollapsed) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = monthlyData.map(d => d.label);
    const attendanceData = monthlyData.map(d => d.attendanceCount);
    const distinctData = monthlyData.map(d => d.distinctStudentCount);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const datasets: any[] = [];

    if (showAttendanceCount) {
      datasets.push({
        label: 'Attendance Count',
        data: attendanceData,
        borderColor: '#3B82F6', // Vivid Blue line (matching screenshot)
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        pointStyle: 'circle',
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.3, // Smooth curve
        fill: false,
        yAxisID: 'y',
      });
    }

    if (showDistinctCount) {
      datasets.push({
        label: 'Student Distinct Count',
        data: distinctData,
        borderColor: '#14B8A6', // Turquoise / Mint green line (matching screenshot)
        backgroundColor: '#14B8A6',
        borderWidth: 2,
        pointStyle: 'circle',
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.3, // Smooth curve
        fill: false,
        yAxisID: isSplitAxis ? 'y2' : 'y',
      });
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false, // Turned off to use custom HTML checklist legend above
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1F2937',
            bodyColor: '#374151',
            borderColor: '#3B82F6',
            borderWidth: 1.5,
            padding: 10,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              title: (items) => `Month&Year of Date: ${items[0]?.label || ''}`,
              footer: () => `Click to: View Underlying Data / Drill Down`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 10,
                weight: '600',
              },
              color: '#374151',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
            title: {
              display: true,
              text: 'Month&Year of Date ∨',
              font: {
                size: 11,
                weight: 'bold',
              },
              color: '#374151',
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(243, 244, 246, 0.8)',
            },
            ticks: {
              font: {
                size: 10,
              },
              color: '#6B7280',
            },
            title: {
              display: true,
              text: 'Attendance , Student ∨',
              font: {
                size: 11,
                weight: 'bold',
              },
              color: '#374151',
            },
          },
          ...(isSplitAxis ? {
            y2: {
              type: 'linear',
              display: true,
              position: 'right',
              beginAtZero: true,
              grid: {
                drawOnChartArea: false,
              },
              ticks: {
                font: { size: 10 },
                color: '#14B8A6',
              },
              title: {
                display: true,
                text: 'Student Distinct Count ∨',
                font: { size: 11, weight: 'bold' },
                color: '#14B8A6',
              },
            }
          } : {}),
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [monthlyData, viewType, isCollapsed, showAttendanceCount, showDistinctCount, isSplitAxis]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-5 mb-6 text-gray-800 select-none">
      {/* ── Top Header Action Bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Active students</span>
          </h2>
          <button
            onClick={() => {
              handleResetFilters();
              fetchServerAttendance();
            }}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1 rounded-md border border-gray-300 font-medium cursor-pointer shadow-2xs transition-colors"
          >
            Regenerate
          </button>
        </div>

        {/* Action Buttons Right */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              handleResetFilters();
              fetchServerAttendance();
            }}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1 rounded-md border border-gray-200 cursor-pointer shadow-2xs font-medium"
          >
            Refresh
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
            <button
              onClick={() => setViewType('chart')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                viewType === 'chart' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Graph View"
            >
              📊
            </button>
            <button
              onClick={() => setViewType('table')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                viewType === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Data Table View"
            >
              📋
            </button>
          </div>

          <button
            title="Export Data"
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-2.5 py-1 rounded-md border border-gray-200 cursor-pointer shadow-2xs font-medium"
          >
            ↑
          </button>
          <button
            onClick={() => setIsSplitAxis(!isSplitAxis)}
            className={`text-xs px-3 py-1 rounded-md border border-gray-200 cursor-pointer shadow-2xs font-medium transition-colors ${
              isSplitAxis ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
          >
            Split Axis
          </button>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1 rounded-md border border-gray-200 cursor-pointer shadow-2xs font-medium"
          >
            Sort {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* ── Top Filters Row ───────────────────────────────────────────────── */}
          <div className="py-3 border-b border-gray-100 text-xs text-gray-700 space-y-2">
            <div className="flex flex-wrap items-center gap-6">
              {/* Coaches Details Filter */}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600 text-xs">Coaches Details:</span>
                <select
                  value={filterCoach}
                  onChange={e => setFilterCoach(e.target.value)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none focus:border-indigo-500 min-w-[140px] shadow-2xs cursor-pointer"
                >
                  <option value="All">- Select -</option>
                  {coachNames.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned center Filter */}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600 text-xs">Assigned center:</span>
                <select
                  value={filterCentre}
                  onChange={e => setFilterCentre(e.target.value)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none focus:border-indigo-500 min-w-[140px] shadow-2xs cursor-pointer"
                >
                  <option value="All">- Select -</option>
                  {centreNames.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Session time Filter */}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600 text-xs">Session time:</span>
                <select
                  value={filterSessionTime}
                  onChange={e => setFilterSessionTime(e.target.value)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none focus:border-indigo-500 min-w-[140px] shadow-2xs cursor-pointer"
                >
                  <option value="All">- Select -</option>
                  {sessionTimes.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Chart & Legend Body ──────────────────────────────────────────── */}
          <div className="pt-4 relative">
            {/* Custom Legend Checklist Top Right (Matching Screenshot) */}
            <div className="flex flex-col items-end gap-1.5 mb-2 text-xs text-gray-700">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={e => {
                    const val = e.target.checked;
                    setShowLegend(val);
                    setShowAttendanceCount(val);
                    setShowDistinctCount(val);
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Legend</span>
              </label>

              {showLegend && (
                <div className="flex flex-col items-start gap-1 bg-gray-50/80 p-2 rounded-md border border-gray-100 shadow-2xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={showAttendanceCount}
                      onChange={e => setShowAttendanceCount(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
                    <span>Attendance Count</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={showDistinctCount}
                      onChange={e => setShowDistinctCount(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]"></span>
                    <span>Student Distinct Count</span>
                  </label>
                </div>
              )}
            </div>

            {viewType === 'chart' ? (
              <div className="relative w-full h-[380px]">
                <canvas ref={canvasRef}></canvas>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Month & Year</th>
                      <th className="py-2.5 px-4 text-right">Attendance Count</th>
                      <th className="py-2.5 px-4 text-right">Student Distinct Count (Active Students)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-gray-400">
                          No attendance data available.
                        </td>
                      </tr>
                    ) : (
                      monthlyData.map(d => (
                        <tr key={d.label} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-gray-800">{d.label}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700 bg-blue-50/40">{d.attendanceCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-700 bg-teal-50/40">{d.distinctStudentCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
