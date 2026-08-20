"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, Coach, Centre } from '../lib/db';
import { updatePackageDB, deletePackageDB, syncDatabaseToClient } from '../app/actions';
import { exportTableToCSV, exportToPDF } from '../lib/export';
interface PackageRegisterProps {
  currentUser: User;
  activeCentre: string;
}

export const PackageRegister: React.FC<PackageRegisterProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Filters
  const [filterCentre, setFilterCentre] = useState<string>('All centres');
  const [filterCoach, setFilterCoach] = useState<string>('All coaches');
  const [filterSegment, setFilterSegment] = useState<string>('All segments');
  const [filterEngagement, setFilterEngagement] = useState<string>('All engagement');
  const [filterType, setFilterType] = useState<string>('All types');
  const [search, setSearch] = useState<string>('');

  const handleResetFilters = () => {
    setFilterCentre('All centres');
    setFilterCoach('All coaches');
    setFilterSegment('All segments');
    setFilterEngagement('All engagement');
    setFilterType('All types');
    setSearch('');
  };

  // Sorting
  const [sortCol, setSortCol] = useState<string>('studentName');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Edit states
  const [selectedPkg, setSelectedPkg] = useState<any | null>(null);
  const [editTotal, setEditTotal] = useState(0);
  const [editRemaining, setEditRemaining] = useState(0);
  const [editFrozen, setEditFrozen] = useState(false);

  const handleSavePackage = async () => {
    if (!selectedPkg) return;
    try {
      await updatePackageDB(selectedPkg.id, {
        classes_total: editTotal,
        classes_remaining: editRemaining,
        frozen: editFrozen
      });
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setSelectedPkg(null);
      alert('✓ Package updated successfully.');
    } catch (e: any) {
      alert('Error updating package: ' + e.message);
    }
  };

  const handleDeletePackage = async () => {
    if (!selectedPkg) return;
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      await deletePackageDB(selectedPkg.id);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setSelectedPkg(null);
      alert('✓ Package deleted successfully.');
    } catch (e: any) {
      alert('Error deleting package: ' + e.message);
    }
  };

  const refresh = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
    setAttendance(db.getAttendance());
    setInvoices(db.get('invoices') || []);
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

  // Enrich packages with student metadata and attendance tracking
  const enriched = useMemo(() => {
    const list: any[] = [];

    students.forEach(s => {
      const centre = centres.find(c => c.id === s.centre_id);
      const coach = coaches.find(c => c.id === s.coach_id);
      const centreName = centre?.name || '—';
      const coachName = coach?.name || 'Unassigned';

      // Auto-generated BAY/JLT style ID
      const prefix = (centre?.name || 'BAY').slice(0, 3).toUpperCase();
      const numPart = s.fide_id || s.id.replace(/\D/g, '').slice(0, 3) || '000';
      const displayId = s.flags?.custom_student_id || `${prefix}-${numPart}`;

      // Get all student's attendances (present) sorted by date asc
      const studentAtts = attendance
        .filter(a => a.student_id === s.id && a.status === 'present')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Get all student's packages sorted by start_date asc (exclude settled), stably using ID fallback
      const studentPkgs = packages
        .filter(p => p.student_id === s.id && p.kind !== 'settled')
        .sort((a, b) => {
          const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
          const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
          if (dateA !== dateB) return dateA - dateB;
          return a.id.localeCompare(b.id);
        });

      let attCursor = 0;

      studentPkgs.forEach((pkg, index) => {
        const pkgNo = pkg.package_number || (index + 1);
        const totalEntitlement = pkg.classes_total + (pkg.bonus_classes || 0);
        const classesPaid = totalEntitlement;
        const used = totalEntitlement - pkg.classes_remaining;
        const balance = pkg.classes_remaining;

        // Determine paid on date
        const pkgInvoice = invoices.find(inv => inv.package_id === pkg.id);
        const isPaid = pkgInvoice ? pkgInvoice.status === 'paid' : true;
        const paidOnDate = isPaid ? (pkgInvoice?.created_at || pkg.start_date || '2025-01-10') : null;
        const paidOn = paidOnDate ? new Date(paidOnDate).toISOString().split('T')[0] : '-';

        // Map attendances to this package
        const pkgAtts = studentAtts.slice(attCursor, attCursor + totalEntitlement);
        attCursor += totalEntitlement;

        const dynamicFirstClass = pkgAtts.length > 0 ? new Date(pkgAtts[0].date).toISOString().split('T')[0] : (pkg.start_date ? new Date(pkg.start_date).toISOString().split('T')[0] : '-');
        const firstClass = pkg.first_class_date ? new Date(pkg.first_class_date).toISOString().split('T')[0] : dynamicFirstClass;

        let ended = '-';
        if (pkg.classes_remaining === 0) {
          if (pkg.ended_at) {
            ended = new Date(pkg.ended_at).toISOString().split('T')[0];
          } else if (pkgAtts.length > 0) {
            ended = new Date(pkgAtts[pkgAtts.length - 1].date).toISOString().split('T')[0];
          } else if (pkg.expiry_date) {
            ended = new Date(pkg.expiry_date).toISOString().split('T')[0];
          }
        }

        // Segment calculation
        const segment = s.level === 'Pro-Track' ? 'Pro-Track'
          : s.level === 'Advanced' ? 'Juniors-Advanced'
          : s.level === 'Intermediate' ? 'Juniors-Intermediate B'
          : 'Early Starters-Beginner 2';

        // Engagement calculation
        const engagement = s.pace_status === 'Slow' ? 'SLIPPING' : s.pace_status === 'Stalled' ? 'COLD' : 'ENGAGED';

        list.push({
          id: pkg.id,
          studentName: s.name,
          studentId: s.id,
          displayId,
          centreName,
          coachName,
          segment,
          engagement,
          pkgNo,
          type: pkg.kind === 'unbilled' ? 'Unbilled' : (pkg.kind ? (pkg.kind.charAt(0).toUpperCase() + pkg.kind.slice(1)) : 'New'),
          paidOn: pkg.kind === 'unbilled' ? '-' : paidOn,
          firstClass,
          ended,
          classesPaid,
          used,
          balance,
          status: pkg.kind === 'unbilled' ? 'UNBILLED' : (pkg.classes_remaining === 0 ? 'COMPLETED' : 'CURRENT'),
          is_family_shared: pkg.is_family_shared || false,
          dateForSort: pkg.start_date ? new Date(pkg.start_date).getTime() : 0
        });
      });
    });

    return list;
  }, [students, packages, coaches, centres, attendance, invoices]);

  // Filter and sort the enriched list
  const filtered = useMemo(() => {
    let rows = enriched;

    if (filterCentre !== 'All centres') {
      rows = rows.filter(r => r.centreName === filterCentre);
    }
    if (filterCoach !== 'All coaches') {
      rows = rows.filter(r => r.coachName.toUpperCase() === filterCoach.toUpperCase());
    }
    if (filterSegment !== 'All segments') {
      rows = rows.filter(r => r.segment === filterSegment);
    }
    if (filterType !== 'All types') {
      rows = rows.filter(r => r.type === filterType);
    }
    if (filterEngagement !== 'All engagement') {
      rows = rows.filter(r => 
        r.engagement === filterEngagement || 
        r.status === filterEngagement
      );
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => 
        r.studentName.toLowerCase().includes(q) || 
        r.displayId.toLowerCase().includes(q)
      );
    }

    return rows.sort((a, b) => {
      let av = a[sortCol];
      let bv = b[sortCol];

      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [enriched, filterCentre, filterCoach, filterSegment, filterEngagement, filterType, search, sortCol, sortAsc]);

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

  const statusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'CURRENT':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'UNBILLED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const uniqueCoaches = useMemo(() => {
    return [...new Set(enriched.map(r => r.coachName))].sort();
  }, [enriched]);

  const uniqueSegments = useMemo(() => {
    return [...new Set(enriched.map(r => r.segment))].sort();
  }, [enriched]);

  return (
    <div className="p-6 max-w-full mx-auto w-full space-y-4 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">OUTPUT · RAW</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Package Register</h1>
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
        Raw package register. One row per package — the source of the package-timeline analysis.
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

        <select
          value={filterSegment}
          onChange={e => setFilterSegment(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All segments</option>
          {uniqueSegments.map(seg => <option key={seg} value={seg}>{seg}</option>)}
        </select>

        <select
          value={filterEngagement}
          onChange={e => setFilterEngagement(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All engagement</option>
          <optgroup label="Package Status">
            <option value="CURRENT">CURRENT</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="UNBILLED">UNBILLED</option>
          </optgroup>
          <optgroup label="Student Engagement">
            <option value="ENGAGED">ENGAGED</option>
            <option value="SLIPPING">SLIPPING</option>
            <option value="COLD">COLD</option>
          </optgroup>
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All types</option>
          <option value="Renewal">Renewal</option>
          <option value="New">New</option>
          <option value="Unbilled">Unbilled</option>
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white border border-line rounded px-3 py-1 text-xs text-ink outline-none focus:border-forest w-40"
        />

        {(filterCentre !== 'All centres' || filterCoach !== 'All coaches' || filterSegment !== 'All segments' || filterEngagement !== 'All engagement' || filterType !== 'All types' || search !== '') && (
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
            onClick={() => exportTableToCSV('#package-table', 'packages_register.csv')}
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
          <table id="package-table" className="w-full border-collapse text-xs">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="py-2.5 px-4 text-left font-bold text-muted-custom uppercase tracking-widest w-12">S.No</th>
                <SortTh col="studentName">Student</SortTh>
                <SortTh col="displayId">ID</SortTh>
                <SortTh col="centreName">Centre</SortTh>
                <SortTh col="pkgNo">Pkg #</SortTh>
                <SortTh col="type">Type</SortTh>
                <SortTh col="paidOn">Paid On</SortTh>
                <SortTh col="firstClass">First Class</SortTh>
                <SortTh col="ended">Ended</SortTh>
                <SortTh col="classesPaid" right>Classes Paid</SortTh>
                <SortTh col="used" right>Used</SortTh>
                <SortTh col="balance" right>Balance</SortTh>
                <SortTh col="status">Status</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-muted-custom text-xs">
                    No packages match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (row.type !== '>> UNPAID <<') {
                        setSelectedPkg({
                          id: row.id,
                          classes_total: row.classesPaid,
                          classes_remaining: row.balance,
                          frozen: packages.find(p => p.id === row.id)?.frozen || false,
                          studentName: row.studentName
                        });
                        setEditTotal(row.classesPaid);
                        setEditRemaining(row.balance);
                        setEditFrozen(packages.find(p => p.id === row.id)?.frozen || false);
                      }
                    }}
                    className="border-b border-line hover:bg-canvas/40 transition-colors cursor-pointer"
                  >
                    {/* S.No */}
                    <td className="py-3 px-4 font-mono text-muted-custom">{idx + 1}</td>

                    {/* Student */}
                    <td className="py-3 px-4 font-semibold text-ink whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <a href={`/student-dashboard?studentId=${row.studentId}`} className="hover:text-forest hover:underline">
                        {row.studentName}
                      </a>
                    </td>

                    {/* ID */}
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.displayId}</td>

                    {/* Centre */}
                    <td className="py-3 px-4 text-muted-custom whitespace-nowrap">{row.centreName}</td>

                    {/* Pkg # */}
                    <td className="py-3 px-4 font-mono text-ink text-center">{row.pkgNo}</td>

                    {/* Type */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium flex items-center gap-2">
                      {row.type === '>> UNPAID <<' ? (
                        <span className="text-hot-custom font-semibold">{row.type}</span>
                      ) : (
                        row.type
                      )}
                      {row.is_family_shared && (
                        <span className="bg-sky-100 text-sky-800 border border-sky-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          👪 Family Shared
                        </span>
                      )}
                    </td>

                    {/* Paid On */}
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.paidOn}</td>

                    {/* First Class */}
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.firstClass}</td>

                    {/* Ended */}
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.ended}</td>

                    {/* Classes Paid */}
                    <td className="py-3 px-4 text-right font-mono text-ink">{row.classesPaid}</td>

                    {/* Used */}
                    <td className="py-3 px-4 text-right font-mono text-ink">{row.used}</td>

                    {/* Balance */}
                    <td className={`py-3 px-4 text-right font-mono font-bold ${row.balance < 0 ? 'text-hot-custom' : 'text-ink'}`}>
                      {row.balance}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPkg && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedPkg(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-[#173F35] text-white p-6 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-200 uppercase">Package Edit</div>
                <h2 className="text-xl font-bold mt-1">{selectedPkg.studentName}</h2>
                <div className="text-xs text-emerald-200 mt-0.5">Package ID: {selectedPkg.id}</div>
              </div>
              <button onClick={() => setSelectedPkg(null)} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-5 flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Classes Total</label>
                <input 
                  type="number" 
                  value={editTotal}
                  onChange={e => setEditTotal(Number(e.target.value))}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Classes Remaining</label>
                <input 
                  type="number" 
                  value={editRemaining}
                  onChange={e => setEditRemaining(Number(e.target.value))}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  checked={editFrozen}
                  onChange={e => setEditFrozen(e.target.checked)}
                  id="edit-frozen-chk"
                  className="w-4 h-4 rounded border-line text-forest focus:ring-forest"
                />
                <label htmlFor="edit-frozen-chk" className="text-xs font-bold text-ink">Freeze Package</label>
              </div>

              <div className="pt-8">
                <button
                  onClick={handleDeletePackage}
                  className="w-full bg-red-50 border border-red-200 text-hot-custom font-bold text-xs py-2.5 rounded-lg hover:bg-red-100 transition-all"
                >
                  ⚠️ Delete Package
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-line bg-canvas flex gap-3">
              <button
                onClick={handleSavePackage}
                className="flex-1 bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
              >
                Save Changes
              </button>
              <button
                onClick={() => setSelectedPkg(null)}
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
