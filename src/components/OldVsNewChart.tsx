"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface OldVsNewChartProps {
  enrichedPackages: any[];
  centres: string[];
}

export const OldVsNewChart: React.FC<OldVsNewChartProps> = ({ enrichedPackages, centres }) => {
  const [filterCentre, setFilterCentre] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [viewType, setViewType] = useState<'chart' | 'table'>('chart');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(true);

  // Calendar popover month state
  const [calDate, setCalDate] = useState<Date>(new Date(2026, 8, 1)); // Sep 2026 default

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const datePickerRef = useRef<HTMLDivElement | null>(null);

  // Reset all filters
  const handleResetFilters = () => {
    setFilterCentre('All');
    setFilterStatus('All');
    setFilterType('All');
    setDateFrom('');
    setDateTo('');
    setIsDatePickerOpen(false);
  };

  // Click outside to close date picker popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group enriched packages month-wise
  const monthlyData = useMemo(() => {
    let rows = enrichedPackages;

    if (filterCentre !== 'All') {
      rows = rows.filter(r => r.centreName?.toLowerCase() === filterCentre.toLowerCase());
    }
    if (filterStatus !== 'All') {
      rows = rows.filter(r => r.status?.toLowerCase() === filterStatus.toLowerCase());
    }
    if (filterType !== 'All') {
      if (filterType === 'New Student') {
        rows = rows.filter(r => r.type === 'New' || r.pkgNo === 1);
      } else if (filterType === 'Old student') {
        rows = rows.filter(r => r.type === 'Renewal' || r.type === 'Tournament' || r.pkgNo > 1);
      }
    }

    // Filter by Date of payment range if set
    if (dateFrom || dateTo) {
      const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toMs = dateTo ? new Date(dateTo).getTime() + 86399999 : Infinity;
      rows = rows.filter(r => {
        let rawDate = r.paidOn;
        if (!rawDate || rawDate === '-') {
          rawDate = r.firstClass !== '-' ? r.firstClass : null;
        }
        if (!rawDate) return false;
        const t = new Date(rawDate).getTime();
        return !isNaN(t) && t >= fromMs && t <= toMs;
      });
    }

    // 1. Determine min and max year/month across all packages
    let minYear = 2024;
    let minMonth = 1; // Feb 2024
    let maxYear = 2026;
    let maxMonth = 7; // Aug 2026

    enrichedPackages.forEach(r => {
      let rawDate = r.paidOn;
      if (!rawDate || rawDate === '-') {
        rawDate = r.firstClass !== '-' ? r.firstClass : null;
      }
      if (!rawDate) return;

      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = d.getMonth();

      if (y < minYear || (y === minYear && m < minMonth)) {
        minYear = y;
        minMonth = m;
      }
      if (y > maxYear || (y === maxYear && m > maxMonth)) {
        maxYear = y;
        maxMonth = m;
      }
    });

    const monthMap = new Map<string, { year: number; month: number; label: string; newCount: number; renewalCount: number }>();

    // 2. Pre-fill ALL continuous months from minYear/Month to maxYear/Month
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
        newCount: 0,
        renewalCount: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    // 3. Populate package counts into month map
    rows.forEach(r => {
      let rawDate = r.paidOn;
      if (!rawDate || rawDate === '-') {
        rawDate = r.firstClass !== '-' ? r.firstClass : null;
      }
      if (!rawDate) return;

      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (monthMap.has(key)) {
        const entry = monthMap.get(key)!;
        const isNew = r.type === 'New' || r.pkgNo === 1;
        if (isNew) {
          entry.newCount++;
        } else {
          entry.renewalCount++;
        }
      }
    });

    return Array.from(monthMap.values());
  }, [enrichedPackages, filterCentre, filterStatus, filterType, dateFrom, dateTo]);

  // Render Chart.js Stacked Bar Chart
  useEffect(() => {
    if (viewType !== 'chart' || !canvasRef.current || isCollapsed) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = monthlyData.map(d => d.label);
    const newStudentsData = monthlyData.map(d => d.newCount);
    const oldStudentsData = monthlyData.map(d => d.renewalCount);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'New Student',
            data: newStudentsData,
            backgroundColor: '#D99B26', // Gold / Amber
            borderColor: '#B47D18',
            borderWidth: 1,
            borderRadius: 2,
          },
          {
            label: 'Old student',
            data: oldStudentsData,
            backgroundColor: '#0D7A66', // Teal / Green
            borderColor: '#095A4B',
            borderWidth: 1,
            borderRadius: 2,
          },
        ],
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
            display: false,
          },
          tooltip: {
            callbacks: {
              footer: (items) => {
                let total = 0;
                items.forEach(item => {
                  total += Number(item.raw || 0);
                });
                return `Total: ${total} packages`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 10,
                weight: '600',
              },
              color: '#4B5563',
              maxRotation: 45,
            },
            title: {
              display: true,
              text: 'Month & Year of Date of payment',
              font: {
                size: 11,
                weight: 'bold',
              },
              color: '#374151',
            },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              stepSize: 10,
              font: {
                size: 10,
              },
              color: '#6B7280',
            },
            title: {
              display: true,
              text: 'New Student , Old student',
              font: {
                size: 11,
                weight: 'bold',
              },
              color: '#374151',
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
  }, [monthlyData, viewType, isCollapsed]);

  // Calendar rendering helper
  const renderCalendarDays = () => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelectedFrom = dateFrom === dateStr;
      const isSelectedTo = dateTo === dateStr;
      const isToday = d === 2; // Matching screenshot highlight

      days.push(
        <button
          key={d}
          onClick={() => {
            if (!dateFrom || (dateFrom && dateTo)) {
              setDateFrom(dateStr);
              setDateTo('');
            } else {
              if (new Date(dateStr) >= new Date(dateFrom)) {
                setDateTo(dateStr);
              } else {
                setDateFrom(dateStr);
              }
            }
          }}
          className={`w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
            isSelectedFrom || isSelectedTo
              ? 'bg-indigo-600 text-white font-bold shadow-xs'
              : isToday
              ? 'border-2 border-indigo-500 text-indigo-700 font-bold'
              : (d % 7 === 0 || (d + firstDay - 1) % 7 === 6)
              ? 'text-red-500 hover:bg-gray-100'
              : 'text-gray-800 hover:bg-gray-100'
          }`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-5 mb-6 text-gray-800 select-none">
      {/* ── Top Action Header Bar (Zoho Style) ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Old Vs New - Ragu</span>
          </h2>
          <button
            onClick={handleResetFilters}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1 rounded-md border border-gray-300 font-medium cursor-pointer shadow-2xs transition-colors"
          >
            Regenerate
          </button>
        </div>

        {/* Action Buttons Right */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleResetFilters()}
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
            title="Sort"
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1 rounded-md border border-gray-200 cursor-pointer shadow-2xs font-medium"
          >
            Sort
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* ── Top Filters Row (Matching Zoho Creator format) ────────────────────────── */}
          <div className="py-3 border-b border-gray-100 text-xs text-gray-700 space-y-2">
            <div className="flex flex-wrap items-center gap-6">
              {/* Centre Filter */}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-green-700 text-xs">Centre:</span>
                <select
                  value={filterCentre}
                  onChange={e => setFilterCentre(e.target.value)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none focus:border-indigo-500 min-w-[130px] shadow-2xs cursor-pointer"
                >
                  <option value="All">- Select -</option>
                  {centres.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date of payment Filter with Calendar Popover */}
              <div className="flex flex-col gap-1 relative" ref={datePickerRef}>
                <span className="font-semibold text-gray-600 text-xs">Date of payment:</span>
                <button
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none text-left flex items-center justify-between min-w-[130px] shadow-2xs cursor-pointer hover:border-gray-400"
                >
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <span>🗓️</span>
                    <span>{dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'End'}` : '- Select -'}</span>
                  </span>
                  <span className="text-gray-400 text-xs ml-1">▾</span>
                </button>

                {/* Zoho Style Calendar Popover */}
                {isDatePickerOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 p-4 animate-fadeIn text-xs">
                    {/* From / To Date Inputs */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-gray-400">🗓️</span>
                        <input
                          type="text"
                          placeholder="From"
                          value={dateFrom}
                          onChange={e => setDateFrom(e.target.value)}
                          className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-gray-400">🗓️</span>
                        <input
                          type="text"
                          placeholder="To"
                          value={dateTo}
                          onChange={e => setDateTo(e.target.value)}
                          className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Month Navigator Header */}
                    <div className="flex items-center justify-between mb-3 px-1 text-gray-700">
                      <button
                        onClick={() => setCalDate(new Date(calDate.getFullYear() - 1, calDate.getMonth(), 1))}
                        className="text-gray-400 hover:text-gray-700 text-xs"
                      >
                        «
                      </button>
                      <button
                        onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
                        className="text-gray-400 hover:text-gray-700 text-xs"
                      >
                        ‹
                      </button>
                      <span className="font-bold text-gray-900 text-sm">
                        {calDate.toLocaleString('default', { month: 'short' })} {calDate.getFullYear()}
                      </span>
                      <button
                        onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
                        className="text-gray-400 hover:text-gray-700 text-xs"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => setCalDate(new Date(calDate.getFullYear() + 1, calDate.getMonth(), 1))}
                        className="text-gray-400 hover:text-gray-700 text-xs"
                      >
                        »
                      </button>
                    </div>

                    {/* Calendar Grid Header */}
                    <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-gray-500 mb-1">
                      <span className="text-red-500">Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span className="text-red-500">Sat</span>
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 mb-4">{renderCalendarDays()}</div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <button
                        onClick={() => {
                          setDateFrom('');
                          setDateTo('');
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setIsDatePickerOpen(false)}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-4 py-1.5 rounded-md cursor-pointer transition-colors shadow-xs"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Class Status Filter */}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600 text-xs">Class Status:</span>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none focus:border-indigo-500 min-w-[130px] shadow-2xs cursor-pointer"
                >
                  <option value="All">- Select -</option>
                  <option value="CURRENT">CURRENT</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="UNBILLED">UNBILLED</option>
                </select>
              </div>

              {/* New/Renewal Filter */}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600 text-xs">New/Renewal:</span>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-xs outline-none focus:border-indigo-500 min-w-[130px] shadow-2xs cursor-pointer"
                >
                  <option value="All">- Select -</option>
                  <option value="New Student">New Student</option>
                  <option value="Old student">Old student</option>
                </select>
              </div>
            </div>

            {/* Reset Button (Matching Screenshot) */}
            <div className="pt-2">
              <button
                onClick={handleResetFilters}
                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs px-3 py-1 rounded-md shadow-2xs cursor-pointer transition-all"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Chart or Data Table Body */}
          <div className="pt-4 relative">
            {/* Custom Legend Checklist */}
            <div className="flex items-center justify-end gap-4 mb-2 text-xs text-gray-700">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={e => setShowLegend(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Legend</span>
              </label>
              {showLegend && (
                <>
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800">
                    <span className="w-3 h-3 rounded-xs bg-[#D99B26]"></span>
                    <span>New Student</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800">
                    <span className="w-3 h-3 rounded-xs bg-[#0D7A66]"></span>
                    <span>Old student</span>
                  </div>
                </>
              )}
            </div>

            {viewType === 'chart' ? (
              <div className="relative w-full h-[360px]">
                <canvas ref={canvasRef}></canvas>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Month & Year</th>
                      <th className="py-2.5 px-4 text-right">New Student</th>
                      <th className="py-2.5 px-4 text-right">Old student (Renewal)</th>
                      <th className="py-2.5 px-4 text-right">Total Packages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-gray-400">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      monthlyData.map(d => (
                        <tr key={d.label} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-gray-800">{d.label}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700 bg-amber-50/50">{d.newCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-700 bg-teal-50/50">{d.renewalCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900">{d.newCount + d.renewalCount}</td>
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
