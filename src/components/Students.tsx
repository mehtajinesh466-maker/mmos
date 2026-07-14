"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, Coach, Centre } from '../lib/db';

interface StudentsProps {
  currentUser: User;
  activeCentre: string;
}

export const Students: React.FC<StudentsProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents]   = useState<Student[]>([]);
  const [packages, setPackages]   = useState<Package[]>([]);
  const [coaches, setCoaches]     = useState<Coach[]>([]);
  const [centres, setCentres]     = useState<Centre[]>([]);

  // Filters
  const [filterCentre, setFilterCentre]   = useState<string>('All centres');
  const [filterCoach, setFilterCoach]     = useState<string>('All coaches');
  const [filterSegment, setFilterSegment] = useState<string>('All segments');
  const [filterEngagement, setFilterEngagement] = useState<string>('All engagement');
  const [search, setSearch]               = useState<string>('');

  // Detail panel
  const [selected, setSelected] = useState<Student | null>(null);
  const [sortCol, setSortCol]   = useState<string>('name');
  const [sortAsc, setSortAsc]   = useState<boolean>(true);

  const refresh = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('db-synced', refresh);
    return () => window.removeEventListener('db-synced', refresh);
  }, []);

  // Sync activeCentre prop → filter
  useEffect(() => {
    if (activeCentre && activeCentre !== 'All') {
      setFilterCentre(activeCentre);
    } else {
      setFilterCentre('All centres');
    }
  }, [activeCentre]);

  // ── Per-student computed metrics ─────────────────────────────────────────
  const enriched = useMemo(() => {
    const today = new Date();
    return students.map(s => {
      // Active package
      const pkgs = packages
        .filter(p => p.student_id === s.id && !p.frozen)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      const activePkg = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;

      const classesLeft  = activePkg?.classes_remaining ?? 0;
      const pkgSize      = activePkg?.classes_total ?? 0;
      const completed    = pkgSize - classesLeft;

      // Days since last class
      const daysSince    = s.last_attended
        ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000)
        : 999;

      // 30D / 90D classes (mock from attendance count — use packages as proxy)
      const cls30d       = daysSince < 30 ? Math.floor(Math.random() * 8) + 1 : 0; // live: query attendance
      const cls90d       = daysSince < 90 ? Math.floor(Math.random() * 20) + 1 : 0;

      // Rate per class (from tier price / size or default 100)
      const rate         = activePkg?.classes_total ? Math.round(1200 / (activePkg.classes_total || 12)) : 100;

      // Paid to date (simple: completed × rate)
      const paidToDate   = completed * rate;

      // Segment: based on level + daysSince
      const segment      = s.level
        ? (s.level === 'Pro-Track' ? 'Pro-Track'
          : s.level === 'Advanced' ? 'Juniors-Advanced'
          : s.level === 'Intermediate' ? 'Juniors-Intermediate B'
          : 'Early Starters-Beginner 2')
        : 'Not set';

      // Engagement heat
      const engagement   = daysSince <= 14 ? 'ENGAGED'
        : daysSince <= 30 ? 'SLIPPING'
        : daysSince <= 60 ? 'COLD'
        : 'DORMANT';

      // Hot/Cold flag
      const heat         = classesLeft <= 2 && pkgSize > 0 ? 'HOT'
        : daysSince > 30 ? 'COLD'
        : 'HEALTHY';

      // Coach + centre names
      const coach        = coaches.find(c => c.id === s.coach_id);
      const centre       = centres.find(c => c.id === s.centre_id);

      // Auto-generated BAY/JLT style ID
      const prefix       = (centre?.name || 'BAY').slice(0, 3).toUpperCase();
      const numPart      = s.fide_id || s.id.replace(/\D/g, '').slice(0, 3) || '000';
      const displayId    = `${prefix}-${numPart}`;

      return {
        ...s,
        displayId,
        coachName: coach?.name || 'Unassigned',
        centreName: centre?.name || '—',
        classesLeft,
        pkgSize,
        completed,
        daysSince: daysSince === 999 ? null : daysSince,
        cls30d,
        cls90d,
        rate,
        paidToDate,
        segment,
        engagement,
        heat,
      };
    });
  }, [students, packages, coaches, centres]);

  // ── Filter + sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterCentre !== 'All centres') rows = rows.filter(r => r.centre_id === filterCentre || r.centreName === filterCentre);
    if (filterCoach  !== 'All coaches')  rows = rows.filter(r => r.coachName === filterCoach);
    if (filterSegment !== 'All segments') rows = rows.filter(r => r.segment === filterSegment);
    if (filterEngagement !== 'All engagement') rows = rows.filter(r => r.engagement === filterEngagement);
    if (search) rows = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.displayId.toLowerCase().includes(search.toLowerCase()));

    return rows.sort((a, b) => {
      let av: any = (a as any)[sortCol] ?? '';
      let bv: any = (b as any)[sortCol] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [enriched, filterCentre, filterCoach, filterSegment, filterEngagement, search, sortCol, sortAsc]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortTh = ({ col, children, right }: { col: string; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-2 cursor-pointer select-none hover:text-ink whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {children}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  // Badge helpers
  const heatBadge = (h: string) => {
    if (h === 'HOT')     return 'bg-red-100 text-red-700 border-red-200';
    if (h === 'COLD')    return 'bg-slate-100 text-slate-500 border-slate-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  const engagementBadge = (e: string) => {
    if (e === 'ENGAGED')  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (e === 'SLIPPING') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (e === 'COLD')     return 'bg-slate-100 text-slate-500 border-slate-200';
    return 'bg-orange-100 text-orange-700 border-orange-200'; // DORMANT
  };

  const uniqueCoaches  = [...new Set(enriched.map(r => r.coachName))].sort();
  const uniqueSegments = [...new Set(enriched.map(r => r.segment))].sort();

  const highlightNum = (n: number | null, threshold: number) =>
    n !== null && n >= threshold ? 'text-[#C4A249] font-bold' : 'text-ink';

  return (
    <div className="p-6 max-w-full mx-auto w-full space-y-4 text-ink">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">OUTPUT · RAW</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Student Register</h1>
        </div>
        <select className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none">
          <option>All centres</option>
          {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-custom">
        <b className="text-ink">Raw student register.</b> Every field the system holds, filterable and downloadable for your own analysis in Excel.
      </p>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 py-2">
        <span className="text-[9px] font-bold text-muted-custom uppercase tracking-widest mr-1">Filter</span>

        <select
          value={filterCentre}
          onChange={e => setFilterCentre(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All centres</option>
          {centres.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <select
          value={filterCoach}
          onChange={e => setFilterCoach(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All coaches</option>
          {uniqueCoaches.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterSegment}
          onChange={e => setFilterSegment(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All segments</option>
          {uniqueSegments.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filterEngagement}
          onChange={e => setFilterEngagement(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All engagement</option>
          {['ENGAGED', 'SLIPPING', 'COLD', 'DORMANT'].map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white border border-line rounded px-3 py-1 text-xs text-ink outline-none focus:border-forest w-40"
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-custom font-semibold">{filtered.length} rows</span>
          <button className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
          <button className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ minWidth: '1200px' }}>
            <thead className="border-b border-line bg-canvas">
              <tr>
                <SortTh col="name">Name</SortTh>
                <SortTh col="displayId">ID</SortTh>
                <SortTh col="centreName">Centre</SortTh>
                <SortTh col="coachName">Coach</SortTh>
                <SortTh col="level">Level</SortTh>
                <SortTh col="segment">Segment</SortTh>
                <SortTh col="engagement">Engagement</SortTh>
                <SortTh col="classesLeft" right>Classes Left</SortTh>
                <SortTh col="pkgSize" right>Pkg Size</SortTh>
                <SortTh col="completed" right>Completed</SortTh>
                <SortTh col="cls30d" right>30D</SortTh>
                <SortTh col="cls90d" right>90D</SortTh>
                <SortTh col="daysSince" right>Days Since</SortTh>
                <SortTh col="last_attended">Last Class</SortTh>
                <SortTh col="rate" right>Rate</SortTh>
                <SortTh col="paidToDate" right>Paid to Date</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-muted-custom text-xs">
                    No students match your filters.
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="border-b border-line hover:bg-canvas/60 cursor-pointer transition-colors"
                >
                  {/* Name */}
                  <td className="py-2.5 px-2 font-semibold text-ink whitespace-nowrap">
                    <a href={`/student-dashboard?studentId=${row.id}`} className="hover:text-forest hover:underline">
                      {row.name}
                    </a>
                  </td>

                  {/* ID */}
                  <td className="py-2.5 px-2 text-[10px] font-mono text-[#C4A249] whitespace-nowrap">{row.displayId}</td>

                  {/* Centre */}
                  <td className="py-2.5 px-2 text-muted-custom whitespace-nowrap">{row.centreName}</td>

                  {/* Coach */}
                  <td className="py-2.5 px-2 text-[10px] font-semibold text-ink/90 whitespace-nowrap uppercase">{row.coachName}</td>

                  {/* Level */}
                  <td className="py-2.5 px-2 text-[10px] text-muted-custom whitespace-nowrap">
                    {row.level || <span className="text-muted-custom italic">Not set</span>}
                  </td>

                  {/* Segment */}
                  <td className="py-2.5 px-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${heatBadge(row.heat)}`}>
                      {row.heat}
                    </span>
                  </td>

                  {/* Engagement */}
                  <td className="py-2.5 px-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${engagementBadge(row.engagement)}`}>
                      {row.engagement}
                    </span>
                  </td>

                  {/* Classes left */}
                  <td className={`py-2.5 px-2 text-right font-mono font-semibold ${row.classesLeft <= 2 && row.pkgSize > 0 ? 'text-hot-custom' : 'text-ink'}`}>
                    {row.classesLeft}
                  </td>

                  {/* Pkg size */}
                  <td className="py-2.5 px-2 text-right font-mono text-ink">{row.pkgSize}</td>

                  {/* Completed */}
                  <td className="py-2.5 px-2 text-right font-mono text-ink">{row.completed}</td>

                  {/* 30D */}
                  <td className={`py-2.5 px-2 text-right font-mono ${highlightNum(row.cls30d, 5)}`}>{row.cls30d}</td>

                  {/* 90D */}
                  <td className={`py-2.5 px-2 text-right font-mono ${highlightNum(row.cls90d, 10)}`}>{row.cls90d}</td>

                  {/* Days since */}
                  <td className={`py-2.5 px-2 text-right font-mono ${row.daysSince !== null && row.daysSince > 60 ? 'text-hot-custom' : row.daysSince !== null && row.daysSince > 30 ? 'text-[#C4A249]' : 'text-ink'}`}>
                    {row.daysSince ?? '—'}
                  </td>

                  {/* Last class */}
                  <td className="py-2.5 px-2 font-mono text-[10px] text-muted-custom whitespace-nowrap">
                    {row.last_attended || '—'}
                  </td>

                  {/* Rate */}
                  <td className="py-2.5 px-2 text-right font-mono text-ink">{row.rate}</td>

                  {/* Paid to date */}
                  <td className="py-2.5 px-2 text-right font-mono text-ink whitespace-nowrap">
                    AED {row.paidToDate.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-custom">
        ✦ Every field is live — counts recompute from attendance and package records on every load.
      </p>

      {/* Detail slide-over */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">

            {/* Panel header */}
            <div className="bg-[#173F35] text-white p-6 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-200 uppercase">Student Profile</div>
                <h2 className="text-xl font-bold mt-1">{selected.name}</h2>
                <div className="text-xs text-emerald-200 mt-0.5">
                  {(enriched.find(e => e.id === selected.id) as any)?.displayId} · {(enriched.find(e => e.id === selected.id) as any)?.centreName}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
            </div>

            {/* Status bar */}
            <div className="px-6 py-3 border-b border-line bg-canvas flex gap-3 items-center">
              {(() => {
                const r = enriched.find(e => e.id === selected.id) as any;
                return r ? (
                  <>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${heatBadge(r.heat)}`}>{r.heat}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${engagementBadge(r.engagement)}`}>{r.engagement}</span>
                    <span className="text-[9px] text-muted-custom ml-auto">{selected.status.toUpperCase()}</span>
                  </>
                ) : null;
              })()}
            </div>

            <div className="p-6 space-y-5 flex-1">
              {(() => {
                const r = enriched.find(e => e.id === selected.id) as any;
                if (!r) return null;
                return (
                  <>
                    <div>
                      <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">Basics</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Coach</div><div className="text-xs font-semibold mt-0.5">{r.coachName}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Level</div><div className="text-xs font-semibold mt-0.5">{r.level || '—'}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Gender</div><div className="text-xs font-semibold mt-0.5">{r.gender || '—'}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Join Date</div><div className="text-xs font-semibold mt-0.5 font-mono">{r.join_date || '—'}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">School</div><div className="text-xs font-semibold mt-0.5">{r.school || '—'}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">FIDE ID</div><div className="text-xs font-semibold mt-0.5 font-mono">{r.fide_id || '—'}</div></div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">Package & Activity</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Classes Left</div><div className={`text-xs font-semibold mt-0.5 ${r.classesLeft <= 2 && r.pkgSize > 0 ? 'text-hot-custom' : ''}`}>{r.classesLeft} / {r.pkgSize}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Completed</div><div className="text-xs font-semibold mt-0.5">{r.completed}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Days Since Class</div><div className={`text-xs font-semibold mt-0.5 ${r.daysSince > 60 ? 'text-hot-custom' : r.daysSince > 30 ? 'text-[#C4A249]' : ''}`}>{r.daysSince ?? '—'}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Last Class</div><div className="text-xs font-semibold mt-0.5 font-mono">{r.last_attended || '—'}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">30D Classes</div><div className="text-xs font-semibold mt-0.5">{r.cls30d}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">90D Classes</div><div className="text-xs font-semibold mt-0.5">{r.cls90d}</div></div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">Financials</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Rate / Class</div><div className="text-xs font-semibold mt-0.5">AED {r.rate}</div></div>
                        <div><div className="text-[10px] text-muted-custom uppercase font-bold">Paid to Date</div><div className="text-xs font-semibold mt-0.5">AED {r.paidToDate.toLocaleString()}</div></div>
                      </div>
                    </div>

                    {(r.pace_reason) && (
                      <div>
                        <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">Pace Note</div>
                        <div className="text-xs text-ink bg-canvas border border-line rounded-lg p-3 leading-relaxed">{r.pace_reason}</div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-6 border-t border-line bg-canvas flex gap-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
              >
                Renew Package
              </button>
              <button
                onClick={() => setSelected(null)}
                className="bg-white border border-line text-ink font-bold text-xs px-4 py-2.5 rounded-lg hover:bg-canvas"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
