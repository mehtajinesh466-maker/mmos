"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ReportsCentreProps {
  currentUser?: any;
}

export const ReportsCentre: React.FC<ReportsCentreProps> = ({ currentUser }) => {
  const router = useRouter();
  const [selectedCentre, setSelectedCentre] = useState<string>('All');

  const families = [
    {
      title: 'Finance',
      count: '7 reports',
      icon: '👑',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      badgeLabel: 'FINANCE',
      reports: [
        { id: 'revenue-summary', title: 'Revenue Summary', desc: 'Centre · Level · Segment · Engagement · Month · Rate band' },
        { id: 'unbilled-leak', title: 'Unbilled / Leak', desc: 'Centre · Engagement · Segment · Level · Rate band' },
        { id: 'data-reconciliation', title: 'Data Reconciliation', desc: 'Centre · Segment · Engagement' },
        { id: 'collection-list', title: 'Collection List', desc: 'Centre · Engagement · Segment · Level' },
        { id: 'membership-economics', title: 'Membership Tier Economics', desc: 'Centre · Coach · Engagement · Level' },
        { id: 'lifetime-value', title: 'Lifetime Value', desc: 'Centre · Segment · Engagement · Level · Rate band' },
        { id: 'rate-card', title: 'Rate Card Analysis', desc: 'Rate band · Centre · Level · Segment' }
      ]
    },
    {
      title: 'Operations',
      count: '6 reports',
      icon: '🔔',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      badgeLabel: 'OPERATIONS',
      reports: [
        { id: 'attendance-summary', title: 'Attendance Summary', desc: 'Centre · Engagement · Level · Segment' },
        { id: 'engagement-report', title: 'Engagement Report', desc: 'Engagement · Centre · Level · Segment' },
        { id: 'cohort-retention', title: 'Cohort Retention', desc: 'Centre' },
        { id: 'slow-risk', title: 'Slow / At-Risk', desc: 'Centre · Engagement · Level · Segment' },
        { id: 'package-expiry', title: 'Package Expiry', desc: 'Centre · Level · Segment' },
        { id: 'unpaid-attendance', title: 'Unpaid Attendance', desc: 'Centre · Level · Engagement' }
      ]
    },
    {
      title: 'Student',
      count: '4 reports',
      icon: '🎓',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      badgeLabel: 'STUDENT',
      reports: [
        { id: 'student-class-usage', title: 'Student Class Usage', desc: 'On-demand class usage, remaining balance & 20% renewal triggers' },
        { id: 'package-utilisation', title: 'Package Utilisation', desc: 'Detailed per-student package burn down', path: '/package-report' },
        { id: 'progress-report', title: 'Progress Report', desc: 'Student skill progress and mastery logs', path: '/progress-report' },
        { id: 'student-profile', title: 'Student Profile', desc: 'Centre · Engagement · Segment · Level · Rate band', path: '/student-dashboard' }
      ]
    },
    {
      title: 'Strategy',
      count: '4 reports',
      icon: '👑',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      badgeLabel: 'STRATEGY',
      reports: [
        { id: 'centre-perf', title: 'Centre Performance', desc: '—' },
        { id: 'growth-trajectory', title: 'Growth Trajectory', desc: '—' },
        { id: 'new-centre-model', title: 'New Centre Model', desc: '—' },
        { id: 'board-investor-pack', title: 'Board / Investor Pack', desc: '—' }
      ]
    },
    {
      title: 'Coaching — structure only',
      count: '4 reports',
      icon: '👥',
      badgeColor: 'bg-yellow-100/60 text-yellow-800 border-yellow-200/80',
      badgeLabel: 'COACHING — STRUCTURE ONLY',
      reports: [
        { id: 'coach-utilisation', title: 'Coach Utilisation', desc: 'Coach · Centre' },
        { id: 'load-capacity', title: 'Load & Capacity', desc: 'Coach · Centre' },
        { id: 'coach-retention', title: 'Coach Retention', desc: 'Coach · Centre' },
        { id: 'revenue-contribution', title: 'Revenue Contribution', desc: 'Coach · Centre' }
      ]
    }
  ];

  const handleReportClick = (report: any) => {
    if (report.path) {
      router.push(report.path);
    } else {
      router.push(`/reports/${report.id}`);
    }
  };

  const allowedFamilies = families.map(f => {
    if (currentUser?.role === 'front_desk') {
      if (f.title === 'Finance' || f.title === 'Strategy') return null;
      if (f.title === 'Coaching — structure only') {
        return {
          ...f,
          reports: f.reports.filter(r => r.id !== 'revenue-contribution'),
          count: `${f.reports.filter(r => r.id !== 'revenue-contribution').length} reports`
        };
      }
    }
    return f;
  }).filter(Boolean) as typeof families;

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6 text-ink">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">REPORTS</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Reports Centre</h1>
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
        Five report families. Pick one, then slice it by centre, coach, segment, engagement or level — and dice it by any grouping.
      </p>

      {/* Families list */}
      <div className="space-y-6">
        {allowedFamilies.map((family, idx) => (
          <div key={idx} className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4">
            
            <div className="flex items-center gap-2">
              <span className="text-sm">{family.icon}</span>
              <h3 className="font-bold text-sm text-ink">{family.title}</h3>
              <span className="text-[10px] text-muted-custom font-medium">({family.count})</span>
            </div>

            {/* Reports list in family */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {family.reports.map(report => (
                <div 
                  key={report.id}
                  onClick={() => handleReportClick(report)}
                  className="bg-surface hover:bg-canvas/10 border border-line hover:border-brass rounded-xl p-4 cursor-pointer transition-all space-y-2 select-none shadow-sm"
                >
                  <h4 className="font-bold text-xs text-ink font-display">{report.title}</h4>
                  <p className="text-[10px] text-muted-custom min-h-[16px]">{report.desc}</p>
                  
                  <span className={`inline-block text-[8px] font-extrabold tracking-wider px-2 py-0.5 rounded-full border ${family.badgeColor}`}>
                    {family.badgeLabel}
                  </span>
                </div>
              ))}
            </div>

          </div>
        ))}
      </div>

      {/* Explanatory footer banner */}
      <div className="p-4 rounded-[12px] bg-emerald-50/20 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/90 flex gap-2">
        <span>
          <b className="text-emerald-800 block mb-1">Every report shares the same slice & dice bar.</b>
          Filter by centre, coach, segment, engagement or level; group by any dimension; switch between bar, line, donut or table; export to Excel or PDF. Reports can also be scheduled — e.g. Package Expiry to each centre's front office every Monday.
        </span>
      </div>

    </div>
  );
};
export default ReportsCentre;
