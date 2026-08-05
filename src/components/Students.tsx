"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Student, Package, Coach, Centre } from '../lib/db';
import { exportTableToCSV, exportToPDF } from '../lib/export';
import { computeStudentStatus, getStatusBadgeClasses, getPackageRate } from '../lib/segmentRules';
import { saveStudentDB, deleteStudentDB, syncDatabaseToClient, linkSiblingFamily } from '../app/actions';
import { useSearchParams } from 'next/navigation';

interface StudentsProps {
  currentUser: User;
  activeCentre: string;
}

export const Students: React.FC<StudentsProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents]   = useState<Student[]>([]);
  const [packages, setPackages]   = useState<Package[]>([]);
  const [coaches, setCoaches]     = useState<Coach[]>([]);
  const [centres, setCentres]     = useState<Centre[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [invoices, setInvoices]     = useState<any[]>([]);

  // Filters
  const [filterCentre, setFilterCentre]   = useState<string>('All centres');
  const [filterCoach, setFilterCoach]     = useState<string>('All coaches');
  const [filterSegment, setFilterSegment] = useState<string>('All segments');
  const [filterLevel, setFilterLevel]     = useState<string>('All levels');
  const [filterEngagement, setFilterEngagement] = useState<string>('All engagement');
  const [filterStatus, setFilterStatus]   = useState<string>('All');
  const [filterHeat, setFilterHeat]       = useState<string>('All urgency');
  const [search, setSearch]               = useState<string>('');

  const handleResetFilters = () => {
    setFilterCentre('All centres');
    setFilterCoach('All coaches');
    setFilterSegment('All segments');
    setFilterLevel('All levels');
    setFilterEngagement('All engagement');
    setFilterStatus('All');
    setFilterHeat('All urgency');
    setSearch('');
  };

  // Detail panel / Edit
  const [selected, setSelected] = useState<Student | null>(null);
  const [sortCol, setSortCol]   = useState<string>('name');
  const [sortAsc, setSortAsc]   = useState<boolean>(true);
  const [selectedSiblingId, setSelectedSiblingId] = useState<string>('');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editFideId, setEditFideId] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editChessCom, setEditChessCom] = useState('');
  const [editLichess, setEditLichess] = useState('');
  const [editFideRating, setEditFideRating] = useState('');
  const [editCoachId, setEditCoachId] = useState('');
  const [editCentreId, setEditCentreId] = useState('');
  
  // Extra fields
  const [editFideCountry, setEditFideCountry] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editAlternateCentre, setEditAlternateCentre] = useState('');
  const [editResidentStatus, setEditResidentStatus] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReferralSource, setEditReferralSource] = useState('');

  useEffect(() => {
    if (selected) {
      setEditName(selected.name);
      setEditLevel(selected.level || 'Beginner');
      setEditStatus(selected.status);
      setEditFideId(selected.fide_id || '');
      setEditDob(selected.dob ? new Date(selected.dob).toISOString().split('T')[0] : '');
      setEditGender(selected.gender || 'Male');
      setEditSchool(selected.school || '');
      setEditChessCom(selected.chess_com_username || '');
      setEditLichess(selected.lichess_username || '');
      setEditFideRating(selected.fide_rating ? String(selected.fide_rating) : '');
      setEditCoachId(selected.coach_id || '');
      setEditCentreId(selected.centre_id || '');
      
      setEditFideCountry(selected.fide_country || '');
      setEditParentName(selected.parent_name || '');
      setEditAlternateCentre(selected.alternate_centre || '');
      setEditResidentStatus(selected.resident_status || '');
      setEditAddress(selected.address || '');
      setEditCategory(selected.category || '');
      setEditNotes(selected.notes || '');
      setEditReferralSource(selected.referral_source || '');
      setIsEditing(false);
    }
  }, [selected]);

  const handleSaveStudent = async () => {
    if (!selected) return;
    try {
      await saveStudentDB({
        ...selected,
        name: editName,
        level: editLevel,
        status: editStatus,
        fide_id: editFideId || null,
        dob: editDob ? new Date(editDob).toISOString() : null,
        gender: editGender,
        school: editSchool,
        chess_com_username: editChessCom || null,
        lichess_username: editLichess || null,
        fide_rating: editFideRating ? Number(editFideRating) : null,
        coach_id: editCoachId || null,
        centre_id: editCentreId,
        fide_country: editFideCountry || null,
        parent_name: editParentName || null,
        alternate_centre: editAlternateCentre || null,
        resident_status: editResidentStatus || null,
        address: editAddress || null,
        category: editCategory || null,
        notes: editNotes || null,
        referral_source: editReferralSource || null
      });
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setIsEditing(false);
      setSelected(null);
      alert('✓ Student updated successfully.');
    } catch (e: any) {
      alert('Error updating student: ' + e.message);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selected) return;
    if (!confirm(`Are you sure you want to delete ${selected.name}? This will remove all their packages and logs.`)) return;
    try {
      await deleteStudentDB(selected.id);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      setSelected(null);
      alert('✓ Student deleted successfully.');
    } catch (e: any) {
      alert('Error deleting student: ' + e.message);
    }
  };

  const handleLinkSibling = async () => {
    if (!selected || !selectedSiblingId) return;
    try {
      await linkSiblingFamily(selectedSiblingId, selected.family_id);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      refresh();
      
      // Update selected student record with fresh details to refresh sibling list immediately
      const freshStudents = db.getStudents();
      const updated = freshStudents.find(s => s.id === selected.id);
      if (updated) setSelected(updated);

      setSelectedSiblingId('');
      alert('✓ Sibling linked successfully under the same family.');
    } catch (e: any) {
      alert('Error linking sibling: ' + e.message);
    }
  };

  const refresh = () => {
    setStudents(db.getStudents());
    setPackages(db.getPackages());
    setCoaches(db.getCoaches());
    setCentres(db.getCentres());
    setAttendance(db.getAttendance());
    setInvoices(db.get<any>('invoices'));
  };

  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');

  useEffect(() => {
    refresh();
    window.addEventListener('db-synced', refresh);
    return () => window.removeEventListener('db-synced', refresh);
  }, []);

  useEffect(() => {
    if (idParam && students.length > 0) {
      const match = students.find(s => s.id === idParam);
      if (match) {
        setSelected(match);
      }
    }
  }, [idParam, students]);


  // Determine coach record for isolation
  const coachRecord = useMemo(() => {
    if (currentUser.role === 'coach') {
      return coaches.find(c => c.user_id === currentUser.id) || null;
    }
    return null;
  }, [currentUser, coaches]);

  // ── Per-student computed metrics ─────────────────────────────────────────
  const enriched = useMemo(() => {
    const today = new Date();
    return students.map(s => {
      // Active package
      const pkgs = packages
        .filter(p => p.student_id === s.id && !p.frozen)
        .sort((a, b) => new Date(a.start_date || '').getTime() - new Date(b.start_date || '').getTime());
      const classesLeft  = pkgs.reduce((sum, p) => sum + p.classes_remaining, 0);
      const pkgSize      = pkgs.reduce((sum, p) => sum + p.classes_total, 0);
      const completed    = Math.max(0, pkgSize - classesLeft);

      // Days since last class
      const daysSince    = s.last_attended
        ? Math.floor((today.getTime() - new Date(s.last_attended).getTime()) / 86400000)
        : 999;

      // 30D / 90D classes calculated from real attendance
      const studentAtts  = attendance.filter(a => a.student_id === s.id && a.status === 'present');
      let cls30d = 0;
      let cls90d = 0;
      studentAtts.forEach(a => {
        const diffDays = Math.floor((today.getTime() - new Date(a.date).getTime()) / 86400000);
        const dur = a.duration ?? 2;
        if (diffDays >= 0 && diffDays <= 30) cls30d += dur;
        if (diffDays >= 0 && diffDays <= 90) cls90d += dur;
      });

      // Rate per class
      const tiers        = db.get<Tier>('tiers');
      const activePkg    = pkgs.find(p => p.classes_remaining > 0) || pkgs[0] || null;
      const rate         = activePkg ? getPackageRate(activePkg, invoices, tiers) : 125;
      const paidToDate   = completed * rate;

      // Segment
      const segment      = s.level
        ? (s.level === 'Pro-Track' ? 'Pro-Track'
          : s.level === 'Advanced' ? 'Juniors-Advanced'
          : s.level === 'Intermediate' ? 'Juniors-Intermediate B'
          : 'Early Starters-Beginner 2')
        : 'Not set';

      // Segment & Heat mapping using domain rules
      const statusInfo   = computeStudentStatus(s, packages, attendance, invoices);
      const engagement   = daysSince <= 14 ? 'ENGAGED'
        : daysSince <= 30 ? 'SLIPPING'
        : daysSince <= 60 ? 'COLD'
        : 'DORMANT';

      const heat         = statusInfo.segment;

      const coach        = coaches.find(c => c.id === s.coach_id);
      const centre       = centres.find(c => c.id === s.centre_id);
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
  }, [students, packages, coaches, centres, attendance]);

  // Filter + sort
  // Filter + sort
  const filtered = useMemo(() => {
    let rows = enriched;
    if (filterStatus !== 'All') {
      rows = rows.filter(r => r.status?.toLowerCase() === filterStatus.toLowerCase());
    }
    
    // Apply coach role isolation
    if (currentUser.role === 'coach' && coachRecord) {
      rows = rows.filter(r => r.coach_id === coachRecord.id);
    }

    if (filterCentre !== 'All centres') rows = rows.filter(r => r.centreName === filterCentre);
    if (filterCoach  !== 'All coaches')  rows = rows.filter(r => r.coachName === filterCoach);
    if (filterSegment !== 'All segments') rows = rows.filter(r => r.segment === filterSegment);
    if (filterLevel !== 'All levels') rows = rows.filter(r => r.level === filterLevel);
    if (filterEngagement !== 'All engagement') rows = rows.filter(r => r.engagement === filterEngagement);
    if (filterHeat !== 'All urgency') rows = rows.filter(r => r.heat === filterHeat);
    if (search) rows = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.displayId.toLowerCase().includes(search.toLowerCase()));

    // Sorting by recent attendance (daysSince asc) by default for coach, or by column
    return rows.sort((a, b) => {
      let av: any = (a as any)[sortCol] ?? '';
      let bv: any = (b as any)[sortCol] ?? '';
      
      if (sortCol === 'daysSince') {
        av = av === null ? 999 : av;
        bv = bv === null ? 999 : bv;
      }
      
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [enriched, filterCentre, filterCoach, filterSegment, filterLevel, filterEngagement, filterStatus, filterHeat, search, sortCol, sortAsc, currentUser, coachRecord]);

  // Coach-specific metrics
  const coachStats = useMemo(() => {
    const coachStudents = enriched.filter(s => s.status !== 'inactive' && s.coach_id === (coachRecord?.id || ''));
    const totalCount = coachStudents.length;
    const engagedCount = coachStudents.filter(s => s.engagement === 'ENGAGED').length;
    const slippingOrDormantCount = coachStudents.filter(s => s.engagement === 'SLIPPING' || s.engagement === 'DORMANT').length;
    
    return {
      totalCount,
      engagedCount,
      slippingOrDormantCount
    };
  }, [enriched, coachRecord]);

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

  const engagementBadge = (e: string) => {
    if (e === 'ENGAGED')  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (e === 'SLIPPING') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (e === 'COLD')     return 'bg-slate-100 text-slate-500 border-slate-200';
    return 'bg-orange-100 text-orange-700 border-orange-200'; // DORMANT
  };

  // Render Coach-specific "My Students" view
  if (currentUser.role === 'coach') {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8 text-ink">
        
        {/* Top Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">OUTPUT</div>
            <h1 className="text-3xl font-bold font-display text-ink mt-1">My Students</h1>
            <p className="text-sm text-muted-custom mt-1">
              {currentUser.name} · {coachStats.totalCount} students · {coachStats.engagedCount} engaged
            </p>
          </div>

          <select 
            value={filterCentre}
            onChange={e => setFilterCentre(e.target.value)}
            className="bg-white border border-line rounded-lg px-4 py-2 text-xs text-ink outline-none cursor-pointer"
          >
            <option>All centres</option>
            {centres.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* Slipping/Dormant Warning Notice */}
        {coachStats.slippingOrDormantCount > 0 && (
          <div className="p-4 rounded-[12px] bg-[#FBF2E7] border border-[#EAD5AE] border-l-4 border-l-[#C4A249] flex gap-3 text-xs leading-relaxed text-[#7a5a1e]">
            <span className="text-xl">⚏</span>
            <div>
              <b className="text-[#6d4f0c] block font-bold">{coachStats.slippingOrDormantCount} of your students are slipping or dormant</b>
              <span>A short message from you — their coach — recovers more of these than any front-desk call.</span>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
              <span className="text-forest">⚏</span> My students
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => exportTableToCSV('#coach-students-table', 'my_students.csv')}
                className="bg-white border border-line text-ink font-bold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1 cursor-pointer transition-all"
              >
                ↓ Excel
              </button>
              <button 
                onClick={exportToPDF}
                className="bg-white border border-line text-ink font-bold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-canvas flex items-center gap-1 cursor-pointer transition-all"
              >
                ⎙ PDF
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-custom mb-6">Ranked by recent attendance.</p>

          <div className="overflow-x-auto">
            <table id="coach-students-table" className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left text-muted-custom text-[9px] uppercase tracking-wider font-bold">
                  <th className="py-3 px-4 w-12">S.No</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4 text-right">Classes Left</th>
                  <th className="py-3 px-4 text-right">30D</th>
                  <th className="py-3 px-4 text-right">90D</th>
                  <th className="py-3 px-4 text-right">Days Since</th>
                  <th className="py-3 px-4">State</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-custom py-8">
                      No active students found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row.id} className="border-b border-line hover:bg-canvas/50 transition-all font-medium text-ink">
                      <td className="py-4 px-4 font-mono text-muted-custom text-xs w-12">{idx + 1}</td>
                      <td className="py-4 px-4 font-bold text-ink flex items-center gap-2">
                        {row.photo_url ? (
                          <img src={row.photo_url} alt="" className="w-6 h-6 object-cover rounded-full border border-line" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-canvas border border-line flex items-center justify-center text-[10px] text-muted-custom font-bold">
                            {row.name.charAt(0)}
                          </div>
                        )}
                        <a href={`/student-dashboard?studentId=${row.id}`} className="hover:text-forest hover:underline">
                          {row.name}
                        </a>
                      </td>
                      <td className="py-4 px-4 text-muted-custom text-xs">{row.level || '—'}</td>
                      <td className={`py-4 px-4 text-right font-mono font-bold ${row.classesLeft <= 0 ? 'text-hot-custom' : 'text-ink'}`}>
                        {row.classesLeft}
                      </td>
                      <td className="py-4 px-4 text-right font-mono">{row.cls30d}</td>
                      <td className="py-4 px-4 text-right font-mono">{row.cls90d}</td>
                      <td className="py-4 px-4 text-right font-mono">
                        {row.daysSince === null ? '—' : row.daysSince}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${engagementBadge(row.engagement)}`}>
                          {row.engagement}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  // Fallback to Admin Student Register View
  const uniqueCoaches  = [...new Set(enriched.map(r => r.coachName))].sort();
  const uniqueSegments = [...new Set(enriched.map(r => r.segment))].sort();

  return (
    <div className="p-6 max-w-full mx-auto w-full space-y-4 text-ink">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">OUTPUT · RAW</div>
          <h1 className="text-2xl font-bold font-display text-ink mt-0.5">Student Register</h1>
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
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All levels</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
          <option value="Pro-Track">Pro-Track</option>
        </select>

        <select
          value={filterEngagement}
          onChange={e => setFilterEngagement(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All engagement</option>
          <option value="ENGAGED">ENGAGED</option>
          <option value="SLIPPING">SLIPPING</option>
          <option value="COLD">COLD</option>
          <option value="DORMANT">DORMANT</option>
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option value="All">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
          <option value="left">Left Only</option>
        </select>

        <select
          value={filterHeat}
          onChange={e => setFilterHeat(e.target.value)}
          className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
        >
          <option>All urgency</option>
          <option value="HOT">HOT</option>
          <option value="WARM">WARM</option>
          <option value="COLD">COLD</option>
          <option value="HEALTHY">HEALTHY</option>
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white border border-line rounded px-3 py-1 text-xs text-ink outline-none focus:border-forest w-40"
        />

        {(filterCentre !== 'All centres' || filterCoach !== 'All coaches' || filterSegment !== 'All segments' || filterLevel !== 'All levels' || filterEngagement !== 'All engagement' || filterStatus !== 'All' || filterHeat !== 'All urgency' || search !== '') && (
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
            onClick={() => exportTableToCSV('#student-table', 'student_register.csv')}
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

      {/* Main Grid */}
      <div className="bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table id="student-table" className="w-full border-collapse text-xs">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="py-2.5 px-4 text-left font-semibold text-muted-custom w-12">S.No</th>
                <SortTh col="name">Student</SortTh>
                <SortTh col="displayId">ID</SortTh>
                <SortTh col="centreName">Centre</SortTh>
                <SortTh col="coachName">Coach</SortTh>
                <SortTh col="classesLeft" right>Left</SortTh>
                <SortTh col="pkgSize" right>Size</SortTh>
                <SortTh col="cls30d" right>30D</SortTh>
                <SortTh col="cls90d" right>90D</SortTh>
                <SortTh col="daysSince" right>Days Since</SortTh>
                <SortTh col="engagement">Engagement</SortTh>
                <SortTh col="heat">Heat</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-custom">
                    No students match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="border-b border-line hover:bg-canvas/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-ink whitespace-nowrap flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {row.photo_url ? (
                        <img src={row.photo_url} alt="" className="w-6 h-6 object-cover rounded-full border border-line" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-canvas border border-line flex items-center justify-center text-[10px] text-muted-custom font-bold">
                          {row.name.charAt(0)}
                        </div>
                      )}
                      <a href={`/student-dashboard?studentId=${row.id}`} className="hover:text-forest hover:underline">
                        {row.name}
                      </a>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-custom whitespace-nowrap">{row.displayId}</td>
                    <td className="py-3 px-4 text-muted-custom whitespace-nowrap">{row.centreName}</td>
                    <td className="py-3 px-4 text-muted-custom whitespace-nowrap">{row.coachName}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${row.classesLeft <= 0 ? 'text-hot-custom' : 'text-ink'}`}>{row.classesLeft}</td>
                    <td className="py-3 px-4 text-right font-mono text-muted-custom">{row.pkgSize}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.cls30d}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.cls90d}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.daysSince === null ? '—' : row.daysSince}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${engagementBadge(row.engagement)}`}>
                        {row.engagement}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[9px] px-2 py-0.5 rounded border uppercase ${getStatusBadgeClasses(row.heat as any)}`}>
                        {row.heat}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Student Detail Panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="bg-[#173F35] text-white p-6 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-200 uppercase">Student Profile</div>
                <h2 className="text-xl font-bold mt-1">{selected.name}</h2>
                <div className="text-xs text-emerald-200 mt-0.5">ID: {selected.displayId}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {isEditing ? (
                <>
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
                    <label className="text-xs font-bold text-ink">Date of Birth</label>
                    <input 
                      type="date" 
                      value={editDob}
                      onChange={e => setEditDob(e.target.value)}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Gender</label>
                    <select
                      value={editGender}
                      onChange={e => setEditGender(e.target.value)}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">School</label>
                    <input 
                      type="text" 
                      value={editSchool}
                      onChange={e => setEditSchool(e.target.value)}
                      placeholder="e.g. Dubai British School"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Performance Level</label>
                    <select
                      value={editLevel}
                      onChange={e => setEditLevel(e.target.value)}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    >
                      <option value="Beginner 1">Beginner 1</option>
                      <option value="Beginner 2">Beginner 2</option>
                      <option value="Intermediate 1">Intermediate 1</option>
                      <option value="Intermediate 2">Intermediate 2</option>
                      <option value="Advanced">Advanced</option>
                      <option value="FIDE">FIDE</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Status</label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    >
                      <option 
                        value="active" 
                        disabled={(selected?.status === 'inactive' || selected?.status === 'pending_inactive') && currentUser?.role !== 'owner'}
                      >
                        Active {(selected?.status === 'inactive' || selected?.status === 'pending_inactive') && currentUser?.role !== 'owner' ? ' (Owner only)' : ''}
                      </option>
                      <option value="inactive">
                        Inactive {currentUser?.role !== 'owner' ? ' (requires Owner Approval)' : ''}
                      </option>
                      {selected?.status === 'pending_inactive' && (
                        <option value="pending_inactive">Pending Inactive</option>
                      )}
                      <option value="frozen">Frozen</option>
                      <option value="left">Left</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Centre</label>
                    <select
                      value={editCentreId}
                      onChange={e => setEditCentreId(e.target.value)}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    >
                      {centres.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Assigned Coach</label>
                    <select
                      value={editCoachId}
                      onChange={e => setEditCoachId(e.target.value)}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    >
                      <option value="">Unassigned</option>
                      {coaches.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">FIDE ID</label>
                    <input 
                      type="text" 
                      value={editFideId}
                      onChange={e => setEditFideId(e.target.value)}
                      placeholder="e.g. 12345678"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">FIDE Rating</label>
                    <input 
                      type="number" 
                      value={editFideRating}
                      onChange={e => setEditFideRating(e.target.value)}
                      placeholder="e.g. 1400"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Chess.com Username</label>
                    <input 
                      type="text" 
                      value={editChessCom}
                      onChange={e => setEditChessCom(e.target.value)}
                      placeholder="e.g. username"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Lichess Username</label>
                    <input 
                      type="text" 
                      value={editLichess}
                      onChange={e => setEditLichess(e.target.value)}
                      placeholder="e.g. username"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Parent Name</label>
                    <input 
                      type="text" 
                      value={editParentName}
                      onChange={e => setEditParentName(e.target.value)}
                      placeholder="Parent's Name"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">FIDE Country</label>
                    <input 
                      type="text" 
                      value={editFideCountry}
                      onChange={e => setEditFideCountry(e.target.value)}
                      placeholder="e.g. UAE"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Alternate Centre</label>
                    <input 
                      type="text" 
                      value={editAlternateCentre}
                      onChange={e => setEditAlternateCentre(e.target.value)}
                      placeholder="Alternate Centre"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Resident Status</label>
                    <input 
                      type="text" 
                      value={editResidentStatus}
                      onChange={e => setEditResidentStatus(e.target.value)}
                      placeholder="e.g. Yes/No"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Age Level (Category)</label>
                    <select 
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    >
                      <option value="">Select Category...</option>
                      <option value="Early Starts">Early Starts</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-ink">Referral Source</label>
                    <input 
                      type="text" 
                      value={editReferralSource}
                      onChange={e => setEditReferralSource(e.target.value)}
                      placeholder="e.g. Recommendation"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-bold text-ink">Address</label>
                    <input 
                      type="text" 
                      value={editAddress}
                      onChange={e => setEditAddress(e.target.value)}
                      placeholder="Home Address"
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-bold text-ink">Notes</label>
                    <textarea 
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="Additional Notes..."
                      className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest min-h-[60px]"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs border-b border-line pb-4">
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Level</span>
                      <b className="text-ink">{selected.level || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Status</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${selected.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {selected.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Centre</span>
                      <b className="text-ink">{selected.centreName || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Coach</span>
                      <b className="text-ink">{selected.coachName || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Date of Birth</span>
                      <b className="text-ink">{selected.dob ? new Date(selected.dob).toISOString().split('T')[0] : '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Gender</span>
                      <b className="text-ink">{selected.gender || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">School</span>
                      <b className="text-ink">{selected.school || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">FIDE ID</span>
                      <b className="text-ink">{selected.fide_id || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">FIDE Rating</span>
                      <b className="text-ink">{selected.fide_rating || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Parent Name</span>
                      <b className="text-ink">{selected.parent_name || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">FIDE Country</span>
                      <b className="text-ink">{selected.fide_country || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Alternate Centre</span>
                      <b className="text-ink">{selected.alternate_centre || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Resident Status</span>
                      <b className="text-ink">{selected.resident_status || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Student Category</span>
                      <b className="text-ink">{selected.category || '—'}</b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Referral Source</span>
                      <b className="text-ink">{selected.referral_source || '—'}</b>
                    </div>
                    <div className="col-span-2 border-t border-line/50 pt-2 mt-1">
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Address</span>
                      <b className="text-ink">{selected.address || '—'}</b>
                    </div>
                    <div className="col-span-2 border-t border-line/50 pt-2 mt-1">
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Notes</span>
                      <p className="text-ink whitespace-pre-wrap">{selected.notes || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Chess.com</span>
                      <b className="text-ink">
                        {selected.chess_com_username ? (
                          <a href={`https://chess.com/member/${selected.chess_com_username}`} target="_blank" rel="noopener noreferrer" className="text-forest hover:underline">{selected.chess_com_username}</a>
                        ) : '—'}
                      </b>
                    </div>
                    <div>
                      <span className="text-muted-custom block uppercase tracking-wider text-[9px]">Lichess</span>
                      <b className="text-ink">
                        {selected.lichess_username ? (
                          <a href={`https://lichess.org/@/${selected.lichess_username}`} target="_blank" rel="noopener noreferrer" className="text-forest hover:underline">{selected.lichess_username}</a>
                        ) : '—'}
                      </b>
                    </div>
                  </div>

                  {/* Documents & File Attachments */}
                  <div className="pt-4 border-t border-line space-y-3">
                    <span className="text-muted-custom block uppercase tracking-wider text-[10px] font-bold">Uploaded Documents</span>
                    
                    <div className="space-y-2.5 text-xs">
                      {/* Photo */}
                      <div className="flex items-center justify-between bg-canvas/30 p-2.5 rounded-lg border border-line">
                        <span className="font-semibold text-ink">Student Photo</span>
                        {selected.photo_url ? (
                          <div className="flex items-center gap-2">
                            <img src={selected.photo_url} alt="" className="w-8 h-8 object-cover rounded-full border border-line" />
                            <a href={selected.photo_url} target="_blank" rel="noreferrer" className="text-forest font-bold hover:underline">Watch ↗</a>
                          </div>
                        ) : (
                          <span className="text-muted-custom text-[11px]">Not uploaded</span>
                        )}
                      </div>

                      {/* Registration Form */}
                      <div className="flex items-center justify-between bg-canvas/30 p-2.5 rounded-lg border border-line">
                        <span className="font-semibold text-ink">Registration Form</span>
                        {(selected.flags as any)?.reg_form_url ? (
                          <a href={(selected.flags as any).reg_form_url} target="_blank" rel="noreferrer" className="text-forest font-bold hover:underline">Watch Document ↗</a>
                        ) : (
                          <span className="text-muted-custom text-[11px]">Not uploaded</span>
                        )}
                      </div>

                      {/* Emirates ID */}
                      <div className="flex items-center justify-between bg-canvas/30 p-2.5 rounded-lg border border-line">
                        <span className="font-semibold text-ink">Emirates ID / Passport</span>
                        {(selected.flags as any)?.emirates_id_url ? (
                          <a href={(selected.flags as any).emirates_id_url} target="_blank" rel="noreferrer" className="text-forest font-bold hover:underline">Watch Document ↗</a>
                        ) : (
                          <span className="text-muted-custom text-[11px]">Not uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Family & Siblings Panel */}
                  <div className="pt-4 border-t border-line space-y-3">
                    <span className="text-muted-custom block uppercase tracking-wider text-[10px] font-bold">Family & Siblings</span>
                    
                    {students.filter(s => s.family_id === selected.family_id && s.id !== selected.id).length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-[11px] text-muted-custom">Linked family members:</div>
                        {students.filter(s => s.family_id === selected.family_id && s.id !== selected.id).map(sib => (
                          <div key={sib.id} className="flex justify-between items-center bg-[#F4F9F6] border border-line rounded-lg px-2.5 py-1.5 text-xs">
                            <span className="font-semibold text-ink">{sib.name}</span>
                            <a href={`/students?id=${sib.id}`} className="text-forest hover:underline font-bold text-[10px]">View Profile ↗</a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-custom italic">No siblings linked under this family record.</div>
                    )}

                    <div className="bg-canvas/30 p-2.5 rounded-lg border border-line space-y-2 mt-2">
                      <div className="text-[11px] font-bold text-ink">Link another student as sibling:</div>
                      <div className="flex gap-2">
                        <select
                          value={selectedSiblingId}
                          onChange={e => setSelectedSiblingId(e.target.value)}
                          className="flex-1 bg-white border border-line rounded-lg px-2 py-1.5 text-[11px] text-ink outline-none"
                        >
                          <option value="">Select student to link...</option>
                          {students
                            .filter(s => s.id !== selected.id && s.family_id !== selected.family_id)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))
                          }
                        </select>
                        <button
                          onClick={handleLinkSibling}
                          disabled={!selectedSiblingId}
                          className="bg-forest hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Link Sibling
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-line">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full bg-white border border-line text-ink font-bold text-xs py-2 rounded-lg hover:bg-canvas"
                    >
                      Edit Student info
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleDeleteStudent}
                      className="w-full bg-red-50 border border-red-200 text-hot-custom font-bold text-xs py-2 rounded-lg hover:bg-red-100"
                    >
                      ⚠️ Delete Student
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="p-6 border-t border-line bg-canvas flex gap-3">
                <button
                  onClick={handleSaveStudent}
                  className="flex-1 bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-all"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-white border border-line text-ink font-bold text-xs px-4 py-2.5 rounded-lg hover:bg-canvas"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
