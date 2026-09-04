"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, Coach, Centre, Tier } from '../lib/db';
import { updatePackageDB, deletePackageDB, syncDatabaseToClient } from '../app/actions';
import { exportTableToCSV, exportToPDF } from '../lib/export';
import { ZohoPackageAutoFilter, ZohoPackageFilterState } from './ZohoPackageAutoFilter';
import { OldVsNewChart } from './OldVsNewChart';
import { ActiveStudentsChart } from './ActiveStudentsChart';
import { MostPopularDayChart } from './MostPopularDayChart';
interface PackageRegisterProps {
  currentUser: User;
  activeCentre: string;
}

export const PackageRegister: React.FC<PackageRegisterProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Filters & Sorting state (Zoho Creator style)
  const [zohoFilters, setZohoFilters] = useState<ZohoPackageFilterState>({
    centre: 'All centres',
    modeOfPayment: 'All',
    student: 'All',
    dateOfPayment: 'All',
    packageType: 'All types',
    status: 'All statuses',
    coach: 'All coaches',
    segment: 'All segments',
    search: '',
    sortCol: 'studentName',
    sortAsc: true,
  });

  const handleResetFilters = () => {
    setZohoFilters({
      centre: 'All centres',
      modeOfPayment: 'All',
      student: 'All',
      dateOfPayment: 'All',
      packageType: 'All types',
      status: 'All statuses',
      coach: 'All coaches',
      segment: 'All segments',
      search: '',
      sortCol: 'studentName',
      sortAsc: true,
    });
  };

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
    setTiers(db.getTiers());
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
        setZohoFilters(prev => ({ ...prev, centre: match.name }));
      }
    } else {
      setZohoFilters(prev => ({ ...prev, centre: 'All centres' }));
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

      // Get all student's packages sorted by start_date asc (including settled), stably using ID fallback
      const studentPkgs = packages
        .filter(p => p.student_id === s.id)
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

        // Determine paid on date and amount
        const pkgInvoice = invoices.find(inv => inv.package_id === pkg.id);
        const isPaid = pkgInvoice ? pkgInvoice.status === 'paid' : (pkg.kind !== 'unbilled');
        const paidOnDate = isPaid ? (pkgInvoice?.created_at || pkg.start_date || '2025-01-10') : null;
        const paidOn = paidOnDate ? new Date(paidOnDate).toISOString().split('T')[0] : '-';

        // Calculate package amount paid
        let amount = 0;
        if (pkgInvoice && pkgInvoice.amount !== undefined && pkgInvoice.amount !== null) {
          amount = Number(pkgInvoice.amount);
        } else if (pkg.kind !== 'unbilled') {
          const tier = tiers.find(t => t.id === pkg.tier_id);
          if (tier?.price) {
            amount = Number(tier.price);
          } else if (pkg.classes_total > 0) {
            amount = pkg.classes_total * 125;
          }
        }

        const paymentMethod = pkgInvoice?.method || (pkg.kind === 'unbilled' ? '-' : 'Online');
        const ratePerClass = (pkg.classes_total > 0 && amount > 0) ? Math.round(amount / pkg.classes_total) : 0;

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
          amount,
          paymentMethod,
          ratePerClass,
          invoiceStatus: pkgInvoice?.status || (pkg.kind === 'unbilled' ? 'unpaid' : 'paid'),
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
  }, [students, packages, coaches, centres, attendance, invoices, tiers]);

  // Filter and sort the enriched list
  const filtered = useMemo(() => {
    let rows = enriched;

    // 1. Centre Filter
    if (zohoFilters.centre !== 'All centres' && zohoFilters.centre !== 'All') {
      rows = rows.filter(r => r.centreName?.toLowerCase() === zohoFilters.centre.toLowerCase());
    }

    // 2. Mode of Payment Filter
    if (zohoFilters.modeOfPayment !== 'All') {
      rows = rows.filter(r => r.paymentMethod?.toLowerCase() === zohoFilters.modeOfPayment.toLowerCase());
    }

    // 3. Student Name Filter
    if (zohoFilters.student !== 'All') {
      rows = rows.filter(r => r.studentName?.toLowerCase() === zohoFilters.student.toLowerCase());
    }

    // 4. Date of Payment Filter
    if (zohoFilters.dateOfPayment !== 'All') {
      const today = new Date();
      rows = rows.filter(r => {
        if (!r.paidOn || r.paidOn === '-') return false;
        const d = new Date(r.paidOn);
        if (isNaN(d.getTime())) return false;

        if (zohoFilters.dateOfPayment === 'This Month') {
          return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }
        if (zohoFilters.dateOfPayment === 'Last Month') {
          const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
        }
        if (zohoFilters.dateOfPayment === 'This Year') {
          return d.getFullYear() === today.getFullYear();
        }
        if (zohoFilters.dateOfPayment === 'Last 30 Days') {
          const diffDays = (today.getTime() - d.getTime()) / 86400000;
          return diffDays >= 0 && diffDays <= 30;
        }
        if (zohoFilters.dateOfPayment === 'Last 90 Days') {
          const diffDays = (today.getTime() - d.getTime()) / 86400000;
          return diffDays >= 0 && diffDays <= 90;
        }

        const monthStr = d.toLocaleString('default', { month: 'short' });
        const formatted = `${monthStr} - ${d.getFullYear()}`;
        return formatted.toLowerCase() === zohoFilters.dateOfPayment.toLowerCase() || String(d.getFullYear()) === zohoFilters.dateOfPayment;
      });
    }

    // 5. Package Type Filter
    if (zohoFilters.packageType !== 'All types' && zohoFilters.packageType !== 'All') {
      rows = rows.filter(r => r.type?.toLowerCase() === zohoFilters.packageType.toLowerCase());
    }

    // 6. Status Filter
    if (zohoFilters.status !== 'All statuses' && zohoFilters.status !== 'All') {
      rows = rows.filter(r => r.status?.toLowerCase() === zohoFilters.status.toLowerCase());
    }

    // 7. Coach Filter
    if (zohoFilters.coach !== 'All coaches' && zohoFilters.coach !== 'All') {
      rows = rows.filter(r => r.coachName?.toLowerCase() === zohoFilters.coach.toLowerCase());
    }

    // 8. Segment / Category Filter
    if (zohoFilters.segment !== 'All segments' && zohoFilters.segment !== 'All') {
      rows = rows.filter(r => r.segment?.toLowerCase() === zohoFilters.segment.toLowerCase());
    }

    // 9. Search Filter
    if (zohoFilters.search.trim()) {
      const q = zohoFilters.search.toLowerCase();
      rows = rows.filter(r => 
        r.studentName.toLowerCase().includes(q) || 
        r.displayId.toLowerCase().includes(q) ||
        (r.paymentMethod || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    const { sortCol, sortAsc } = zohoFilters;
    return rows.sort((a, b) => {
      let av = (a as any)[sortCol];
      let bv = (b as any)[sortCol];

      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [enriched, zohoFilters]);

  const toggleSort = (col: string) => {
    setZohoFilters(prev => ({
      ...prev,
      sortCol: col,
      sortAsc: prev.sortCol === col ? !prev.sortAsc : true,
    }));
  };

  const SortTh = ({ col, children, right }: { col: string; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`text-[9px] font-bold text-muted-custom tracking-widest uppercase py-3 px-4 cursor-pointer select-none hover:text-ink whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {children}{zohoFilters.sortCol === col ? (zohoFilters.sortAsc ? ' ▲' : ' ▼') : ''}
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

  const uniqueCoaches = useMemo(() => [...new Set(enriched.map(r => r.coachName))].sort(), [enriched]);
  const uniqueCategories = useMemo(() => {
    const allCats = new Set<string>();
    ['Early starts', 'Juniors', 'Seniors', 'Adult', 'Pro-Track'].forEach(c => allCats.add(c));
    students.forEach(s => {
      if (s.category) allCats.add(s.category);
    });
    enriched.forEach(r => {
      if (r.segment) allCats.add(r.segment);
      if (r.category) allCats.add(r.category);
    });
    return Array.from(allCats).filter(Boolean).sort();
  }, [students, enriched]);
  const uniqueStudents = useMemo(() => [...new Set(enriched.map(r => r.studentName))].sort(), [enriched]);
  const uniquePaymentModes = useMemo(() => [...new Set(enriched.map(r => r.paymentMethod).filter(p => p && p !== '-'))].sort(), [enriched]);
  const uniquePackageTypes = useMemo(() => ['Renewal', 'New', 'Tournament', 'Unbilled'], []);
  const uniqueStatuses = useMemo(() => ['CURRENT', 'COMPLETED', 'UNBILLED'], []);

  const datesOfPayment = useMemo(() => {
    const monthMap = new Map<string, { year: number; month: number; label: string }>();

    enriched.forEach(r => {
      if (!r.paidOn || r.paidOn === '-') return;
      const d = new Date(r.paidOn);
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        const monthStr = d.toLocaleString('default', { month: 'short' });
        monthMap.set(key, { year, month, label: `${monthStr} - ${year}` });
      }
    });

    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        const monthStr = d.toLocaleString('default', { month: 'short' });
        monthMap.set(key, { year, month, label: `${monthStr} - ${year}` });
      }
    }

    const sortedMonths = Array.from(monthMap.values())
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month))
      .map(m => m.label);

    return ['All', 'This Month', 'Last Month', 'This Year', 'Last 30 Days', 'Last 90 Days', ...sortedMonths];
  }, [enriched]);

  const centreNames = useMemo(() => {
    const names = centres.map(c => c.name);
    if (enriched.some(r => r.centreName === 'Tournaments') && !names.includes('Tournaments')) {
      names.push('Tournaments');
    }
    return names;
  }, [centres, enriched]);

  return (
    <div className="p-6 max-w-full mx-auto w-full space-y-4 text-ink">
      {/* Old Vs New (New Student vs Renewal) Month-wise Chart */}
      <OldVsNewChart enrichedPackages={enriched} centres={centreNames} />
      <ActiveStudentsChart attendance={attendance} students={students} coaches={coaches} centres={centres} slots={db.getScheduleSlots()} />
      <MostPopularDayChart attendance={attendance} students={students} coaches={coaches} centres={centres} />

      {/* Zoho Creator Style Filter Header Bar for Package Register */}
      <ZohoPackageAutoFilter
        filters={zohoFilters}
        onFilterChange={setZohoFilters}
        onResetFilters={handleResetFilters}
        onExportCSV={() => exportTableToCSV('#package-table', 'package_register.csv')}
        onExportPDF={exportToPDF}
        totalRecords={enriched.length}
        filteredRecordsCount={filtered.length}
        centres={centreNames}
        paymentModes={uniquePaymentModes}
        students={uniqueStudents}
        datesOfPayment={datesOfPayment}
        packageTypes={uniquePackageTypes}
        statuses={uniqueStatuses}
        coaches={uniqueCoaches}
        segments={uniqueCategories}
      />

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
                <SortTh col="amount" right>Amount (AED)</SortTh>
                <SortTh col="paymentMethod">Method</SortTh>
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
                  <td colSpan={15} className="py-12 text-center text-muted-custom text-xs">
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
                          studentName: row.studentName,
                          amount: row.amount,
                          paymentMethod: row.paymentMethod,
                          ratePerClass: row.ratePerClass,
                          paidOn: row.paidOn,
                          type: row.type,
                          status: row.status
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

                    {/* Amount Paid */}
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                      {row.type === 'Unbilled' || row.type === '>> UNPAID <<' ? (
                        <span className="text-muted-custom font-normal">—</span>
                      ) : (
                        <span className="text-forest font-semibold">
                          AED {Number(row.amount || 0).toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="py-3 px-4 text-muted-custom whitespace-nowrap">
                      {row.paymentMethod && row.paymentMethod !== '-' ? (
                        <span className="bg-canvas border border-line text-ink text-[10px] px-2 py-0.5 rounded font-mono">
                          {row.paymentMethod}
                        </span>
                      ) : (
                        <span className="text-muted-custom/60">—</span>
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
              {/* Payment Details Card */}
              <div className="bg-canvas border border-line rounded-xl p-4 space-y-2">
                <div className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Payment Information</div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-muted-custom block">Amount Paid</span>
                    <span className="text-sm font-bold font-mono text-forest">
                      {selectedPkg.amount ? `AED ${Number(selectedPkg.amount).toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-custom block">Rate per Class</span>
                    <span className="text-xs font-semibold font-mono text-ink">
                      {selectedPkg.ratePerClass ? `AED ${selectedPkg.ratePerClass}/class` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-custom block">Payment Method</span>
                    <span className="text-xs font-mono text-ink">
                      {selectedPkg.paymentMethod || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-custom block">Payment Date</span>
                    <span className="text-xs font-mono text-muted-custom">
                      {selectedPkg.paidOn || '—'}
                    </span>
                  </div>
                </div>
              </div>

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

