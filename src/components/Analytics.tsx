// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { db } from '../lib/db';

Chart.register(...registerables);

interface AnalyticsProps {
  activeCentre: string;
  currentUser?: any;
}

export const Analytics: React.FC<AnalyticsProps> = ({ activeCentre, currentUser }) => {
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
  interface ReportSection {
    id: string;
    title: string;
    type: 'kpis' | 'chart' | 'table' | 'text';
    measures: string[];
    filterCentre: string;
    filterBucket: string;
    filterEngagement: string;
    filterLevel: string;
    filterCoach: string;
    text?: string;
  }

  const [reportTitle, setReportTitle] = useState('My custom report');
  const [globalFilterCentre, setGlobalFilterCentre] = useState('All centres');
  const [sections, setSections] = useState<ReportSection[]>([
    {
      id: 'sec-1',
      title: 'Key numbers',
      type: 'kpis',
      measures: ['Students', 'Run-rate AED / month', 'Unbilled value — ledger (AED)'],
      filterCentre: 'All centres',
      filterBucket: 'All buckets',
      filterEngagement: 'All engagement',
      filterLevel: 'All levels',
      filterCoach: 'All coaches',
    },
    {
      id: 'sec-2',
      title: 'Breakdown',
      type: 'chart',
      measures: ['Students'],
      filterCentre: 'All centres',
      filterBucket: 'All buckets',
      filterEngagement: 'All engagement',
      filterLevel: 'All levels',
      filterCoach: 'All coaches',
    }
  ]);
  const [activeSectionId, setActiveSectionId] = useState<string>('sec-1');

  const activeSection = useMemo(() => {
    return sections.find(s => s.id === activeSectionId) || sections[0] || null;
  }, [sections, activeSectionId]);

  const updateActiveSection = (key: keyof ReportSection, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id === activeSectionId) {
        return { ...s, [key]: value };
      }
      return s;
    }));
  };

  const handleMeasureToggle = (measure: string) => {
    if (!activeSection) return;
    const measures = activeSection.measures.includes(measure)
      ? activeSection.measures.filter(m => m !== measure)
      : [...activeSection.measures, measure];
    updateActiveSection('measures', measures);
  };

  const addSection = (type: 'kpis' | 'chart' | 'table' | 'text') => {
    const newId = `sec-${Date.now()}`;
    const newSection: ReportSection = {
      id: newId,
      title: type === 'kpis' ? 'Key numbers' : type === 'chart' ? 'Breakdown' : type === 'table' ? 'Roster Table' : 'Text block',
      type,
      measures: type === 'kpis' ? ['Students', 'Run-rate AED / month'] : [],
      filterCentre: 'All centres',
      filterBucket: 'All buckets',
      filterEngagement: 'All engagement',
      filterLevel: 'All levels',
      filterCoach: 'All coaches',
      text: type === 'text' ? 'Write report content or analysis details here...' : undefined
    };
    setSections(prev => [...prev, newSection]);
    setActiveSectionId(newId);
  };

  const moveSectionUp = (idx: number) => {
    if (idx === 0) return;
    setSections(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return copy;
    });
  };

  const moveSectionDown = (idx: number) => {
    setSections(prev => {
      if (idx >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return copy;
    });
  };

  const duplicateSection = (sec: ReportSection) => {
    const newId = `sec-${Date.now()}`;
    const copy: ReportSection = {
      ...sec,
      id: newId,
      title: `${sec.title} (Copy)`,
      measures: [...sec.measures]
    };
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sec.id);
      const res = [...prev];
      res.splice(idx + 1, 0, copy);
      return res;
    });
    setActiveSectionId(newId);
  };

  const deleteSection = (id: string) => {
    setSections(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (activeSectionId === id && filtered.length > 0) {
        setActiveSectionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const getPackagePrice = (pkg: any) => {
    const tiersList = db.getTiers();
    const t = tiersList.find(tier => tier.id === pkg.tier_id);
    return t ? Number(t.price) : 1000;
  };

  const maxAttDateStr = attendance.reduce((max, att) => {
    if (!att.date) return max;
    const dStr = new Date(att.date).toISOString().split('T')[0];
    return dStr > max ? dStr : max;
  }, "2026-07-12");
  const anchorDate = new Date(maxAttDateStr);
  const thirtyDaysAgo = new Date(anchorDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const studentRateMap = new Map<string, number>();
  students.forEach(s => {
    const sPkgs = packages.filter(p => p.student_id === s.id);
    const activePkg = sPkgs.find(p => p.classes_remaining > 0) || sPkgs[0];
    let rate = 125;
    if (activePkg) {
      const tier = db.getTiers().find(t => t.id === activePkg.tier_id);
      const price = tier ? Number(tier.price) : 1000;
      const discount = activePkg.discount_pct ? Number(activePkg.discount_pct) : 0;
      const totalClasses = activePkg.classes_total || 8;
      rate = (price * (1 - discount / 100)) / totalClasses;
    }
    studentRateMap.set(s.id, rate);
  });

  const getRunRateForStudents = (sts: any[]) => {
    const studentIdsSet = new Set(sts.map(s => s.id));
    const classes30D = attendance.filter(a => {
      if (a.status !== 'present' && a.status !== 'makeup') return false;
      const aDate = new Date(a.date);
      return aDate >= thirtyDaysAgo && aDate <= anchorDate && studentIdsSet.has(a.student_id);
    });
    return classes30D.reduce((sum, c) => {
      const rate = studentRateMap.get(c.student_id) || 125;
      return sum + rate;
    }, 0);
  };

  const getFilteredDataForSection = (sec: ReportSection) => {
    return students.filter(s => {
      // 1. Global Filter Centre
      if (globalFilterCentre !== 'All centres') {
        const c = centres.find(ctr => ctr.name === globalFilterCentre);
        if (c && s.centre_id !== c.id) return false;
      }
      // 2. Section Centre Filter
      if (sec.filterCentre !== 'All centres') {
        const c = centres.find(ctr => ctr.name === sec.filterCentre);
        if (c && s.centre_id !== c.id) return false;
      }
      // 3. Level Filter
      if (sec.filterLevel !== 'All levels' && s.level !== sec.filterLevel) return false;
      
      // 4. Segment (Bucket) Filter
      if (sec.filterBucket !== 'All buckets') {
        const heat = (s.flags?.low_package) ? 'HOT' : 'HEALTHY';
        if (heat !== sec.filterBucket) return false;
      }
      
      // 5. Engagement Filter
      if (sec.filterEngagement !== 'All engagement') {
        const today = new Date();
        const daysSince = s.last_attended
          ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000)
          : 999;
        const engStatus = daysSince <= 14 ? 'Engaged' : daysSince <= 30 ? 'Slipping' : 'Dormant';
        if (engStatus.toLowerCase() !== sec.filterEngagement.split(' ')[1]?.toLowerCase() && 
            engStatus.toLowerCase() !== sec.filterEngagement.toLowerCase()) return false;
      }

      // 6. Coach Filter
      if (sec.filterCoach !== 'All coaches') {
        const coach = coaches.find(c => c.name === sec.filterCoach);
        if (coach && s.coach_id !== coach.id) return false;
      }

      return true;
    });
  };

  const getSectionMetrics = (filteredSts: any[]) => {
    const totalSts = filteredSts.length;
    const activeSts = filteredSts.filter(s => {
      if (!s.last_attended) return false;
      const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
      return diff >= 0 && diff <= 30 && s.status === 'active';
    }).length;
    const activePct = totalSts > 0 ? Math.round((activeSts / totalSts) * 100) : 0;

    const studentIdsSet = new Set(filteredSts.map(s => s.id));
    const classes30D = attendance.filter(a => {
      if (a.status !== 'present' && a.status !== 'makeup') return false;
      const aDate = new Date(a.date);
      return aDate >= thirtyDaysAgo && aDate <= anchorDate && studentIdsSet.has(a.student_id);
    });
    const runrate = classes30D.reduce((sum, c) => {
      const rate = studentRateMap.get(c.student_id) || 125;
      return sum + rate;
    }, 0);
    const unbilledVal = filteredSts.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
    const unbilledCls = filteredSts.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);

    const paidInvs = invoices.filter(i => i.status === 'paid' && filteredSts.some(s => s.id === i.student_id));
    const collected = paidInvs.reduce((sum, i) => sum + Number(i.amount), 0);

    const classes30 = attendance.filter(a => a.status === 'present' && filteredSts.some(s => s.id === a.student_id) && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 30)).length;
    const classes90 = attendance.filter(a => a.status === 'present' && filteredSts.some(s => s.id === a.student_id) && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 90)).length;

    const avgRate = filteredPkgs.length > 0
      ? Math.round(filteredPkgs.reduce((sum, p) => sum + getPackagePrice(p) / (p.classes_total || 8), 0) / filteredPkgs.length)
      : 100;

    const avgDays = (() => {
      const today = new Date();
      const withAtt = filteredSts.filter(s => s.last_attended);
      if (withAtt.length === 0) return 0;
      return Math.round(withAtt.reduce((sum, s) => sum + Math.floor((today.getTime() - new Date(s.last_attended!).getTime()) / 86400000), 0) / withAtt.length);
    })();

    const avgLifetime = totalSts > 0 ? Math.round(collected / totalSts) : 0;

    const pctEngaged = (() => {
      if (totalSts === 0) return 0;
      const today = new Date();
      const eng = filteredSts.filter(s => {
        if (!s.last_attended) return false;
        const diff = Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000);
        return diff <= 14;
      }).length;
      return Math.round((eng / totalSts) * 100);
    })();

    return {
      totalStudents: totalSts,
      activeStudents: activeSts,
      activePercent: activePct,
      runrate,
      unbilledValue: unbilledVal,
      unbilledClasses: unbilledCls,
      lifetimePaid: collected,
      classes30d: classes30,
      classes90d: classes90,
      avgRatePerClass: avgRate,
      avgDaysSinceLastClass: avgDays,
      avgLifetimePaid: avgLifetime,
      percentEngaged: pctEngaged
    };
  };

  const exportSectionToExcel = (sec: ReportSection) => {
    const filteredSts = getFilteredDataForSection(sec);
    const data = filteredSts.map((s, idx) => {
      const coachName = coaches.find(c => c.id === s.coach_id)?.name || 'Unassigned';
      const centreName = centres.find(c => c.id === s.centre_id)?.name || '—';
      const segment = (s.flags?.low_package) ? 'HOT' : 'HEALTHY';
      return {
        Index: idx + 1,
        Name: s.name,
        Level: s.level,
        Status: s.status,
        FideId: s.fide_id || '—',
        Centre: centreName,
        Coach: coachName,
        Segment: segment,
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
    link.setAttribute("download", `${sec.title.toLowerCase().replace(/\s+/g, "_")}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportReportJSON = () => {
    const reportData = {
      title: reportTitle,
      globalFilterCentre,
      sections
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${reportTitle.toLowerCase().replace(/\s+/g, "_")}_definition.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.title) setReportTitle(parsed.title);
        if (parsed.globalFilterCentre) setGlobalFilterCentre(parsed.globalFilterCentre);
        if (Array.isArray(parsed.sections)) {
          setSections(parsed.sections);
          if (parsed.sections.length > 0) {
            setActiveSectionId(parsed.sections[0].id);
          }
        }
        alert("✓ Report successfully imported!");
      } catch (err) {
        alert("Error parsing JSON file. Please ensure it is a valid report definition.");
      }
    };
    reader.readAsText(file);
  };

  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);

  const applyTemplate = (templateName: string) => {
    if (templateName === 'Key Executive Overview') {
      setSections([
        {
          id: 'sec-ex-1',
          title: 'Key numbers',
          type: 'kpis',
          measures: ['Students', 'Run-rate AED / month', 'Unbilled value — ledger (AED)', 'Lifetime paid (AED)'],
          filterCentre: 'All centres',
          filterBucket: 'All buckets',
          filterEngagement: 'All engagement',
          filterLevel: 'All levels',
          filterCoach: 'All coaches',
        },
        {
          id: 'sec-ex-2',
          title: 'Revenue Distribution',
          type: 'chart',
          measures: ['Students'],
          filterCentre: 'All centres',
          filterBucket: 'All buckets',
          filterEngagement: 'All engagement',
          filterLevel: 'All levels',
          filterCoach: 'All coaches',
        }
      ]);
      setActiveSectionId('sec-ex-1');
    } else if (templateName === 'Roster Breakdown') {
      setSections([
        {
          id: 'sec-rost-1',
          title: 'Section overview',
          type: 'text',
          measures: [],
          filterCentre: 'All centres',
          filterBucket: 'All buckets',
          filterEngagement: 'All engagement',
          filterLevel: 'All levels',
          filterCoach: 'All coaches',
          text: 'This report contains student rosters filtered dynamically.'
        },
        {
          id: 'sec-rost-2',
          title: 'Detailed Roster',
          type: 'table',
          measures: [],
          filterCentre: 'All centres',
          filterBucket: 'All buckets',
          filterEngagement: 'All engagement',
          filterLevel: 'All levels',
          filterCoach: 'All coaches',
        }
      ]);
      setActiveSectionId('sec-rost-1');
    }
  };

  const exportReportToPDF = () => {
    window.print();
  };

  const exportDashboardExcel = () => {
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
    link.setAttribute("download", `dashboard_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chart Refs
  const studentsChartRef = useRef<HTMLCanvasElement | null>(null);
  const enrolmentsChartRef = useRef<HTMLCanvasElement | null>(null);
  const comparisonChartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<{ [key: string]: Chart | null }>({});

  const destroyCharts = () => {
    Object.keys(chartInstances.current).forEach(key => {
      if (chartInstances.current[key]) {
        chartInstances.current[key]?.destroy();
        chartInstances.current[key] = null;
      }
    });
  };

  const drawDashboardCharts = () => {
    if (loading) return;

    // 1. Dynamic Dice Chart
    if (studentsChartRef.current) {
      let labels: string[] = [];
      let data: number[] = [];
      let backgroundColors: string[] | string = '#286957';

      if (diceBy === 'By Centre') {
        labels = ['Bay Avenue', 'JLT'];
        data = [
          filteredStudents.filter(s => s.centre_id === bayCentreId).length,
          filteredStudents.filter(s => s.centre_id === jltCentreId).length
        ];
        backgroundColors = ['#286957', '#C4A249'];
      } else if (diceBy === 'By Coach') {
        const coachCounts: Record<string, number> = {};
        filteredStudents.forEach(s => {
          const coachName = coaches.find(c => c.id === s.coach_id)?.name || 'Unassigned';
          coachCounts[coachName] = (coachCounts[coachName] || 0) + 1;
        });
        labels = Object.keys(coachCounts);
        data = Object.values(coachCounts);
        backgroundColors = '#286957';
      } else if (diceBy === 'By Engagement') {
        const today = new Date();
        const counts = { Engaged: 0, Slipping: 0, Cold: 0, Dormant: 0, 'Never attended': 0 };
        filteredStudents.forEach(s => {
          const daysSince = s.last_attended ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000) : 999;
          if (daysSince === 999) counts['Never attended']++;
          else if (daysSince <= 14) counts.Engaged++;
          else if (daysSince <= 30) counts.Slipping++;
          else if (daysSince <= 60) counts.Cold++;
          else counts.Dormant++;
        });
        labels = Object.keys(counts);
        data = Object.values(counts);
        backgroundColors = ['#286957', '#C4A249', '#9DDDCB', '#E4DFD2', '#173F35'];
      } else if (diceBy === 'By Segment') {
        const counts = { HOT: 0, WARM: 0, COLD: 0, HEALTHY: 0 };
        filteredStudents.forEach(s => {
          const pkgs = packages.filter(p => p.student_id === s.id && !p.frozen);
          const activePkg = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;
          const classesLeft = activePkg?.classes_remaining ?? 0;
          const pkgSize = activePkg?.classes_total ?? 0;

          let seg = 'HEALTHY';
          if (pkgSize === 0 || classesLeft === 0) seg = 'COLD';
          else if (classesLeft <= 2) seg = 'HOT';
          else if (classesLeft <= 4) seg = 'WARM';

          counts[seg]++;
        });
        labels = Object.keys(counts);
        data = Object.values(counts);
        backgroundColors = ['#E11D48', '#F59E0B', '#6B7280', '#10B981'];
      } else if (diceBy === 'By Level') {
        const levelCounts: Record<string, number> = {};
        filteredStudents.forEach(s => {
          const lvl = s.level || 'Not assigned';
          levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
        });
        labels = Object.keys(levelCounts);
        data = Object.values(levelCounts);
        backgroundColors = '#286957';
      } else if (diceBy === 'By Rate band') {
        const counts = { '< 100 AED': 0, '100 - 150 AED': 0, '> 150 AED': 0 };
        filteredStudents.forEach(s => {
          const pkgs = packages.filter(p => p.student_id === s.id && !p.frozen);
          const activePkg = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;
          const rate = activePkg?.classes_total ? Math.round(1200 / (activePkg.classes_total || 12)) : 100;
          if (rate < 100) counts['< 100 AED']++;
          else if (rate <= 150) counts['100 - 150 AED']++;
          else counts['> 150 AED']++;
        });
        labels = Object.keys(counts);
        data = Object.values(counts);
        backgroundColors = ['#9DDDCB', '#286957', '#C4A249'];
      }

      const activeChartType = chartType === 'table' ? 'bar' : chartType === 'donut' ? 'doughnut' : chartType;

      chartInstances.current.students = new Chart(studentsChartRef.current, {
        type: activeChartType,
        data: {
          labels,
          datasets: [{
            label: diceBy,
            data,
            backgroundColor: backgroundColors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: activeChartType === 'doughnut' } },
          scales: activeChartType === 'doughnut' ? undefined : {
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
    if (loading) return;
    sections.forEach(sec => {
      if (sec.type !== 'chart') return;
      const canvasEl = document.getElementById(`chart-${sec.id}`) as HTMLCanvasElement | null;
      if (!canvasEl) return;

      if (chartInstances.current[sec.id]) {
        chartInstances.current[sec.id]?.destroy();
      }

      const secFilteredSts = getFilteredDataForSection(sec);
      const bayRev = invoices
        .filter(i => i.status === 'paid' && secFilteredSts.some(s => s.id === i.student_id) && students.find(s => s.id === i.student_id)?.centre_id === bayCentreId)
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const jltRev = invoices
        .filter(i => i.status === 'paid' && secFilteredSts.some(s => s.id === i.student_id) && students.find(s => s.id === i.student_id)?.centre_id === jltCentreId)
        .reduce((sum, i) => sum + Number(i.amount), 0);

      chartInstances.current[sec.id] = new Chart(canvasEl, {
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
  }, [activeTab, filterCentre, filterSegment, filterEngagement, filterLevel, diceBy, chartType, sections, globalFilterCentre, loading]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (filterCentre !== 'All' && s.centre_id !== (filterCentre === 'JLT' ? jltCentreId : bayCentreId)) return false;
      
      // Filter level
      if (filterLevel !== 'All') {
        if (filterLevel === 'Not assigned') {
          if (s.level && s.level !== 'Not assigned') return false;
        } else {
          if (s.level !== filterLevel) return false;
        }
      }
      
      // Filter segment
      if (filterSegment !== 'All') {
        const pkgs = packages.filter(p => p.student_id === s.id && !p.frozen);
        const activePkg = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;
        const classesLeft = activePkg?.classes_remaining ?? 0;
        const pkgSize = activePkg?.classes_total ?? 0;

        let seg = 'HEALTHY';
        if (pkgSize === 0 || classesLeft === 0) seg = 'COLD';
        else if (classesLeft <= 2) seg = 'HOT';
        else if (classesLeft <= 4) seg = 'WARM';

        if (seg !== filterSegment) return false;
      }
      
      // Filter engagement
      if (filterEngagement !== 'All') {
        const today = new Date();
        const daysSince = s.last_attended ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000) : 999;
        let eng = 'Dormant';
        if (daysSince === 999) eng = 'Never attended';
        else if (daysSince <= 14) eng = 'Engaged';
        else if (daysSince <= 30) eng = 'Slipping';
        else if (daysSince <= 60) eng = 'Cold';

        if (eng !== filterEngagement) return false;
      }
      return true;
    });
  }, [students, filterCentre, filterSegment, filterEngagement, filterLevel, packages]);

  const isFiltered = useMemo(() => {
    return filterCentre !== 'All' || filterSegment !== 'All' || filterEngagement !== 'All' || filterLevel !== 'All';
  }, [filterCentre, filterSegment, filterEngagement, filterLevel]);

  // Variables calculated from database
  const totalStudents = students.length;

  // KPIs depending on scope
  const scopeStudents = isFiltered ? filteredStudents : students;
  const scopeTotalStudents = scopeStudents.length;

  const activeStudentsCount = scopeStudents.filter(s => {
    if (!s.last_attended) return false;
    const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
    return diff >= 0 && diff <= 30 && s.status === 'active';
  }).length;

  const activePercent = scopeTotalStudents > 0 ? Math.round((activeStudentsCount / scopeTotalStudents) * 100) : 0;

  const totalRunrate = getRunRateForStudents(scopeStudents);
  const runRateK = (totalRunrate / 1000).toFixed(0);

  const totalUnbilled = scopeStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const unbilledK = (totalUnbilled / 1000).toFixed(0);
  const unbilledClasses = scopeStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const newEnrolmentsThisMonth = scopeStudents.filter(s => s.join_date && new Date(s.join_date).toISOString().slice(0, 7) === currentMonthStr).length;
  
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
  const newEnrolmentsPrevMonth = scopeStudents.filter(s => s.join_date && new Date(s.join_date).toISOString().slice(0, 7) === prevMonthStr).length;

  const totalCollected = invoices.filter(i => i.status === 'paid' && scopeStudents.some(s => s.id === i.student_id)).reduce((sum, i) => sum + Number(i.amount), 0);
  const totalCollectedM = (totalCollected / 1000000).toFixed(2);
  const totalCollectedK = (totalCollected / 1000).toFixed(0);

  const lifetimePaid = totalCollected;
  const totalClasses30d = attendance.filter(a => a.status === 'present' && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 30)).length;
  const totalClasses90d = attendance.filter(a => a.status === 'present' && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 90)).length;
  const avgRatePerClass = packages.length > 0
    ? Math.round(packages.reduce((sum, p) => sum + getPackagePrice(p) / (p.classes_total || 8), 0) / packages.length)
    : 100;
  const avgDaysSinceLastClass = (() => {
    const today = new Date();
    const studentsWithAtt = students.filter(s => s.last_attended);
    if (studentsWithAtt.length === 0) return 0;
    const totalDays = studentsWithAtt.reduce((sum, s) => {
      const diff = Math.floor((today.getTime() - new Date(s.last_attended!).getTime()) / 86400000);
      return sum + diff;
    }, 0);
    return Math.round(totalDays / studentsWithAtt.length);
  })();
  const avgLifetimePaid = students.length > 0 ? Math.round(lifetimePaid / students.length) : 0;
  const percentEngaged = (() => {
    if (students.length === 0) return 0;
    const today = new Date();
    const engagedCount = students.filter(s => {
      if (!s.last_attended) return false;
      const diff = Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000);
      return diff <= 14;
    }).length;
    return Math.round((engagedCount / students.length) * 100);
  })();

  // Bay Avenue metrics
  const bayStudents = students.filter(s => s.centre_id === bayCentreId);
  const activeBay = bayStudents.filter(s => {
    if (!s.last_attended) return false;
    const diff = Math.floor((new Date().getTime() - new Date(s.last_attended).getTime()) / 86400000);
    return diff >= 0 && diff <= 30 && s.status === 'active';
  }).length;
  const activeRateBay = bayStudents.length > 0 ? Math.round((activeBay / bayStudents.length) * 100) : 0;
  const bayClasses30d = attendance.filter(a => a.status === 'present' && bayStudents.some(s => s.id === a.student_id) && (Math.floor((new Date().getTime() - new Date(a.date).getTime()) / 86400000) <= 30)).length;
  const bayRunrate = getRunRateForStudents(bayStudents);
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
  const jltRunrate = getRunRateForStudents(jltStudents);
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
      <div className="flex justify-between items-start pb-4 print:hidden">
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
          {currentUser?.role === 'owner' && (
            activeTab === 'dashboard' ? (
              <button 
                onClick={() => setActiveTab('builder')}
                className="bg-[#C4A249] hover:bg-[#C4A249]/90 text-ink font-semibold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                + Build a custom report
              </button>
            ) : (
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="bg-forest hover:bg-forest/90 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Back to Dashboard
              </button>
            )
          )}
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Slice and Dice Controls bar */}
          <div className="bg-surface border border-line rounded-[14px] p-3 shadow-sm flex items-center justify-between gap-4 overflow-x-auto whitespace-nowrap text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[10px] mr-1">SLICE</span>
              <select value={filterCentre} onChange={e => setFilterCentre(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="All">All centres</option>
                <option value="Bay Avenue">Bay Avenue</option>
                <option value="JLT">JLT</option>
              </select>
              <select value={filterSegment} onChange={e => setFilterSegment(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="All">All segments</option>
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COLD">COLD</option>
                <option value="HEALTHY">HEALTHY</option>
              </select>
              <select value={filterEngagement} onChange={e => setFilterEngagement(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="All">All engagement</option>
                <option value="Engaged">Engaged</option>
                <option value="Slipping">Slipping</option>
                <option value="Dormant">Dormant</option>
                <option value="Cold">Cold</option>
                <option value="Never attended">Never attended</option>
              </select>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
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

            <div className="flex items-center gap-2">
              <span className="font-bold text-[#C4A249] uppercase tracking-wider text-[10px] mr-1">DICE</span>
              <select value={diceBy} onChange={e => setDiceBy(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1 text-xs text-ink outline-none">
                <option value="By Centre">By Centre</option>
                <option value="By Coach">By Coach</option>
                <option value="By Engagement">By Engagement</option>
                <option value="By Segment">By Segment</option>
                <option value="By Level">By Level</option>
                <option value="By Rate band">By Rate band</option>
              </select>

              {/* Chart Visual toggles */}
              <div className="flex border border-line rounded-lg overflow-hidden bg-white text-xs">
                {(['bar', 'line', 'donut', 'table'] as const).map(t => (
                  <button 
                    key={t} 
                    onClick={() => setChartType(t)}
                    className={`px-3 py-1 border-r border-line last:border-r-0 font-semibold capitalize transition-all cursor-pointer ${chartType === t ? 'bg-[#173F35] text-white' : 'text-muted-custom hover:bg-canvas'}`}
                  >
                    {t === 'donut' ? 'Donut' : t}
                  </button>
                ))}
              </div>

              <button onClick={() => { setFilterCentre('All'); setFilterSegment('All'); setFilterEngagement('All'); setFilterLevel('All'); }} className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer">Reset</button>
              <button onClick={exportDashboardExcel} className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer">↓ Excel</button>
              <button onClick={() => window.print()} className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer">PDF</button>
            </div>
          </div>

          {/* Yellow filter status alert bar */}
          {isFiltered && (
            <div className="bg-[#FDF6E2] border border-[#F5E0B3] rounded-[14px] p-4 shadow-sm flex justify-between items-center text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 font-bold text-sm">⚑</span>
                <span>
                  <b>Filtered view</b> — showing{' '}
                  <span className="font-semibold text-amber-950 capitalize">
                    {[
                      filterCentre !== 'All' && filterCentre,
                      filterSegment !== 'All' && filterSegment,
                      filterEngagement !== 'All' && filterEngagement,
                      filterLevel !== 'All' && filterLevel
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>{' '}
                  ({filteredStudents.length} of {students.length} students). These are <span className="font-bold">not</span> club-wide totals.
                </span>
              </div>
              <button 
                onClick={() => {
                  setFilterCentre('All');
                  setFilterSegment('All');
                  setFilterEngagement('All');
                  setFilterLevel('All');
                }}
                className="bg-white border border-[#E3C588] hover:bg-amber-50 text-amber-950 font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm text-xs"
              >
                Show whole club
              </button>
            </div>
          )}

          {/* Top KPIs row (Dark Green blocks with white text) */}
          <div className={`grid grid-cols-2 ${currentUser?.role === 'front_desk' ? 'lg:grid-cols-3' : 'lg:grid-cols-6'} gap-4`}>
            {[
              { 
                label: isFiltered ? 'STUDENTS IN SCOPE' : 'TOTAL STUDENTS', 
                value: `${scopeTotalStudents}`, 
                desc: isFiltered ? `${scopeTotalStudents} of ${totalStudents} on the book` : 'on the book' 
              },
              { 
                label: 'ACTIVE STUDENTS', 
                value: `${activeStudentsCount}`, 
                desc: `attended in last 30 days · ${activePercent}%` 
              },
              ...(currentUser?.role === 'front_desk' ? [] : [
                { 
                  label: 'RUN-RATE', 
                  value: `AED ${runRateK}K`, 
                  desc: isFiltered ? `per month · AED ${(totalRunrate * 12 / 1000).toFixed(0)}K annualised` : `per month · AED ${(totalRunrate * 12 / 1000000).toFixed(2)}M annualised`
                },
                { 
                  label: 'UNBILLED', 
                  value: `AED ${unbilledK}K`, 
                  desc: `${unbilledClasses} classes · ledger-verified` 
                }
              ]),
              { 
                label: 'ENROLMENTS', 
                value: `${newEnrolmentsThisMonth}`, 
                desc: isFiltered ? 'in this scope' : `MTD · ${newEnrolmentsPrevMonth} prev month` 
              },
              ...(currentUser?.role === 'front_desk' ? [] : [
                { 
                  label: 'LIFETIME COLLECTED', 
                  value: isFiltered ? `AED ${totalCollectedK}K` : `AED ${totalCollectedM}M`, 
                  desc: isFiltered ? 'in this scope' : 'zero external capital' 
                }
              ])
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
              <div className={`grid ${currentUser?.role === 'front_desk' ? 'grid-cols-2' : 'grid-cols-4'} gap-4 text-center`}>
                {currentUser?.role !== 'front_desk' && (
                  <>
                    <div><div className="font-bold text-sm text-[#286957]">AED ${(bayRunrate / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase">Run-rate /mo</div></div>
                    <div><div className="font-bold text-sm text-hot-custom">AED ${(bayUnbilled / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase">Unbilled</div></div>
                  </>
                )}
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
              <div className={`grid ${currentUser?.role === 'front_desk' ? 'grid-cols-2' : 'grid-cols-4'} gap-4 text-center`}>
                {currentUser?.role !== 'front_desk' && (
                  <>
                    <div><div className="font-bold text-sm text-[#286957]">AED ${(jltRunrate / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono">Run-rate /mo</div></div>
                    <div><div className="font-bold text-sm text-hot-custom">AED ${(jltUnbilled / 1000).toFixed(0)}K</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono">Unbilled</div></div>
                  </>
                )}
                <div><div className="font-bold text-sm text-ink">{newJltThisMonth}</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono font-mono">New MTD</div></div>
                <div><div className="font-bold text-sm text-ink">{jltCoaches}</div><div className="text-[8px] text-muted-custom uppercase font-semibold font-mono font-mono">Coaches</div></div>
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
              
              <div className={`grid ${currentUser?.role === 'front_desk' ? 'grid-cols-2' : 'grid-cols-4'} gap-4 text-center border-b border-line pb-2 text-xs`}>
                {currentUser?.role !== 'front_desk' && (
                  <>
                    <div><div className="font-bold text-ink">~32K</div><div className="text-[8px] text-muted-custom uppercase font-mono">Target /mo</div></div>
                    <div><div className="font-bold text-ink">0</div><div className="text-[8px] text-muted-custom uppercase font-mono">Unbilled</div></div>
                  </>
                )}
                <div><div className="font-bold text-ink">—</div><div className="text-[8px] text-muted-custom uppercase font-mono">New</div></div>
                <div><div className="font-bold text-ink">2-3</div><div className="text-[8px] text-muted-custom uppercase font-mono">Coaches</div></div>
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
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer">↓ Excel</button>
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer">PDF</button>
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
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer">↓ Excel</button>
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer">PDF</button>
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
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer">↓ Excel</button>
                  <button className="bg-white border border-line hover:bg-canvas text-ink text-[11px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer">PDF</button>
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
                      ...(currentUser?.role === 'front_desk' ? [] : [
                        { m: 'Run-rate / month', bay: `AED ${bayRunrate.toLocaleString()}`, jlt: `AED ${jltRunrate.toLocaleString()}`, tot: `AED ${(bayRunrate + jltRunrate).toLocaleString()}` },
                        { m: 'Unbilled', bay: `AED ${bayUnbilled.toLocaleString()}`, jlt: `AED ${jltUnbilled.toLocaleString()}`, tot: `AED ${(bayUnbilled + jltUnbilled).toLocaleString()}` }
                      ]),
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
        <div className="space-y-6">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #report-preview-document, #report-preview-document * {
                visibility: visible;
              }
              #report-preview-document {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white;
                color: black;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `}} />

          {/* Top description banner */}
          <div className="bg-canvas border border-line rounded-[14px] p-5 flex justify-between items-center print:hidden">
            <div className="space-y-1">
              <h2 className="text-lg font-bold font-display text-ink">Report Builder — build any report</h2>
              <p className="text-xs text-muted-custom">
                Compose any report from the live dataset: add sections, pick fields and measures, choose the diagram, filter each section independently — then export it. The exported JSON **is the specification** the production report engine must honour (FR-RPT: reports are data definitions, not code).
              </p>
            </div>
            <div>
              <select 
                value={globalFilterCentre}
                onChange={e => setGlobalFilterCentre(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none font-medium shadow-sm"
              >
                <option value="All centres">All centres</option>
                <option value="Bay Avenue">Bay Avenue</option>
                <option value="JLT">JLT</option>
              </select>
            </div>
          </div>

          {/* Menu / Top actions bar */}
          <div className="bg-surface border border-line rounded-[14px] p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between print:hidden">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-muted-custom uppercase tracking-wider text-[10px]">REPORT</span>
                <input 
                  type="text" 
                  value={reportTitle} 
                  onChange={e => setReportTitle(e.target.value)}
                  className="bg-white border border-line rounded-lg px-3 py-1.5 font-semibold text-ink w-64 outline-none shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 text-xs border-l border-line pl-4">
                <span className="font-bold text-muted-custom uppercase tracking-wider text-[10px]">TEMPLATE</span>
                <select 
                  onChange={e => applyTemplate(e.target.value)}
                  defaultValue="Start from..."
                  className="bg-white border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink outline-none shadow-sm"
                >
                  <option disabled value="Start from...">Start from...</option>
                  <option value="Key Executive Overview">Key Executive Overview</option>
                  <option value="Roster Breakdown">Roster Breakdown</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 border-l border-line pl-4 text-xs font-semibold text-muted-custom">
                <span className="uppercase text-[10px] tracking-wider mr-1">ADD SECTION</span>
                <button onClick={() => addSection('kpis')} className="bg-canvas border border-line hover:bg-canvas/80 text-ink px-2.5 py-1.5 rounded-lg text-xs cursor-pointer">+ KPIs</button>
                <button onClick={() => addSection('chart')} className="bg-canvas border border-line hover:bg-canvas/80 text-ink px-2.5 py-1.5 rounded-lg text-xs cursor-pointer">+ Chart</button>
                <button onClick={() => addSection('table')} className="bg-canvas border border-line hover:bg-canvas/80 text-ink px-2.5 py-1.5 rounded-lg text-xs cursor-pointer">+ Table</button>
                <button onClick={() => addSection('text')} className="bg-canvas border border-line hover:bg-canvas/80 text-ink px-2.5 py-1.5 rounded-lg text-xs cursor-pointer">+ Text</button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button 
                onClick={exportReportJSON}
                className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3.5 py-1.5 rounded-lg font-medium shadow-sm cursor-pointer"
              >
                ↓ Definition (JSON)
              </button>
              
              <input 
                type="file" 
                ref={hiddenFileInputRef}
                onChange={handleImportJSON}
                accept=".json"
                className="hidden"
              />
              <button 
                onClick={() => hiddenFileInputRef.current?.click()}
                className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3.5 py-1.5 rounded-lg font-medium shadow-sm cursor-pointer"
              >
                ↑ Import
              </button>
              
              <button 
                onClick={exportReportToPDF}
                className="bg-white border border-line hover:bg-canvas text-ink text-xs px-3.5 py-1.5 rounded-lg font-medium shadow-sm cursor-pointer"
              >
                PDF
              </button>
            </div>
          </div>

          {/* Main workspace layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
            
            {/* Left Form side options (Sidebar) */}
            <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm space-y-6 print:hidden">
              <div>
                <h3 className="font-bold text-sm text-ink mb-1">Sections</h3>
                <p className="text-[10px] text-muted-custom">Click a section to edit. {sections.length} in this report.</p>
              </div>

              <div className="space-y-2">
                {sections.map((sec, idx) => (
                  <button 
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full text-left p-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${activeSectionId === sec.id ? 'border-[#C4A249] bg-[#C4A249]/5 text-ink' : 'border-line text-muted-custom hover:bg-canvas'}`}
                  >
                    {sec.type === 'kpis' ? '♦' : sec.type === 'chart' ? '⚙' : sec.type === 'table' ? '▦' : '✎'} {idx + 1}. {sec.title}
                  </button>
                ))}
              </div>

              {activeSection && (
                <div className="space-y-4 pt-4 border-t border-line">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-custom uppercase">Section Title</label>
                    <input 
                      type="text" 
                      value={activeSection.title} 
                      onChange={e => updateActiveSection('title', e.target.value)}
                      className="bg-white border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink outline-none"
                    />
                  </div>

                  {activeSection.type === 'kpis' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted-custom uppercase">Measures (KPI Cards)</label>
                      <div className="flex flex-wrap gap-1">
                        {[
                          'Students', 'Run-rate AED / month', 'Unbilled value — ledger (AED)',
                          'Lifetime paid (AED)', 'Unbilled classes — ledger', 'Student-classes 30d',
                          'Student-classes 90d', 'Avg rate / class (AED)', 'Avg days since last class',
                          'Avg lifetime paid (AED)', '% Engaged'
                        ].map(m => {
                          const isPicked = activeSection.measures.includes(m);
                          return (
                            <button
                              key={m}
                              onClick={() => handleMeasureToggle(m)}
                              className={`text-[9px] px-2 py-1 rounded-full border transition-all cursor-pointer ${isPicked ? 'bg-forest text-white border-forest' : 'bg-white border-line text-muted-custom hover:bg-canvas'}`}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeSection.type === 'text' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted-custom uppercase">Text Content</label>
                      <textarea 
                        rows={6}
                        value={activeSection.text || ''} 
                        onChange={e => updateActiveSection('text', e.target.value)}
                        className="bg-white border border-line rounded-lg p-2.5 text-xs text-ink outline-none resize-none font-mono"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 pt-4 border-t border-line">
                    <label className="text-[10px] font-bold text-muted-custom uppercase">Filters — This section only</label>
                    
                    <select 
                      value={activeSection.filterCentre}
                      onChange={e => updateActiveSection('filterCentre', e.target.value)}
                      className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
                    >
                      <option>All centres</option>
                      <option>Bay Avenue</option>
                      <option>JLT</option>
                    </select>

                    <select 
                      value={activeSection.filterBucket}
                      onChange={e => updateActiveSection('filterBucket', e.target.value)}
                      className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
                    >
                      <option>All buckets</option>
                      <option>HOT</option>
                      <option>HEALTHY</option>
                    </select>

                    <select 
                      value={activeSection.filterEngagement}
                      onChange={e => updateActiveSection('filterEngagement', e.target.value)}
                      className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
                    >
                      <option>All engagement</option>
                      <option>Engaged</option>
                      <option>Slipping</option>
                      <option>Dormant</option>
                    </select>

                    <select 
                      value={activeSection.filterLevel}
                      onChange={e => updateActiveSection('filterLevel', e.target.value)}
                      className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
                    >
                      <option>All levels</option>
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                      <option>Pro-Track</option>
                    </select>

                    <select 
                      value={activeSection.filterCoach}
                      onChange={e => updateActiveSection('filterCoach', e.target.value)}
                      className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
                    >
                      <option>All coaches</option>
                      {coaches.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Right Live Report preview */}
            <div id="report-preview-document" className="space-y-6 bg-[#FDFBF7] p-6 rounded-[14px] border border-line shadow-sm min-h-[600px]">
              
              {/* Document Header banner */}
              <div className="p-6 bg-fd text-white rounded-lg shadow-sm">
                <div className="text-[10px] font-bold tracking-widest text-[#9DDDCB] uppercase font-display">MASTER MOVES · CUSTOM REPORT</div>
                <h2 className="text-2xl font-bold font-display mt-1 text-white">{reportTitle}</h2>
                <p className="text-xs text-[#CFE3DC] mt-1">
                  Computed live from the platform dataset · {totalStudents} students · ledger-basis financials
                </p>
              </div>

              {/* Loop over sections */}
              <div className="space-y-6">
                {sections.map((sec, idx) => {
                  const secFilteredSts = getFilteredDataForSection(sec);
                  const secMetrics = getSectionMetrics(secFilteredSts);

                  return (
                    <div 
                      key={sec.id} 
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`border rounded-[14px] p-5 space-y-4 bg-white shadow-sm transition-all cursor-pointer ${activeSectionId === sec.id ? 'border-[#C4A249] ring-2 ring-[#C4A249]/20' : 'border-line hover:border-line/80'}`}
                    >
                      {/* Section toolbar */}
                      <div className="flex justify-between items-center border-b border-line pb-2">
                        <div>
                          <h4 className="font-bold text-sm text-[#C4A249] flex items-center gap-1.5">
                            <span>{sec.type === 'kpis' ? '♦' : sec.type === 'chart' ? '⚙' : sec.type === 'table' ? '▦' : '✎'}</span>
                            <span>{idx + 1}. {sec.title}</span>
                          </h4>
                          <span className="text-[10px] text-muted-custom">
                            Scope: {secFilteredSts.length} students ({sec.filterCentre}, {sec.filterLevel}, {sec.filterCoach})
                          </span>
                        </div>
                        
                        <div className="flex gap-1 text-[10px] text-muted-custom print:hidden">
                          <button onClick={(e) => { e.stopPropagation(); moveSectionUp(idx); }} className="border border-line rounded px-2 py-1 bg-white hover:bg-canvas text-xs cursor-pointer font-bold" title="Move Up">↑</button>
                          <button onClick={(e) => { e.stopPropagation(); moveSectionDown(idx); }} className="border border-line rounded px-2 py-1 bg-white hover:bg-canvas text-xs cursor-pointer font-bold" title="Move Down">↓</button>
                          <button onClick={(e) => { e.stopPropagation(); duplicateSection(sec); }} className="border border-line rounded px-2 py-1 bg-white hover:bg-canvas text-xs cursor-pointer" title="Duplicate">❐ Duplicate</button>
                          {sec.type !== 'text' && (
                            <button onClick={(e) => { e.stopPropagation(); exportSectionToExcel(sec); }} className="border border-line rounded px-2 py-1 bg-white hover:bg-canvas text-xs cursor-pointer font-semibold text-forest" title="Export Excel">↓ Excel</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); deleteSection(sec.id); }} className="border border-line rounded px-2 py-1 bg-white hover:bg-red-50 hover:text-hot-custom text-xs cursor-pointer" title="Delete">✕</button>
                        </div>
                      </div>

                      {/* Render based on Section type */}
                      {sec.type === 'kpis' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {sec.measures.map(m => {
                            let val: any = '—';
                            let desc = `${secFilteredSts.length} students in scope`;

                            if (m === 'Students') {
                              val = secMetrics.totalStudents;
                            } else if (m === 'Run-rate AED / month') {
                              val = `AED ${(secMetrics.runrate / 1000).toFixed(0)}K`;
                              desc = `AED ${(secMetrics.runrate * 12 / 1000000).toFixed(2)}M annualised`;
                            } else if (m === 'Unbilled value — ledger (AED)') {
                              val = `AED ${(secMetrics.unbilledValue / 1000).toFixed(0)}K`;
                            } else if (m === 'Lifetime paid (AED)') {
                              val = `AED ${(secMetrics.lifetimePaid / 1000).toFixed(0)}K`;
                            } else if (m === 'Unbilled classes — ledger') {
                              val = secMetrics.unbilledClasses;
                            } else if (m === 'Student-classes 30d') {
                              val = secMetrics.classes30d;
                            } else if (m === 'Student-classes 90d') {
                              val = secMetrics.classes90d;
                            } else if (m === 'Avg rate / class (AED)') {
                              val = `AED ${secMetrics.avgRatePerClass}`;
                            } else if (m === 'Avg days since last class') {
                              val = `${secMetrics.avgDaysSinceLastClass} days`;
                            } else if (m === 'Avg lifetime paid (AED)') {
                              val = `AED ${secMetrics.avgLifetimePaid.toLocaleString()}`;
                            } else if (m === '% Engaged') {
                              val = `${secMetrics.percentEngaged}%`;
                            }

                            return (
                              <div key={m} className="bg-canvas/30 border border-line rounded-lg p-4 shadow-sm space-y-1">
                                <div className="text-[9px] font-bold text-muted-custom uppercase tracking-wider">{m}</div>
                                <div className="text-2xl font-bold font-display text-ink mt-0.5">{val}</div>
                                <div className="text-[10px] text-muted-custom mt-0.5 leading-tight">{desc}</div>
                              </div>
                            );
                          })}

                          {sec.measures.length === 0 && (
                            <div className="col-span-3 text-center py-6 text-xs text-muted-custom italic">
                              No measures selected. Add measures from the left sidebar checklist.
                            </div>
                          )}
                        </div>
                      )}

                      {sec.type === 'chart' && (
                        <div className="space-y-4">
                          <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs leading-normal">
                            2 groups by Centre. Top: <b className="text-forest">Bay Avenue at AED {(bayRunrate / 1000).toFixed(0)}K</b> ({totalRunrate > 0 ? Math.round((bayRunrate / totalRunrate) * 100) : 0}% of AED {runRateK}K). Scope: {secFilteredSts.length} students.
                          </div>
                          <div className="h-48 relative">
                            <canvas id={`chart-${sec.id}`}></canvas>
                          </div>
                        </div>
                      )}

                      {sec.type === 'table' && (
                        <div className="overflow-x-auto border border-line rounded-lg">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="bg-canvas border-b border-line text-muted-custom font-semibold">
                                <th className="py-2 px-3">#</th>
                                <th className="py-2 px-3">Name</th>
                                <th className="py-2 px-3">Level</th>
                                <th className="py-2 px-3">Centre</th>
                                <th className="py-2 px-3">Coach</th>
                                <th className="py-2 px-3 text-right">Unbilled (AED)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {secFilteredSts.slice(0, 10).map((s, idx) => {
                                const coachName = coaches.find(c => c.id === s.coach_id)?.name || 'Unassigned';
                                const centreName = centres.find(c => c.id === s.centre_id)?.name || '—';
                                return (
                                  <tr key={s.id} className="border-b border-line hover:bg-canvas/30 transition-all">
                                    <td className="py-2 px-3 text-muted-custom">{idx + 1}</td>
                                    <td className="py-2 px-3 font-semibold text-ink">{s.name}</td>
                                    <td className="py-2 px-3 text-ink">{s.level}</td>
                                    <td className="py-2 px-3 text-ink">{centreName}</td>
                                    <td className="py-2 px-3 text-ink">{coachName}</td>
                                    <td className="py-2 px-3 text-right font-mono font-semibold text-ink">{(s.flags as any)?.unpaid_value || 0}</td>
                                  </tr>
                                );
                              })}
                              {secFilteredSts.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="text-center py-6 text-xs text-muted-custom italic">
                                    No students matching the filter scope.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          {secFilteredSts.length > 10 && (
                            <div className="text-[10px] text-center py-1.5 text-muted-custom bg-canvas/30 border-t border-line">
                              Showing top 10 of {secFilteredSts.length} students. Export to Excel/CSV to download the full roster.
                            </div>
                          )}
                        </div>
                      )}

                      {sec.type === 'text' && (
                        <div className="text-xs text-ink whitespace-pre-wrap leading-relaxed border border-line bg-canvas/20 rounded-lg p-3 min-h-[60px]">
                          {sec.text || "No content written yet. Click this section and add text in the left sidebar."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom footer text */}
              <div className="text-[10px] text-muted-custom border-t border-line pt-4 flex justify-between items-center">
                <span>✦ Unbilled figures in this builder come from the package ledger (auditable basis). Legacy Overdue_* columns are excluded by design — they were retracted.</span>
                <span>Generated: {new Date().toISOString().slice(0, 10)} MTD</span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
