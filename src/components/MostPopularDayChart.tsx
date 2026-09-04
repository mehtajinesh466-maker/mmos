"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface MostPopularDayChartProps {
  attendance: any[];
  students: any[];
  coaches: any[];
  centres: any[];
}

const DAY_COLORS: { [key: string]: string } = {
  Sat: '#5B82F6', // Royal Blue
  Fri: '#2DD4BF', // Mint Teal
  Mon: '#E11D48', // Coral Red
  Wed: '#F97316', // Warm Orange
  Sun: '#F59E0B', // Gold Amber
  Thu: '#9333EA', // Purple
  Tue: '#38BDF8', // Cyan / Sky Blue
};

const DAY_FULL_NAMES: { [key: string]: string } = {
  Sat: 'Saturday',
  Fri: 'Friday',
  Mon: 'Monday',
  Wed: 'Wednesday',
  Sun: 'Sunday',
  Thu: 'Thursday',
  Tue: 'Tuesday',
};

const DAY_ORDER = ['Sat', 'Fri', 'Mon', 'Wed', 'Sun', 'Thu', 'Tue'];

export const MostPopularDayChart: React.FC<MostPopularDayChartProps> = ({
  attendance,
  students,
  coaches,
  centres,
}) => {
  const [serverAttendance, setServerAttendance] = useState<any[] | null>(null);
  const [filterCentre, setFilterCentre] = useState<string>('All');
  const [filterCoach, setFilterCoach] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [viewType, setViewType] = useState<'chart' | 'table'>('chart');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Legend visibility toggles
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [visibleDays, setVisibleDays] = useState<{ [key: string]: boolean }>({
    Sat: true,
    Fri: true,
    Mon: true,
    Wed: true,
    Sun: true,
    Thu: true,
    Tue: true,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const datePickerRef = useRef<HTMLDivElement | null>(null);

  // Fetch full attendance logs from endpoint on mount
  const fetchServerAttendance = () => {
    fetch('/api/attendance-chart')
      .then(res => res.json())
      .then(resData => {
        if (resData && resData.success && Array.isArray(resData.data)) {
          setServerAttendance(resData.data);
        }
      })
      .catch(err => console.error('Failed to fetch attendance for Most Popular Day chart:', err));
  };

  useEffect(() => {
    fetchServerAttendance();
  }, []);

  // Click outside listener for date picker popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const effectiveAttendance = (serverAttendance && serverAttendance.length > 0) ? serverAttendance : attendance;

  // Extract unique coach names
  const coachNames = useMemo(() => {
    const set = new Set<string>();
    coaches.forEach(c => { if (c.name) set.add(c.name); });
    effectiveAttendance.forEach(a => {
      if (a.coach?.name) set.add(a.coach.name);
    });
    return Array.from(set).sort();
  }, [coaches, effectiveAttendance]);

  // Extract unique centre names
  const centreNames = useMemo(() => {
    const set = new Set<string>();
    centres.forEach(c => { if (c.name) set.add(c.name); });
    students.forEach(s => {
      if (s.centre?.name) set.add(s.centre.name);
    });
    return Array.from(set).sort();
  }, [centres, students]);

  // Reset filters
  const handleResetFilters = () => {
    setFilterCentre('All');
    setFilterCoach('All');
    setDateFrom('');
    setDateTo('');
    setIsDatePickerOpen(false);
  };

  // Group Attendance by Day of Week
  const dayDistribution = useMemo(() => {
    const studentMap = new Map<string, any>();
    students.forEach(s => studentMap.set(s.id, s));

    const coachMap = new Map<string, any>();
    coaches.forEach(c => coachMap.set(c.id, c));

    const centreMap = new Map<string, any>();
    centres.forEach(c => centreMap.set(c.id, c));

    const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toMs = dateTo ? new Date(dateTo).getTime() + 86399999 : Infinity;

    // Filter logs
    let logs = effectiveAttendance.filter(a => {
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
        if (studentCentre.toLowerCase() !== filterCentre.toLowerCase()) return false;
      }

      // Filter Date Range
      if (dateFrom || dateTo) {
        if (!a.date) return false;
        let t = 0;
        if (typeof a.date === 'string' && a.date.includes('-')) {
          const parts = a.date.split('T')[0].split('-');
          t = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        } else {
          t = new Date(a.date).getTime();
        }
        if (isNaN(t) || t < fromMs || t > toMs) return false;
      }

      return true;
    });

    const dayCounts: { [key: string]: number } = {
      Sat: 0, Fri: 0, Mon: 0, Wed: 0, Sun: 0, Thu: 0, Tue: 0
    };

    const dayNameMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    logs.forEach(a => {
      if (!a.date) return;
      let dayIndex = -1;

      if (typeof a.date === 'string' && a.date.includes('-')) {
        const parts = a.date.split('T')[0].split('-');
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        dayIndex = d.getDay();
      } else {
        const d = new Date(a.date);
        if (!isNaN(d.getTime())) dayIndex = d.getDay();
      }

      if (dayIndex >= 0 && dayIndex < 7) {
        const dayShort = dayNameMap[dayIndex];
        if (dayCounts[dayShort] !== undefined) {
          dayCounts[dayShort]++;
        }
      }
    });

    let totalAttendance = Object.values(dayCounts).reduce((sum, v) => sum + v, 0);

    let items = DAY_ORDER.map(day => {
      const count = dayCounts[day] || 0;
      const pct = totalAttendance > 0 ? ((count / totalAttendance) * 100).toFixed(1) : '0.0';
      return {
        day,
        fullName: DAY_FULL_NAMES[day],
        count,
        pct: Number(pct),
        color: DAY_COLORS[day],
      };
    });

    if (sortOrder === 'asc') {
      items = [...items].sort((a, b) => a.count - b.count);
    } else {
      items = [...items].sort((a, b) => b.count - a.count);
    }

    return {
      items,
      totalAttendance,
    };
  }, [effectiveAttendance, students, coaches, centres, filterCentre, filterCoach, dateFrom, dateTo, sortOrder]);

  // Donut Chart plugin for centered text ("Day distribution 18K")
  const centerTextPlugin = useMemo(() => ({
    id: 'centerTextPlugin',
    afterDraw(chart: any) {
      const { ctx, chartArea: { top, bottom, left, right, width, height } } = chart;
      ctx.save();
      
      const totalK = dayDistribution.totalAttendance >= 1000
        ? `${Math.round(dayDistribution.totalAttendance / 1000)}K`
        : `${dayDistribution.totalAttendance}`;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = left + width / 2;
      const centerY = top + height / 2;

      // Line 1: Day
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillStyle = '#374151';
      ctx.fillText('Day', centerX, centerY - 24);

      // Line 2: distribution
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillStyle = '#374151';
      ctx.fillText('distribution', centerX, centerY);

      // Line 3: 18K
      ctx.font = '900 24px Inter, sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(totalK, centerX, centerY + 26);

      ctx.restore();
    }
  }), [dayDistribution.totalAttendance]);

  // Render Chart.js Donut Chart
  useEffect(() => {
    if (viewType !== 'chart' || !canvasRef.current || isCollapsed) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const filteredItems = dayDistribution.items.filter(item => visibleDays[item.day]);
    const labels = filteredItems.map(i => `${i.day} (${i.count})`);
    const data = filteredItems.map(i => i.count);
    const bgColors = filteredItems.map(i => i.color);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: bgColors,
            borderColor: '#FFFFFF',
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      plugins: [centerTextPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%', // Donut inner hole
        plugins: {
          legend: {
            display: false, // Turned off to use custom checklist legend on right
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const item = filteredItems[context.dataIndex];
                return `${item.fullName}: ${item.count} classes (${item.pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [dayDistribution, viewType, isCollapsed, visibleDays, centerTextPlugin]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-5 mb-6 text-gray-800 select-none">
      {/* ── Top Action Header Bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Most popular day-2</span>
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
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1 rounded-md border border-gray-200 cursor-pointer shadow-2xs font-medium"
          >
            Sort {sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* ── Top Filters Row ───────────────────────────────────────────────── */}
          <div className="py-3 border-b border-gray-100 text-xs text-gray-700 space-y-2">
            <div className="flex flex-wrap items-center gap-6">
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

              {/* Date Filter Popover */}
              <div className="flex flex-col gap-1 relative" ref={datePickerRef}>
                <span className="font-semibold text-gray-600 text-xs">Date:</span>
                <button
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none text-left flex items-center justify-between min-w-[140px] shadow-2xs cursor-pointer hover:border-gray-400"
                >
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <span>🗓️</span>
                    <span>{dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'End'}` : '- Select -'}</span>
                  </span>
                  <span className="text-gray-400 text-xs ml-1">▾</span>
                </button>

                {/* Date Range Popover */}
                {isDatePickerOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 p-4 animate-fadeIn text-xs">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="From YYYY-MM-DD"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="To YYYY-MM-DD"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setIsDatePickerOpen(false)}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-4 py-1 rounded-md cursor-pointer transition-colors"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Coach name Filter */}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600 text-xs">Coach name:</span>
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
            </div>
          </div>

          {/* ── Chart & Legend Body ──────────────────────────────────────────── */}
          <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-6 relative">
            {viewType === 'chart' ? (
              <>
                {/* Donut Chart Canvas */}
                <div className="relative w-full md:w-2/3 h-[380px] flex items-center justify-center">
                  <canvas ref={canvasRef}></canvas>
                </div>

                {/* Right Legend Checklist (Matching Screenshot Exactly) */}
                <div className="w-full md:w-1/3 bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-900 border-b border-gray-200 pb-2">
                    <input
                      type="checkbox"
                      checked={showLegend}
                      onChange={e => {
                        const val = e.target.checked;
                        setShowLegend(val);
                        const next: any = {};
                        DAY_ORDER.forEach(d => next[d] = val);
                        setVisibleDays(next);
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Date</span>
                  </label>

                  {showLegend && (
                    <div className="space-y-1.5 pt-1">
                      {dayDistribution.items.map(item => (
                        <div key={item.day} className="flex items-center justify-between font-semibold text-gray-700 hover:bg-white p-1 rounded-md transition-colors">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!visibleDays[item.day]}
                              onChange={e => setVisibleDays({ ...visibleDays, [item.day]: e.target.checked })}
                              className="rounded focus:ring-indigo-500"
                              style={{ accentColor: item.color }}
                            />
                            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: item.color }}></span>
                            <span>{item.day}</span>
                          </label>
                          <span className="font-mono text-gray-900">{item.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full overflow-x-auto max-h-[380px] border border-gray-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Day of Week</th>
                      <th className="py-2.5 px-4 text-right">Attendance Count</th>
                      <th className="py-2.5 px-4 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayDistribution.items.map(item => (
                      <tr key={item.day} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-gray-800 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-xs" style={{ backgroundColor: item.color }}></span>
                          <span>{item.fullName} ({item.day})</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900">{item.count.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40">{item.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold border-t border-gray-200 text-gray-900">
                    <tr>
                      <td className="py-2.5 px-4">Total Attendance</td>
                      <td className="py-2.5 px-4 text-right font-mono">{dayDistribution.totalAttendance.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-mono">100.0%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
