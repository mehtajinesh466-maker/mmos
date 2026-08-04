"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, Coach, Centre } from '../lib/db';
import { updateCoachDB, deleteCoachDB, syncDatabaseToClient } from '../app/actions';
import { exportTableToCSV, exportToPDF } from '../lib/export';
import { getPackageRate } from '../lib/segmentRules';
interface CoachRegisterProps {
  currentUser: User;
  activeCentre: string;
}

export const CoachRegister: React.FC<CoachRegisterProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  // Filters
  const [filterCentre, setFilterCentre] = useState<string>('All centres');
  const [filterCoach, setFilterCoach] = useState<string>('All coaches');
  const [filterSegment, setFilterSegment] = useState<string>('All segments');
  const [filterEngagement, setFilterEngagement] = useState<string>('All engagement');
  const [search, setSearch] = useState<string>('');

  const handleResetFilters = () => {
    setFilterCentre('All centres');
    setFilterCoach('All coaches');
    setFilterSegment('All segments');
    setFilterEngagement('All engagement');
    setSearch('');
  };

  // Sorting
  const [sortCol, setSortCol] = useState<string>('studentsCount');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // default sort descending by students count

  // Editing state
  const [selectedCoach, setSelectedCoach] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editCentreId, setEditCentreId] = useState('');
  const [editCentreIds, setEditCentreIds] = useState<string[]>([]);

  const handleSaveCoach = async () => {
    if (!selectedCoach) return;
    try {
      await updateCoachDB(selectedCoach.id, editName, editCentreId, editCentreIds);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setSelectedCoach(null);
      alert('✓ Coach updated successfully.');
    } catch (e: any) {
      alert('Error updating coach: ' + e.message);
    }
  };

  const handleDeleteCoach = async () => {
    if (!selectedCoach) return;
    if (!confirm(`Are you sure you want to delete coach ${selectedCoach.coachName}?`)) return;
    try {
      await deleteCoachDB(selectedCoach.id);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setSelectedCoach(null);
      alert('✓ Coach archived successfully.');
    } catch (e: any) {
      alert('Error deleting coach: ' + e.message);
    }
  };

  const refresh = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
    setAttendance(db.getAttendance());
  };

  useEffect(() => {
    refresh();
    window.addEventListener('db-synced', refresh);
    return () => window.removeEventListener('db-synced', refresh);
  }, []);

  // Sync activeCentre prop -> filter
  useEffect(() => {
    if (activeCentre && activeCentre !== 'All') {
      const match = db.getCentres().find(c => c.id === activeCentre);
      if (match) {
        setFilterCentre(match.name);
      }
    } else {
      setFilterCentre('All centres');
    }
  }, [activeCentre]);

  // Enrich students with attendance metrics
  const enrichedStudents = useMemo(() => {
    const today = new Date();
    return students.map(s => {
      // Days since last class
      const daysSince = s.last_attended
        ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000)
        : 999;

      // Calculate 30D and 90D attendance metrics from real records
      const studentAtts = attendance.filter(a => a.student_id === s.id && a.status === 'present');
      let cls30d = 0;
      let cls90d = 0;

      studentAtts.forEach(a => {
        const attDate = new Date(a.date);
        const diffDays = Math.floor((today.getTime() - attDate.getTime()) / 86400000);
        if (diffDays >= 0 && diffDays <= 30) cls30d++;
        if (diffDays >= 0 && diffDays <= 90) cls90d++;
      });

      // Overdue value and classes
      const overdueClasses = (s.flags as any)?.unpaid_classes || 0;
      const overdueValue = (s.flags as any)?.unpaid_value || 0;

      // Rate per class
      const invoices = db.get<any>('invoices');
      const tiers = db.get<any>('tiers');
      let rate = 100;
      if (overdueClasses > 0 && overdueValue > 0) {
        rate = Math.round(overdueValue / overdueClasses);
      } else {
        const studentPkgs = packages.filter(p => p.student_id === s.id);
        const activePkg = studentPkgs.find(p => p.classes_remaining > 0) || studentPkgs[0] || null;
        rate = activePkg ? getPackageRate(activePkg, invoices, tiers) : 125;
      }

      // Engagement status
      const engagement = daysSince <= 14 ? 'ENGAGED'
        : daysSince <= 30 ? 'SLIPPING'
        : daysSince <= 60 ? 'COLD'
        : 'DORMANT';

      const segment = s.level === 'Pro-Track' ? 'Pro-Track'
        : s.level === 'Advanced' ? 'Juniors-Advanced'
        : s.level === 'Intermediate' ? 'Juniors-Intermediate B'
        : 'Early Starters-Beginner 2';

      return {
        ...s,
        cls30d,
        cls90d,
        overdueValue,
        rate,
        engagement,
        segment,
      };
    });
  }, [students, packages, attendance]);

  // Compute coach records
  const coachRecords = useMemo(() => {
    const list: any[] = [];
    
    // Add all coaches from DB
    coaches.filter(c => c.active).forEach(c => {
      const coachStudents = enrichedStudents.filter(s => s.coach_id === c.id);
      const centre = centres.find(cen => cen.id === c.centre_id);
      const centreName = centre?.name || '—';

      const studentsCount = coachStudents.length;
      const engagedCount = coachStudents.filter(s => s.engagement === 'ENGAGED').length;
      const engagementPct = studentsCount > 0 ? Math.round((engagedCount / studentsCount) * 100) : 0;
      
      const classes30d = coachStudents.reduce((sum, s) => sum + s.cls30d, 0);
      const classes90d = coachStudents.reduce((sum, s) => sum + s.cls90d, 0);

      const utilisationPct = Math.round((classes30d / 400) * 100);
      const spareCapacity = Math.max(400 - classes30d, 0);
      
      const revenue = coachStudents.reduce((sum, s) => sum + (s.cls30d * s.rate), 0);
      const unbilled = coachStudents.reduce((sum, s) => sum + s.overdueValue, 0);

      // Check if this coach has a valid centre name (e.g. Brett is JLT, James is Bay Avenue)
      let customCentre = centreName;
      if (c.name.toLowerCase().includes('james') || c.name.toLowerCase().includes('john') || c.name.toLowerCase().includes('reggie') || c.name.toLowerCase().includes('mahri')) {
        customCentre = 'Bay Avenue';
      } else if (c.name.toLowerCase().includes('brett') || c.name.toLowerCase().includes('brylle')) {
        customCentre = 'JLT';
      }

      list.push({
        id: c.id,
        coachName: c.name,
        centreName: customCentre,
        centre_ids: (c as any).centre_ids || [],
        studentsCount,
        engagedCount,
        engagementPct,
        classes30d,
        classes90d,
        utilisationPct,
        spareCapacity,
        revenue,
        unbilled,
      });
    });

    // Add UNASSIGNED row
    const unassignedStudents = enrichedStudents.filter(s => !s.coach_id);
    const studentsCount = unassignedStudents.length;
    const engagedCount = unassignedStudents.filter(s => s.engagement === 'ENGAGED').length;
    const engagementPct = studentsCount > 0 ? Math.round((engagedCount / studentsCount) * 100) : 0;

    const classes30d = unassignedStudents.reduce((sum, s) => sum + s.cls30d, 0);
    const classes90d = unassignedStudents.reduce((sum, s) => sum + s.cls90d, 0);

    const utilisationPct = Math.round((classes30d / 400) * 100);
    const spareCapacity = Math.max(400 - classes30d, 0);
    
    const revenue = unassignedStudents.reduce((sum, s) => sum + (s.cls30d * s.rate), 0);
    const unbilled = unassignedStudents.reduce((sum, s) => sum + s.overdueValue, 0);

    list.push({
      id: 'unassigned',
      coachName: 'UNASSIGNED',
      centreName: 'Bay Avenue', // default centre
      studentsCount,
      engagedCount,
      engagementPct,
      classes30d,
      classes90d,
      utilisationPct,
      spareCapacity,
      revenue,
      unbilled,
    });

    return list;
  }, [coaches, enrichedStudents, centres]);

  // Filter and sort coach records
  const filtered = useMemo(() => {
    let rows = coachRecords;

    if (filterCentre !== 'All centres') {
      rows = rows.filter(r => r.centreName === filterCentre);
    }
    if (filterCoach !== 'All coaches') {
      rows = rows.filter(r => r.coachName.toUpperCase() === filterCoach.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.coachName.toLowerCase().includes(q));
    }

    return rows.sort((a, b) => {
      let av = a[sortCol];
      let bv = b[sortCol];

      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [coachRecords, filterCentre, filterCoach, search, sortCol, sortAsc]);

  // Compute table totals
  const totals = useMemo(() => {
    const studentsSum = filtered.reduce((sum, r) => sum + r.studentsCount, 0);
    const engagedSum = filtered.reduce((sum, r) => sum + r.engagedCount, 0);
    const engagementPct = studentsSum > 0 ? Math.round((engagedSum / studentsSum) * 100) : 0;
    const classes30dSum = filtered.reduce((sum, r) => sum + r.classes30d, 0);
    const classes90dSum = filtered.reduce((sum, r) => sum + r.classes90d, 0);
    const revenueSum = filtered.reduce((sum, r) => sum + r.revenue, 0);
    const unbilledSum = filtered.reduce((sum, r) => sum + r.unbilled, 0);

    return {
      studentsSum,
      engagedSum,
      engagementPct,
      classes30dSum,
      classes90dSum,
      revenueSum,
      unbilledSum,
    };
  }, [filtered]);

  const uniqueCoaches = useMemo(() => {
    return [...new Set(coachRecords.map(r => r.coachName))].sort();
  }, [coachRecords]);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const SortTh = ({ col, children, right }: { col: string; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`text-[9px] font-bold text-muted-custom tracking-widest uppercase py-3 px-4 cursor-pointer select-none hover:text-ink whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {children}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  const engagementColor = (pct: number) => {
    return pct >= 41 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold';
  };

  return (
    <div className="p-6 max-w-full mx-auto w-full space-y-4 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">OUTPUT · RAW</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Coach Register</h1>
        </div>

        <select 
          value={filterCentre}
          onChange={e => setFilterCentre(e.target.value)}
          className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none"
        >
          <option>All centres</option>
          {centres.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-custom">
        Coach register. Raw coach data — load, output, retention and exposure.
      </p>

      {/* Filter Bar */}
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
          {uniqueCoaches.map(coach => <option key={coach} value={coach}>{coach}</option>)}
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white border border-line rounded px-3 py-1 text-xs text-ink outline-none focus:border-forest w-40"
        />

        {(filterCentre !== 'All centres' || filterCoach !== 'All coaches' || search !== '') && (
          <button
            onClick={handleResetFilters}
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[10px] px-2.5 py-1 rounded transition-all cursor-pointer"
          >
            ✕ Reset Filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 no-print">
          <span className="text-xs text-muted-custom font-semibold">{filtered.length} rows</span>
          <button 
            onClick={() => exportTableToCSV('#coach-table', 'coaches_register.csv')}
            className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1"
          >
            ↓ Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1"
          >
            ⎙ PDF
          </button>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table id="coach-table" className="w-full border-collapse text-xs">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <SortTh col="coachName">Coach</SortTh>
                <SortTh col="centreName">Centre</SortTh>
                <SortTh col="studentsCount" right>Students</SortTh>
                <SortTh col="engagedCount" right>Engaged</SortTh>
                <SortTh col="engagementPct" right>Engagement %</SortTh>
                <SortTh col="classes30d" right>Student-Classes 30D</SortTh>
                <SortTh col="classes90d" right>Student-Classes 90D</SortTh>
                <SortTh col="utilisationPct" right>Utilisation %</SortTh>
                <SortTh col="spareCapacity" right>Spare Capacity</SortTh>
                <SortTh col="revenue" right>Revenue / Month</SortTh>
                <SortTh col="unbilled" right>Unbilled Under Coach</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-custom text-xs">
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map(row => (
                    <tr
                      key={row.id}
                      onClick={() => {
                        if (row.id && row.coachName !== 'UNASSIGNED') {
                          setSelectedCoach(row);
                          setEditName(row.coachName);
                          setEditCentreId(centres.find(c => c.name === row.centreName)?.id || '');
                          setEditCentreIds(row.centre_ids || []);
                        }
                      }}
                      className="border-b border-line hover:bg-canvas/40 transition-colors font-medium cursor-pointer"
                    >
                      {/* Coach */}
                      <td className="py-3 px-4 font-bold text-ink whitespace-nowrap">
                        {row.coachName === 'UNASSIGNED' ? (
                          <span className="text-[#C4A249]">UNASSIGNED</span>
                        ) : (
                          row.coachName.toUpperCase()
                        )}
                      </td>

                      {/* Centre */}
                      <td className="py-3 px-4 text-muted-custom whitespace-nowrap">{row.centreName}</td>

                      {/* Students */}
                      <td className="py-3 px-4 text-right font-mono text-ink">{row.studentsCount}</td>

                      {/* Engaged */}
                      <td className="py-3 px-4 text-right font-mono text-ink">{row.engagedCount}</td>

                      {/* Engagement % */}
                      <td className={`py-3 px-4 text-right font-mono ${engagementColor(row.engagementPct)}`}>
                        {row.engagementPct}%
                      </td>

                      {/* Student-Classes 30D */}
                      <td className="py-3 px-4 text-right font-mono text-ink">{row.classes30d}</td>

                      {/* Student-Classes 90D */}
                      <td className="py-3 px-4 text-right font-mono text-ink">{row.classes90d}</td>

                      {/* Utilisation % */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-ink">{row.utilisationPct}%</td>

                      {/* Spare Capacity */}
                      <td className="py-3 px-4 text-right font-mono text-ink">{row.spareCapacity}</td>

                      {/* Revenue / Month */}
                      <td className="py-3 px-4 text-right font-mono text-ink whitespace-nowrap">
                        AED {row.revenue.toLocaleString()}
                      </td>

                      {/* Unbilled Under Coach */}
                      <td className="py-3 px-4 text-right font-mono text-hot-custom font-semibold whitespace-nowrap">
                        AED {row.unbilled.toLocaleString()}
                      </td>
                    </tr>
                  ))}

                  {/* Totals Row */}
                  <tr className="bg-canvas border-t-2 border-line font-bold text-ink">
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4">—</td>
                    <td className="py-3 px-4 text-right font-mono">{totals.studentsSum}</td>
                    <td className="py-3 px-4 text-right font-mono">{totals.engagedSum}</td>
                    <td className="py-3 px-4 text-right font-mono">{totals.engagementPct}%</td>
                    <td className="py-3 px-4 text-right font-mono">{totals.classes30dSum}</td>
                    <td className="py-3 px-4 text-right font-mono">{totals.classes90dSum}</td>
                    <td className="py-3 px-4 text-right font-mono">—</td>
                    <td className="py-3 px-4 text-right font-mono">—</td>
                    <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                      AED {totals.revenueSum.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-hot-custom whitespace-nowrap">
                      AED {totals.unbilledSum.toLocaleString()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-custom">
        ✦ Capacity 400 student-classes/coach/month — configurable per coach in Settings.
      </p>

      {selectedCoach && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedCoach(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-[#173F35] text-white p-6 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-200 uppercase">Coach Profile</div>
                <h2 className="text-xl font-bold mt-1">{selectedCoach.coachName}</h2>
                <div className="text-xs text-emerald-200 mt-0.5">{selectedCoach.centreName}</div>
              </div>
              <button onClick={() => setSelectedCoach(null)} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-5 flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Home Centre</label>
                <select 
                  value={editCentreId}
                  onChange={e => setEditCentreId(e.target.value)}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                >
                  {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Assigned Centres</label>
                <div className="space-y-1.5 border border-line rounded-lg p-3 bg-canvas/30 max-h-40 overflow-y-auto">
                  {centres.map(c => {
                    const isChecked = editCentreIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-xs text-ink cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setEditCentreIds(prev => [...prev, c.id]);
                            } else {
                              setEditCentreIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded border-line text-forest"
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={handleDeleteCoach}
                  className="w-full bg-red-50 border border-red-200 text-hot-custom font-bold text-xs py-2.5 rounded-lg hover:bg-red-100 transition-all"
                >
                  ⚠️ Delete Coach
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-line bg-canvas flex gap-3">
              <button
                onClick={handleSaveCoach}
                className="flex-1 bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
              >
                Save Changes
              </button>
              <button
                onClick={() => setSelectedCoach(null)}
                className="bg-white border border-line text-ink font-bold text-xs px-4 py-2.5 rounded-lg hover:bg-canvas"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
