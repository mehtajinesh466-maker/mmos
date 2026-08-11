"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, Coach, Centre } from '../lib/db';
import { updateInvoiceDB, deleteInvoiceDB, syncDatabaseToClient } from '../app/actions';
import { exportTableToCSV, exportToPDF } from '../lib/export';
import { computeStudentStatus, getStatusBadgeClasses, getPackageRate } from '../lib/segmentRules';
import * as XLSX from 'xlsx';
interface PaymentUnbilledRegisterProps {
  currentUser: User;
  activeCentre: string;
}

export const PaymentUnbilledRegister: React.FC<PaymentUnbilledRegisterProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

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
  const [sortCol, setSortCol] = useState<string>('overdueValue');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // default sort descending by overdue value

  // Editing state
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (selectedStudent) {
      const invs = invoices.filter(inv => inv.student_id === selectedStudent.id);
      setStudentInvoices(invs);
    } else {
      setStudentInvoices([]);
    }
  }, [selectedStudent, invoices]);

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      await updateInvoiceDB(invoiceId, newStatus);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      alert('✓ Invoice status updated.');
    } catch (e: any) {
      alert('Error updating invoice: ' + e.message);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await deleteInvoiceDB(invoiceId);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      alert('✓ Invoice deleted.');
    } catch (e: any) {
      alert('Error deleting invoice: ' + e.message);
    }
  };

  const refresh = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
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

  // Enrich student records with payment & unbilled metrics
  const enriched = useMemo(() => {
    return students.map(s => {
      const centre = centres.find(c => c.id === s.centre_id);
      const coach = coaches.find(c => c.id === s.coach_id);
      const centreName = centre?.name || '—';
      
      // Short/uppercase coach name (e.g. JAMES ESTRADA -> JAMES)
      const rawCoach = coach?.name || 'Unassigned';
      const coachName = rawCoach === 'Unassigned' ? 'Unassigned' : rawCoach.split(' ')[0].toUpperCase();

      // Auto-generated BAY/JLT style ID
      const prefix = (centre?.name || 'BAY').slice(0, 3).toUpperCase();
      const numPart = s.fide_id || s.id.replace(/\D/g, '').slice(0, 3) || '000';
      const displayId = s.fide_id ? s.fide_id : `${prefix}-${numPart}`;

      // Overdue Classes and Value from flags
      const overdueClasses = (s.flags as any)?.unpaid_classes || 0;
      const overdueValue = (s.flags as any)?.unpaid_value || 0;

      // Rate per class: if overdueValue and overdueClasses exist, compute. Else fallback.
      const tiers = db.get<any>('tiers');
      let rate = 100;
      if (overdueClasses > 0 && overdueValue > 0) {
        rate = Math.round(overdueValue / overdueClasses);
      } else {
        const studentPkgs = packages.filter(p => p.student_id === s.id);
        const activePkg = studentPkgs.find(p => p.classes_remaining > 0) || studentPkgs[0] || null;
        rate = activePkg ? getPackageRate(activePkg, invoices, tiers) : 125;
      }

      // Total Paid: paid invoices sum + fallback based on completed package classes
      let totalPaid = invoices
        .filter(inv => inv.student_id === s.id && inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      const studentPkgs = packages.filter(p => p.student_id === s.id);
      if (totalPaid === 0 && studentPkgs.length > 0) {
        studentPkgs.forEach(pkg => {
          const pkgRate = getPackageRate(pkg, invoices, tiers);
          const completed = pkg.classes_total - pkg.classes_remaining;
          totalPaid += completed * pkgRate;
        });
      }

      // Last payment date
      const paidInvoices = invoices.filter(inv => inv.student_id === s.id && inv.status === 'paid');
      let lastPayment = '—';
      if (paidInvoices.length > 0) {
        const sortedInvoices = [...paidInvoices].sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
        lastPayment = sortedInvoices[0].created_at ? new Date(sortedInvoices[0].created_at).toISOString().split('T')[0] : '—';
      } else if (studentPkgs.length > 0 && totalPaid > 0) {
        // Fallback to start_date of last package
        const sortedPkgs = [...studentPkgs].sort((a, b) => new Date(b.start_date || '').getTime() - new Date(a.start_date || '').getTime());
        lastPayment = sortedPkgs[0].start_date ? new Date(sortedPkgs[0].start_date).toISOString().split('T')[0] : '—';
      }

      // Segment calculation
      const segment = s.level === 'Pro-Track' ? 'Pro-Track'
        : s.level === 'Advanced' ? 'Juniors-Advanced'
        : s.level === 'Intermediate' ? 'Juniors-Intermediate B'
        : 'Early Starters-Beginner 2';

      // Engagement status
      const engagement = s.pace_status === 'Slow' ? 'SLIPPING' : s.pace_status === 'Stalled' ? 'COLD' : 'ENGAGED';

      // Overdue segment label (HOT, WARM, COLD, HEALTHY) using domain rules
      const statusInfo = computeStudentStatus(s, packages, [], invoices);
      const overdueSegment = statusInfo.segment;

      const hasUnpaidInvoice = invoices.some(inv => inv.student_id === s.id && inv.status === 'unpaid');

      return {
        id: s.id,
        studentName: s.name,
        displayId,
        centreName,
        coachName,
        rate,
        totalPaid,
        overdueClasses,
        overdueValue,
        lastPayment,
        segment,
        engagement,
        overdueSegment,
        hasUnpaidInvoice,
      };
    });
  }, [students, packages, coaches, centres, invoices]);

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
    if (filterEngagement !== 'All engagement') {
      rows = rows.filter(r => 
        r.engagement === filterEngagement || 
        r.overdueSegment === filterEngagement
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

      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [enriched, filterCentre, filterCoach, filterSegment, filterEngagement, search, sortCol, sortAsc]);

  // Computed KPI Card Totals
  const { totalLifetimePaid, totalUnbilledOwed, totalOverdueClasses, collectionRatio } = useMemo(() => {
    const paidSum = filtered.reduce((sum, r) => sum + r.totalPaid, 0);
    const owedSum = filtered.reduce((sum, r) => sum + r.overdueValue, 0);
    const classesSum = filtered.reduce((sum, r) => sum + r.overdueClasses, 0);
    const ratio = paidSum + owedSum > 0 ? Math.round((paidSum / (paidSum + owedSum)) * 100) : 100;

    return {
      totalLifetimePaid: paidSum,
      totalUnbilledOwed: owedSum,
      totalOverdueClasses: classesSum,
      collectionRatio: ratio,
    };
  }, [filtered]);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const handleDownloadOverdueReportExcel = () => {
    const allStudents = db.getStudents();
    const allPackages = db.getPackages();
    const allAttendance = db.getAttendance();
    const allCoaches = db.getCoaches();
    const allCentres = db.getCentres();
    const allInvoices = db.get<any>('invoices') || [];
    const allFamilies = db.get<any>('families') || [];
    const tiers = db.get<any>('tiers') || [];

    const today = new Date();

    // Map each student to their metrics
    const studentRows = allStudents.map(s => {
      const centre = allCentres.find(c => c.id === s.centre_id);
      const coach = allCoaches.find(c => c.id === s.coach_id);
      const family = allFamilies.find(f => f.id === s.family_id);
      const studentPkgs = allPackages.filter(p => p.student_id === s.id && !p.frozen);
      const studentAtts = allAttendance.filter(a => a.student_id === s.id && (a.status === 'present' || a.status === 'makeup'));
      
      const centreName = centre?.name || 'Bay Avenue';
      const rawCoach = coach?.name || 'Unassigned';
      const coachName = rawCoach === 'Unassigned' ? 'Unassigned' : rawCoach.split(' ')[0].toUpperCase();

      const pkgsCount = studentPkgs.length;
      const totalClasses = studentPkgs.reduce((sum, p) => sum + p.classes_total, 0);
      const classesLeft = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

      const attDuration = studentAtts.reduce((sum, a) => sum + (a.duration || 2), 0);
      const attSessions = studentAtts.length;

      const overdueClasses = (s.flags as any)?.unpaid_classes || 0;
      const overdueValue = (s.flags as any)?.unpaid_value || 0;

      // Rate per class: if overdueValue and overdueClasses exist, compute. Else fallback.
      let pricePerClass = 100;
      if (overdueClasses > 0 && overdueValue > 0) {
        pricePerClass = Math.round(overdueValue / overdueClasses);
      } else {
        const activePkg = studentPkgs.find(p => p.classes_remaining > 0) || studentPkgs[0] || null;
        pricePerClass = activePkg ? getPackageRate(activePkg, allInvoices, tiers) : 125;
      }

      let totalPaid = allInvoices
        .filter(inv => inv.student_id === s.id && inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      
      if (totalPaid === 0 && studentPkgs.length > 0) {
        studentPkgs.forEach(pkg => {
          const pkgRate = getPackageRate(pkg, allInvoices, tiers);
          const completed = pkg.classes_total - pkg.classes_remaining;
          totalPaid += completed * pkgRate;
        });
      }

      let daysSinceLastClass = 999;
      let lastAttendedStr = '—';
      if (s.last_attended) {
        const d = new Date(s.last_attended);
        const diffMs = today.getTime() - d.getTime();
        daysSinceLastClass = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        lastAttendedStr = d.toISOString().split('T')[0];
      } else if (studentAtts.length > 0) {
        const maxDate = studentAtts.reduce((latest, a) => {
          const d = new Date(a.date);
          return d > latest ? d : latest;
        }, new Date(0));
        daysSinceLastClass = Math.max(0, Math.floor((today.getTime() - maxDate.getTime()) / (1000 * 60 * 60 * 24)));
        lastAttendedStr = maxDate.toISOString().split('T')[0];
      }

      // Determine Bucket
      let bucket = 'HEALTHY';
      if (overdueClasses > 0) {
        bucket = 'OVERDUE';
      } else if (classesLeft === 0) {
        bucket = '0 LEFT';
      } else if (classesLeft >= 1 && classesLeft <= 5) {
        bucket = '1-5 LEFT';
      } else if (classesLeft >= 6 && classesLeft <= 10) {
        bucket = '6-10 LEFT';
      } else if (classesLeft >= 11 && classesLeft <= 20) {
        bucket = '11-20 LEFT';
      } else {
        bucket = '21+ LEFT';
      }

      const isStillAttending = daysSinceLastClass <= 120 && s.status === 'active';

      return {
        id: s.id,
        name: s.name,
        centre: centreName,
        coach: coachName,
        status: s.status,
        level: s.level,
        phone: family?.phone || '—',
        pkgs: pkgsCount,
        totalClasses,
        attDuration,
        attSessions,
        classesLeft,
        overdueClasses,
        pricePerClass,
        overdueValue,
        totalPaid,
        lastAttendedStr,
        daysSinceLastClass,
        bucket,
        isStillAttending
      };
    });

    // 1. Overdue Sheet Data
    const overdueData = studentRows
      .filter(r => r.isStillAttending && r.overdueClasses > 0)
      .sort((a, b) => a.centre.localeCompare(b.centre) || a.name.localeCompare(b.name))
      .map(r => ({
        'Student Name': r.name,
        'Centre': r.centre,
        'Coach': r.coach,
        'Status': r.status,
        'Level': r.level,
        'Mobile / WhatsApp': r.phone,
        'Pkgs': r.pkgs,
        'Package Paid - Total Classes': r.totalClasses,
        'Attendance (by Class Duration)': r.attDuration,
        'Attendance (by No. of Sessions)': r.attSessions,
        'Overdue Classes': r.overdueClasses,
        'Overdue (Sessions)': r.overdueClasses,
        'Price / Class': r.pricePerClass,
        'Unbilled Value (AED)': r.overdueValue,
        'Last Attended': r.lastAttendedStr,
        'Days Since': r.daysSinceLastClass === 999 ? '—' : r.daysSinceLastClass
      }));

    // 2. 0 Classes Left Sheet Data
    const zeroLeftData = studentRows
      .filter(r => r.isStillAttending && r.classesLeft === 0 && r.overdueClasses === 0)
      .sort((a, b) => a.centre.localeCompare(b.centre) || a.name.localeCompare(b.name))
      .map(r => ({
        'Student Name': r.name,
        'Centre': r.centre,
        'Coach': r.coach,
        'Status': r.status,
        'Level': r.level,
        'Mobile / WhatsApp': r.phone,
        'Pkgs': r.pkgs,
        'Package Paid - Total Classes': r.totalClasses,
        'Attendance (by Class Duration)': r.attDuration,
        'Attendance (by No. of Sessions)': r.attSessions,
        'Classes Left': r.classesLeft,
        'Classes Left (Sessions)': r.classesLeft,
        'Last Attended': r.lastAttendedStr,
        'Days Since': r.daysSinceLastClass === 999 ? '—' : r.daysSinceLastClass
      }));

    // 3. 1-5 Classes Left Sheet Data
    const oneToFiveLeftData = studentRows
      .filter(r => r.isStillAttending && r.classesLeft >= 1 && r.classesLeft <= 5)
      .sort((a, b) => a.centre.localeCompare(b.centre) || a.name.localeCompare(b.name))
      .map(r => ({
        'Student Name': r.name,
        'Centre': r.centre,
        'Coach': r.coach,
        'Status': r.status,
        'Level': r.level,
        'Mobile / WhatsApp': r.phone,
        'Pkgs': r.pkgs,
        'Package Paid - Total Classes': r.totalClasses,
        'Attendance (by Class Duration)': r.attDuration,
        'Attendance (by No. of Sessions)': r.attSessions,
        'Classes Left': r.classesLeft,
        'Classes Left (Sessions)': r.classesLeft,
        'Last Attended': r.lastAttendedStr,
        'Days Since': r.daysSinceLastClass === 999 ? '—' : r.daysSinceLastClass
      }));

    // 4. 6-10 Classes Left Sheet Data
    const sixToTenLeftData = studentRows
      .filter(r => r.isStillAttending && r.classesLeft >= 6 && r.classesLeft <= 10)
      .sort((a, b) => a.centre.localeCompare(b.centre) || a.name.localeCompare(b.name))
      .map(r => ({
        'Student Name': r.name,
        'Centre': r.centre,
        'Coach': r.coach,
        'Status': r.status,
        'Level': r.level,
        'Mobile / WhatsApp': r.phone,
        'Pkgs': r.pkgs,
        'Package Paid - Total Classes': r.totalClasses,
        'Attendance (by Class Duration)': r.attDuration,
        'Attendance (by No. of Sessions)': r.attSessions,
        'Classes Left': r.classesLeft,
        'Classes Left (Sessions)': r.classesLeft,
        'Last Attended': r.lastAttendedStr,
        'Days Since': r.daysSinceLastClass === 999 ? '—' : r.daysSinceLastClass
      }));

    // 5. Inactive List Sheet Data
    const inactiveListData = studentRows
      .filter(r => !r.isStillAttending)
      .sort((a, b) => a.centre.localeCompare(b.centre) || a.name.localeCompare(b.name))
      .map(r => ({
        'Student Name': r.name,
        'Centre': r.centre,
        'Coach': r.coach,
        'Status': r.status,
        'Level': r.level,
        'Mobile / WhatsApp': r.phone,
        'Pkgs': r.pkgs,
        'Package Paid - Total Classes': r.totalClasses,
        'Attendance (by Class Duration)': r.attDuration,
        'Attendance (by No. of Sessions)': r.attSessions,
        'Classes Left': r.classesLeft,
        'Overdue Classes': r.overdueClasses,
        'Unbilled Value (AED)': r.overdueValue,
        'Total Paid (AED)': r.totalPaid,
        'Last Attended': r.lastAttendedStr,
        'Days Since': r.daysSinceLastClass === 999 ? '—' : r.daysSinceLastClass,
        'Bucket': r.bucket
      }));

    // 6. Full Ledger Sheet Data
    const fullLedgerData = studentRows
      .sort((a, b) => a.centre.localeCompare(b.centre) || a.name.localeCompare(b.name))
      .map(r => ({
        'Student Name': r.name,
        'Centre': r.centre,
        'Coach': r.coach,
        'Status': r.status,
        'Level': r.level,
        'Mobile / WhatsApp': r.phone,
        'Pkgs': r.pkgs,
        'Package Paid - Total Classes': r.totalClasses,
        'Attendance (by Class Duration)': r.attDuration,
        'Attendance (by No. of Sessions)': r.attSessions,
        'Total Paid (AED)': r.totalPaid,
        'Classes Left': r.classesLeft,
        'Overdue Classes': r.overdueClasses,
        'Classes Left (Sessions)': r.classesLeft,
        'Overdue (Sessions)': r.overdueClasses,
        'Price / Class': r.pricePerClass,
        'Unbilled Value (AED)': r.overdueValue,
        'Last Attended': r.lastAttendedStr,
        'Days Since': r.daysSinceLastClass === 999 ? '—' : r.daysSinceLastClass,
        'Bucket': r.bucket,
        'Activity': r.isStillAttending ? 'Active' : 'Inactive'
      }));

    // 7. Package Timeline Sheet Data
    const packageTimelineData: any[] = [];
    // Group timeline rows by centre and name
    const timelineStudents = [...allStudents].sort((a, b) => {
      const centreA = allCentres.find(c => c.id === a.centre_id)?.name || 'Bay Avenue';
      const centreB = allCentres.find(c => c.id === b.centre_id)?.name || 'Bay Avenue';
      return centreA.localeCompare(centreB) || a.name.localeCompare(b.name);
    });

    timelineStudents.forEach(s => {
      const studentPkgs = allPackages.filter(p => p.student_id === s.id);
      const sortedPkgs = [...studentPkgs].sort((a, b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
      
      const centre = allCentres.find(c => c.id === s.centre_id);
      const centreName = centre?.name || 'Bay Avenue';

      sortedPkgs.forEach((pkg, idx) => {
        const pricePerClass = getPackageRate(pkg, allInvoices, tiers);
        const pkgPrice = pkg.tier_id ? Number(tiers.find((t: any) => t.id === pkg.tier_id)?.price || 1000) : 1000;
        const discount = pkg.discount_pct ? Number(pkg.discount_pct) : 0;
        const netPrice = Math.round(pkgPrice * (1 - discount / 100));

        packageTimelineData.push({
          'Student Name': s.name,
          'Centre': centreName,
          'Pkg #': idx + 1,
          'Type': pkg.kind === 'renewal' ? 'Renewal' : pkg.kind === 'new' ? 'New' : 'Tournament',
          'Classes': pkg.classes_total,
          'Price (AED)': netPrice,
          'Price / Class': pricePerClass,
          'Date of Payment': pkg.start_date ? new Date(pkg.start_date).toISOString().split('T')[0] : '—',
          'Classes Used': pkg.classes_total - pkg.classes_remaining,
          'Package Balance': pkg.classes_remaining
        });
      });
    });

    // Generate sheets and workbook
    const wb = XLSX.utils.book_new();
    
    const addSheet = (data: any[], sheetName: string) => {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet(overdueData, 'Overdue');
    addSheet(zeroLeftData, '0 Classes Left');
    addSheet(oneToFiveLeftData, '1-5 Classes Left');
    addSheet(sixToTenLeftData, '6-10 Classes Left');
    addSheet(inactiveListData, 'Inactive List');
    addSheet(fullLedgerData, 'Full Ledger');
    addSheet(packageTimelineData, 'Package Timeline');

    XLSX.writeFile(wb, `Master_Moves_Overdue_Report_Jul2026_1.xlsx`);
  };

  const SortTh = ({ col, children, right }: { col: string; children: React.ReactNode; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`text-[9px] font-bold text-muted-custom tracking-widest uppercase py-3 px-4 cursor-pointer select-none hover:text-ink whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {children}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  const segmentBadge = (seg: string) => {
    switch (seg) {
      case 'HOT':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'WARM':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  const formatLargeAmount = (val: number) => {
    if (val >= 1000000) {
      return `AED ${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `AED ${Math.round(val / 1000)}K`;
    }
    return `AED ${val.toLocaleString()}`;
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
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Payment &amp; Unbilled Register</h1>
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
        Payment &amp; unbilled register. What each student has paid, what they owe, and their rate — the financial source of truth.
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
          <optgroup label="Overdue Alert">
            <option value="HOT">HOT</option>
            <option value="WARM">WARM</option>
            <option value="COLD">COLD</option>
            <option value="HEALTHY">HEALTHY</option>
          </optgroup>
          <optgroup label="Pace Status">
            <option value="ENGAGED">ENGAGED</option>
            <option value="SLIPPING">SLIPPING</option>
            <option value="COLD">COLD</option>
          </optgroup>
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white border border-line rounded px-3 py-1 text-xs text-ink outline-none focus:border-forest w-40"
        />

        {(filterCentre !== 'All centres' || filterCoach !== 'All coaches' || filterSegment !== 'All segments' || filterEngagement !== 'All engagement' || search !== '') && (
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
            onClick={() => exportTableToCSV('#payment-table', 'payments_register.csv')}
            className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1"
          >
            ↓ Page Excel
          </button>
          <button 
            onClick={handleDownloadOverdueReportExcel}
            className="bg-forest hover:bg-emerald-700 active:scale-95 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
          >
            ↓ Overdue Excel Report
          </button>
          <button 
            onClick={exportToPDF}
            className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1"
          >
            ⎙ PDF
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className={`grid grid-cols-1 ${currentUser.role === 'front_desk' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 py-2`}>
        {/* LIFETIME COLLECTED */}
        {currentUser.role !== 'front_desk' && (
          <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm relative overflow-hidden">
            <div className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Lifetime Collected</div>
            <h2 className="text-2xl font-bold font-display text-ink mt-1">
              {formatLargeAmount(totalLifetimePaid)}
            </h2>
            <p className="text-[10px] text-muted-custom mt-0.5">{filtered.length} students</p>
          </div>
        )}

        {/* UNBILLED / OWED */}
        <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Unbilled / Owed</div>
          <h2 className="text-2xl font-bold font-display text-hot-custom mt-1">
            {formatLargeAmount(totalUnbilledOwed)}
          </h2>
          <p className="text-[10px] text-muted-custom mt-0.5">{totalOverdueClasses} classes</p>
        </div>

        {/* COLLECTION RATIO */}
        <div className="bg-surface border border-line rounded-[14px] p-5 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Collection Ratio</div>
          <h2 className="text-2xl font-bold font-display text-ink mt-1">
            {collectionRatio}%
          </h2>
          <p className="text-[10px] text-muted-custom mt-0.5">of billable value actually collected</p>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table id="payment-table" className="w-full border-collapse text-xs">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="py-2.5 px-4 text-left font-semibold text-muted-custom w-12">S.No</th>
                <SortTh col="studentName">Student</SortTh>
                <SortTh col="displayId">ID</SortTh>
                <SortTh col="centreName">Centre</SortTh>
                <SortTh col="coachName">Coach</SortTh>
                <SortTh col="rate" right>Rate / Class</SortTh>
                <SortTh col="totalPaid" right>Total Paid</SortTh>
                <SortTh col="overdueClasses" right>Overdue Classes</SortTh>
                <SortTh col="overdueValue" right>Overdue Value</SortTh>
                <SortTh col="lastPayment">Last Payment</SortTh>
                <SortTh col="overdueSegment">Segment</SortTh>
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
                filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedStudent(row)}
                    className="border-b border-line hover:bg-canvas/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-ink whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <a href={`/students?id=${row.id}`} className="text-forest hover:underline font-bold">
                          {row.studentName}
                        </a>
                        {row.hasUnpaidInvoice && (
                          <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider scale-90">
                            Unpaid
                          </span>
                        )}
                      </div>
                    </td>

                    {/* ID */}
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.displayId}</td>

                    {/* Centre */}
                    <td className="py-3 px-4 text-muted-custom whitespace-nowrap">{row.centreName}</td>

                    {/* Coach */}
                    <td className="py-3 px-4 text-[10px] font-semibold text-ink/90 whitespace-nowrap uppercase">{row.coachName}</td>

                    {/* Rate / Class */}
                    <td className="py-3 px-4 text-right font-mono text-ink">{row.rate}</td>

                    {/* Total Paid */}
                    <td className="py-3 px-4 text-right font-mono text-ink">
                      AED {row.totalPaid.toLocaleString()}
                    </td>

                    {/* Overdue Classes */}
                    <td className="py-3 px-4 text-right font-mono text-ink">{row.overdueClasses}</td>

                    {/* Overdue Value */}
                    <td className={`py-3 px-4 text-right font-mono font-bold ${row.overdueValue > 0 ? 'text-hot-custom' : 'text-ink'}`}>
                      AED {row.overdueValue.toLocaleString()}
                    </td>

                    {/* Last Payment */}
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.lastPayment}</td>

                    {/* Segment */}
                    <td className="py-3 px-4">
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full border uppercase ${getStatusBadgeClasses(row.overdueSegment as any)}`}>
                        {row.overdueSegment}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-[#173F35] text-white p-6 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-200 uppercase">Invoices & Payments</div>
                <h2 className="text-xl font-bold mt-1">{selectedStudent.studentName}</h2>
                <div className="text-xs text-emerald-200 mt-0.5">{selectedStudent.centreName}</div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
            </div>

            {/* List Body */}
            <div className="p-6 space-y-4 flex-1">
              <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">RAW INVOICES</h3>
              {studentInvoices.length === 0 ? (
                <p className="text-xs text-muted-custom py-4 text-center">No invoices found for this student.</p>
              ) : (
                <div className="space-y-3">
                  {studentInvoices.map((inv) => (
                    <div key={inv.id} className="border border-line rounded-lg p-3 flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-ink">AED {inv.amount}</div>
                        <div className="text-[10px] text-muted-custom">Created: {new Date(inv.created_at).toISOString().split('T')[0]}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={inv.status}
                          onChange={(e) => handleUpdateInvoiceStatus(inv.id, e.target.value)}
                          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
                        >
                          <option value="paid">Paid</option>
                          <option value="unpaid">Unpaid</option>
                        </select>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-red-200 text-hot-custom text-xs hover:bg-red-50"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-line bg-canvas">
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-full bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
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
