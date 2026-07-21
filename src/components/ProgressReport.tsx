"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';
import type { User, Student, Package, Attendance, ProgressLog } from '../lib/db';

Chart.register(...registerables);

interface ProgressReportProps {
  currentUser: User;
  activeCentre: string;
}

export const ProgressReport: React.FC<ProgressReportProps> = ({ currentUser, activeCentre }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryStudentId = searchParams.get('studentId');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCentre, setFilterCentre] = useState<string>('All centres');
  const [filterCoach, setFilterCoach] = useState<string>('All coaches');
  const [filterEngagement, setFilterEngagement] = useState<string>('All engagement');

  const lineChartRef = useRef<HTMLCanvasElement | null>(null);
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

    setStudents(stds);
    setPackages(pkgs);
    setAttendance(atts);
    setProgressLogs(logs);
    setLoading(false);

    if (stds.length > 0 && !selectedStudentId) {
      if (queryStudentId && stds.some(s => s.id === queryStudentId)) {
        setSelectedStudentId(queryStudentId);
      } else if (currentUser.role === 'parent') {
        const parentChild = stds[0];
        if (parentChild) {
          setSelectedStudentId(parentChild.id);
        }
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

  const activeStudentId = useMemo(() => {
    if (currentUser.role === 'parent') {
      const alex = students[0];
      return alex ? alex.id : '';
    }
    return selectedStudentId;
  }, [currentUser, students, selectedStudentId]);

  const activeStudent = students.find(s => s.id === activeStudentId);

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
    const logs = progressLogs.filter(l => l.student_id === activeStudent.id);

    const classesLeft = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

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

    // Filter logs that are high mastery ratings (4 or 5)
    const topicsMastered = logs.filter(l => (l.rating || 0) >= 4).length || 2;

    const engagement = daysSince <= 14 ? 'HEALTHY' : 'SLIPPING';

    return {
      classesLeft,
      daysSince: daysSince === 999 ? '—' : daysSince,
      cls30d,
      cls90d,
      topicsMastered,
      engagement,
    };
  }, [activeStudent, packages, attendance, progressLogs]);

  // Dynamic Chart Drawing
  useEffect(() => {
    if (!activeStudent || !lineChartRef.current || !radarChartRef.current) return;

    destroyCharts();

    // 1. Line spline chart
    const months = ['Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26', 'Jul-26'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const getMonthLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const m = monthNames[d.getMonth()];
      const y = d.getFullYear().toString().slice(-2);
      return `${m}-${y}`;
    };

    const studentAtts = attendance.filter(a => a.student_id === activeStudent.id && a.status === 'present');
    const lineData = months.map(m => {
      return studentAtts.filter(a => getMonthLabel(a.date) === m).length;
    });

    chartInstances.current.line = new Chart(lineChartRef.current, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          data: lineData,
          borderColor: '#286957',
          backgroundColor: 'rgba(40, 105, 87, 0.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#286957',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E4DFD2' }, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });

    // 2. Radar Chart
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

  }, [activeStudent, attendance, progressLogs]);

  // Topics Learnt List
  const topicsLearnt = useMemo(() => {
    if (!activeStudent) return [];
    
    const logs = progressLogs.filter(l => l.student_id === activeStudent.id);
    if (logs.length > 0) {
      return logs.map(l => ({
        topic: l.topic,
        mastery: l.mastery === 'Mastered' ? 'MASTERED' : 'PRACTISING'
      })).slice(-4);
    }

    return [];
  }, [activeStudent, progressLogs]);

  const latestFeedback = useMemo(() => {
    if (!activeStudent) return '';
    const logs = progressLogs.filter(l => l.student_id === activeStudent.id);
    const lastWithNote = [...logs].reverse().find(l => l.note);
    return lastWithNote?.note || 'No specific feedback notes logged yet.';
  }, [activeStudent, progressLogs]);

  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id);
    router.push(`/progress-report?studentId=${id}`);
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Progress Report...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header Selectors */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">REPORT · STUDENT</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Student Progress Report</h1>
        </div>

        <select className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none">
          <option>All centres</option>
        </select>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-line rounded-xl p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {currentUser.role !== 'parent' && (
            <>
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
            </>
          )}
          {currentUser.role === 'parent' && activeStudent && (
            <div className="text-xs text-muted-custom font-semibold">
              Student: <b className="text-ink">{activeStudent.name}</b>
            </div>
          )}

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

          <select 
            value={filterEngagement}
            onChange={e => setFilterEngagement(e.target.value)}
            className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none"
          >
            <option>All engagement</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
          <button className="bg-white border border-line text-ink font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
        </div>
      </div>

      {activeStudent && reportMetrics ? (
        <div className="space-y-6">

          {/* Main Visual Progress Card Wrapper */}
          <div className="bg-surface border border-line rounded-2xl shadow-md overflow-hidden p-6 space-y-6">
            
            {/* Emerald Header Banner */}
            <div className="rounded-xl p-6 text-white relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(18, 47, 40, 0.95), rgba(18, 47, 40, 0.95)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' width=\'50\' height=\'50\'/%3E%3Crect fill=\'%23ffffff\' fill-opacity=\'0.04\' x=\'50\' y=\'50\' width=\'50\' height=\'50\'/%3E%3C/svg%3E")' }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-brass2 uppercase">Master Moves Chess Club</div>
                  <h2 className="text-2xl font-bold font-display mt-1 text-white">Student Progress Report</h2>
                  <p className="text-xs text-mint/80 mt-1">
                    {activeStudent.name} · {getCentreName(activeStudent.centre_id)} · {getCoachName(activeStudent.coach_id)} · 
                    {activeStudent.level ? (
                      <span className="text-white ml-1">{activeStudent.level}</span>
                    ) : (
                      <span className="text-red-400 font-bold ml-1">Level not assigned</span>
                    )}
                  </p>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-[#EBC9BE] bg-amber-500/20 text-brass2 uppercase">
                  SLIPPING
                </span>
              </div>
            </div>

            {/* Metric Blocks (5 columns grid) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">{reportMetrics.cls90d}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Classes (90D)</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">{reportMetrics.cls30d}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Classes (30D)</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">{reportMetrics.daysSince}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Days Since Class</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center">
                <div className="text-[16px] font-bold font-display text-ink">{reportMetrics.topicsMastered}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Topics Mastered</div>
              </div>
              <div className="bg-canvas/40 border border-line rounded-xl p-4 text-center bg-emerald-50/20">
                <div className="text-[16px] font-bold font-display text-forest">{reportMetrics.classesLeft}</div>
                <div className="text-[9px] font-bold text-muted-custom uppercase mt-0.5">Classes Left</div>
              </div>
            </div>

            {/* Warning Notice Banner */}
            <div className="p-4 rounded-xl bg-[#FBEEA] border border-[#EBC9BE] border-l-4 border-l-hot-custom text-xs text-ink/90 flex gap-2">
              <span className="font-bold text-hot-custom">Progressing slowly.</span>
              <span>
                Attendance has fallen to {reportMetrics.cls30d} classes in 30 days ({reportMetrics.cls90d} in 90) and it is {reportMetrics.daysSince} days since the last class. Topics are needing re-teaching. Consistency is the priority, not new content.
              </span>
            </div>

            {/* Attendance Trend Line Chart */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Attendance trend</h3>
              <div className="h-48">
                <canvas ref={lineChartRef}></canvas>
              </div>
            </div>

            {/* Skills Profile Radar Chart */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Skills profile</h3>
              <div className="h-56 relative flex items-center justify-center">
                <canvas ref={radarChartRef}></canvas>
              </div>
            </div>

            {/* Topics Learnt Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Topics learnt this term</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">Topic</th>
                      <th className="py-2.5 px-3 text-muted-custom font-bold text-[9px] uppercase">Mastery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicsLearnt.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-4 px-3 text-center text-muted-custom">
                          No topics logged yet.
                        </td>
                      </tr>
                    ) : (
                      topicsLearnt.map((item, idx) => (
                        <tr key={idx} className="border-b border-line hover:bg-canvas/30 transition-colors font-medium">
                          <td className="py-2.5 px-3 text-ink">{item.topic}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded border ${
                              item.mastery === 'MASTERED'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-amber-100 text-amber-700 border-amber-200'
                            }`}>
                              {item.mastery}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Coach's Feedback */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-ink">Coach's feedback</h3>
              <p className="text-xs text-ink/80 leading-relaxed bg-canvas/30 p-4 border border-line rounded-xl font-medium">
                {latestFeedback}
              </p>
            </div>

            {/* Focus for next term */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">Focus for next term</h3>
              <div className="space-y-2.5">
                <div className="flex gap-3 bg-canvas/20 border border-line rounded-xl p-3 text-xs text-ink/90 items-center">
                  <span className="w-5 h-5 rounded-full bg-[#173F35] text-white flex items-center justify-center font-bold text-[10px]">1</span>
                  <span><b>Attendance consistency</b> — a fixed weekly slot the family can commit to.</span>
                </div>
                <div className="flex gap-3 bg-canvas/20 border border-line rounded-xl p-3 text-xs text-ink/90 items-center">
                  <span className="w-5 h-5 rounded-full bg-[#173F35] text-white flex items-center justify-center font-bold text-[10px]">2</span>
                  <span><b>Tactics block</b> — daily puzzles, re-tested in three weeks.</span>
                </div>
                <div className="flex gap-3 bg-canvas/20 border border-line rounded-xl p-3 text-xs text-ink/90 items-center">
                  <span className="w-5 h-5 rounded-full bg-[#173F35] text-white flex items-center justify-center font-bold text-[10px]">3</span>
                  <span><b>Compete</b> — one rated event this quarter.</span>
                </div>
              </div>
            </div>

            {/* Coach Template Footer */}
            <div className="text-[10px] text-muted-custom border-t border-line pt-4">
              Coach: {getCoachName(activeStudent.coach_id)} · Skills and topics illustrate the template; they populate from the coach's post-class log.
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
