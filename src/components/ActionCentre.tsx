"use client";

import React, { useState, useEffect } from 'react';
import { getActionCentreData, renewPackage, approveStudentInactive, syncDatabaseToClient } from '../app/actions';
import { exportTableToCSV, exportToPDF } from '../lib/export';
import { useRouter } from 'next/navigation';
import { db } from '../lib/db';

interface ActionCentreProps {
  currentUser: any;
  activeCentre: string;
}

export const ActionCentre: React.FC<ActionCentreProps> = ({ currentUser, activeCentre }) => {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [pendingInactives, setPendingInactives] = useState<any[]>([]);
  
  const [selectedCentre, setSelectedCentre] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const handleApproveInactive = async (studentId: string) => {
    if (!confirm("Are you sure you want to approve this student's inactivation? This will set remaining classes to 0 and remove slot enrollments.")) return;
    setLoading(true);
    try {
      await approveStudentInactive(studentId);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      loadData();
      alert("✓ Student inactivation approved.");
    } catch (e: any) {
      alert("Error approving inactivation: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadData = () => {
    try {
      const stds = db.getStudents();
      const cens = db.getCentres();
      const coas = db.getCoaches();
      const trs = db.getTiers();
      const pkgs = db.getPackages();

      // Enrich students with packages & coaches for ActionCentre metrics
      const enrichedStudents = stds.map(s => {
        const studentPkgs = pkgs.filter(p => p.student_id === s.id);
        const coachMatch = coas.find(c => c.id === s.coach_id);
        const centreMatch = cens.find(c => c.id === s.centre_id);
        return {
          ...s,
          packages: studentPkgs,
          coach: coachMatch ? { user: { name: coachMatch.name } } : null,
          centre: centreMatch ? { name: centreMatch.name } : null
        };
      });

      setStudents(enrichedStudents);
      setCentres(cens);
      setCoaches(coas);
      setTiers(trs);
      setPendingInactives(enrichedStudents.filter(s => s.status === 'pending_inactive'));
    } catch (error) {
      console.error("Error loading action centre data from local DB:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  // Sync prop activeCentre to local selectedCentre state on initial load
  useEffect(() => {
    if (activeCentre) {
      setSelectedCentre(activeCentre);
    }
  }, [activeCentre]);

  // Filter students based on selected centre
  const getFilteredStudents = () => {
    return students.filter(s => {
      if (selectedCentre !== 'All' && s.centre_id !== selectedCentre) return false;
      return true;
    });
  };

  const filteredStudents = getFilteredStudents();

  // List 1: Students attending with no paid packages (unpaid classes > 0)
  const unpaidStudents = filteredStudents.filter(s => {
    return ((s.flags as any)?.unpaid_classes || 0) > 0;
  });

  // Sort unpaid students by classes unpaid descending
  const sortedUnpaidStudents = [...unpaidStudents].sort((a, b) => {
    const aVal = (a.flags as any)?.unpaid_classes || 0;
    const bVal = (b.flags as any)?.unpaid_classes || 0;
    return bVal - aVal;
  });

  // Calculate unpaid aggregates
  const invoiceNowCount = unpaidStudents.length;
  const recoverableAmount = unpaidStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const classesGivenAway = unpaidStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);

  // List 2: Expiring packages (classes left <= 3, classes left > 0)
  const expiringPackages: any[] = [];
  filteredStudents.forEach(s => {
    const studentPkgs = s.packages || [];
    const totalRemaining = studentPkgs.reduce((sum, pkg) => sum + pkg.classes_remaining, 0);
    
    // Sort packages by start_date asc
    const sortedPkgs = [...studentPkgs].sort((a, b) => new Date(a.start_date || '').getTime() - new Date(b.start_date || '').getTime());
    
    sortedPkgs.forEach((pkg, idx) => {
      const isLatest = idx === sortedPkgs.length - 1;
      const pctLeft = pkg.classes_total > 0 ? Math.round((pkg.classes_remaining / pkg.classes_total) * 100) : 0;
      
      let shouldInclude = false;
      if (pkg.classes_remaining > 0) {
        shouldInclude = (pctLeft <= 20 || totalRemaining <= 3);
      } else if (pkg.classes_remaining === 0 && isLatest && totalRemaining === 0) {
        shouldInclude = true;
      }

      if (shouldInclude && !pkg.frozen) {
        const rawCoachName = s.coach?.user?.name || 'Unassigned';
        const displayCoachName = rawCoachName === 'Unassigned' ? 'Unassigned' : rawCoachName.split(' ')[0].toUpperCase();
        expiringPackages.push({
          id: pkg.id,
          studentId: s.id,
          studentName: s.name,
          centreName: s.centre?.name || 'Bay Avenue',
          coachName: displayCoachName,
          packageName: `#${idx + 1} ${pkg.kind === 'renewal' ? 'Renewal' : pkg.kind === 'new' ? 'New' : 'Tournament'}`,
          paid: pkg.classes_total,
          used: pkg.classes_total - pkg.classes_remaining,
          left: pkg.classes_remaining,
          pctLeft,
          thresholdTrigger: pctLeft <= 20
        });
      }
    });
  });

  // Sort expiring packages by fewest classes remaining first
  const sortedExpiringPackages = [...expiringPackages].sort((a, b) => a.left - b.left);
  const renewNowCount = sortedExpiringPackages.length;

  // Calculate expiring counts per centre
  const bayAvenueCentre = centres.find(c => c.name.toLowerCase().includes('bay avenue'));
  const jltCentre = centres.find(c => c.name.toLowerCase().includes('jlt'));

  const expiringBayAvenue = expiringPackages.filter(p => bayAvenueCentre && p.centreName === bayAvenueCentre.name).length;
  const expiringJlt = expiringPackages.filter(p => jltCentre && p.centreName === jltCentre.name).length;
  const totalToRenew = expiringPackages.length;

  const handleAction = async (studentId: string) => {
    setLoading(true);
    try {
      const student = students.find(s => s.id === studentId);
      // Determine existing package tier or default to first/core tier
      const currentTierId = student?.packages?.[0]?.tier_id || tiers[1]?.id || tiers[0]?.id || 't-core-id';
      const res = await renewPackage(studentId, currentTierId, 'renewal');
      if (res && !res.success) {
        throw new Error(res.error);
      }
      setMessage('✓ Invoice generated and package renewed successfully!');
      setTimeout(() => setMessage(''), 4000);
      
      // Reload from DB
      await loadData();
      window.dispatchEvent(new Event('db-synced'));
    } catch (e: any) {
      alert('Error updating record: ' + e.message);
      setLoading(false);
    }
  };

  const getCoachName = (coach: any) => {
    if (!coach || !coach.user) return 'Unassigned';
    return coach.user.name.split(' ')[0].toUpperCase();
  };

  if (loading && students.length === 0) {
    return <div className="p-10 text-center text-muted-custom">Loading Action Centre from DB...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">FRONT DESK</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-1">Action Centre</h1>
          <p className="text-sm text-muted-custom mt-1">Your two lists. Work them to zero every week — this is the job.</p>
        </div>

        <select 
          value={selectedCentre}
          onChange={e => setSelectedCentre(e.target.value)}
          className="bg-white border border-line rounded-lg px-4 py-2 text-xs text-ink outline-none cursor-pointer"
        >
          <option value="All">All centres</option>
          {centres.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm font-semibold transition-all">
          {message}
        </div>
      )}

      {/* Warning Banner */}
      {invoiceNowCount > 0 && (
        <div className="flex gap-4 p-5 rounded-[14px] bg-[#FBEEEA] border border-[#FBEEEA] border-l-4 border-l-hot-custom">
          <span className="text-xl">⌛</span>
          <div>
            <div className="font-bold text-hot-custom">{invoiceNowCount} students are attending with no paid package</div>
            <div className="text-xs text-ink/80 mt-1">
              Every class they take is revenue given away — AED {recoverableAmount.toLocaleString()} so far. Invoice them, then sell the next package before the next class.
            </div>
          </div>
        </div>
      )}

      {/* Owner Approvals Queue */}
      {currentUser?.role === 'owner' && pendingInactives.length > 0 && (
        <div className="flex flex-col gap-4 p-5 rounded-[14px] bg-[#F5F2EB] border border-[#E9E3D3] border-l-4 border-l-[#C4A249] shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <div className="font-bold text-ink">Pending Inactivation Approvals ({pendingInactives.length})</div>
          </div>
          <p className="text-xs text-muted-custom">
            The following students have been requested to be marked inactive by front desk staff. Approving will set remaining classes to 0 and remove slot enrollments.
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-muted-custom font-bold text-[9px] uppercase tracking-wider">
                  <th className="py-2 px-3">Student Name</th>
                  <th className="py-2 px-3">Centre</th>
                  <th className="py-2 px-3">Assigned Coach</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pendingInactives.map(s => (
                  <tr key={s.id} className="hover:bg-canvas/20">
                    <td className="py-2.5 px-3 font-semibold text-ink">
                      <a href={`/students?id=${s.id}`} className="text-forest hover:underline font-bold">
                        {s.name}
                      </a>
                    </td>
                    <td className="py-2.5 px-3 text-forest">{s.centre?.name || '—'}</td>
                    <td className="py-2.5 px-3 text-ink">{s.coach?.user?.name || 'Unassigned'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleApproveInactive(s.id)}
                        className="bg-forest hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1 rounded-lg transition-all"
                      >
                        Approve Inactive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'INVOICE NOW', value: invoiceNowCount, desc: 'attending unpaid', color: 'before:bg-forest' },
          { label: 'RENEW NOW', value: renewNowCount, desc: '≤3 classes left', color: 'before:bg-warm-custom' },
          { label: 'RECOVERABLE', value: recoverableAmount === 0 ? 'AED 0' : `AED ${(recoverableAmount / 1000).toFixed(0)}K`, desc: 'invoice today', color: 'before:bg-brass' },
          { label: 'CLASSES GIVEN AWAY', value: classesGivenAway, desc: 'never billed', color: 'before:bg-hot-custom' }
        ].map((kpi, idx) => (
          <div key={idx} className={`bg-surface border border-line rounded-[14px] p-6 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] ${kpi.color}`}>
            <div className="text-[10px] font-bold text-muted-custom tracking-wider uppercase">{kpi.label}</div>
            <div className="text-3xl font-bold font-display text-ink mt-2">{kpi.value}</div>
            <div className="text-xs text-muted-custom mt-1">{kpi.desc}</div>
          </div>
        ))}
      </div>

      {/* Middle Center-specific Expiring Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm">
          <div className="text-[10px] font-bold text-muted-custom tracking-wider uppercase">EXPIRING — BAY AVENUE</div>
          <div className="text-3xl font-bold font-display text-ink mt-2">{expiringBayAvenue}</div>
          <div className="text-xs text-muted-custom mt-1">≤3 classes left</div>
        </div>
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm">
          <div className="text-[10px] font-bold text-muted-custom tracking-wider uppercase">EXPIRING — JLT</div>
          <div className="text-3xl font-bold font-display text-ink mt-2">{expiringJlt}</div>
          <div className="text-xs text-muted-custom mt-1">≤3 classes left</div>
        </div>
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm">
          <div className="text-[10px] font-bold text-muted-custom tracking-wider uppercase">TOTAL TO RENEW</div>
          <div className="text-3xl font-bold font-display text-ink mt-2">{totalToRenew}</div>
          <div className="text-xs text-muted-custom mt-1">work this list weekly</div>
        </div>
      </div>
      {/* 20% Threshold Renewal Trigger Standalone Alert Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500 text-amber-950 font-bold text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider shadow-sm flex items-center gap-1">
            ⚡ 20% RENEWAL TRIGGER
          </span>
          <span>
            <b>{sortedExpiringPackages.filter(p => p.pctLeft <= 20).length} Student Packages</b> are at or below the <b>20% remaining threshold</b>. Front office action required!
          </span>
        </div>
        <button 
          onClick={() => router.push('/packages')}
          className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs px-4 py-2 rounded-lg transition-all shadow-md flex-shrink-0"
        >
          Open Package Renewals →
        </button>
      </div>

      {/* Table 1: Attending with no paid package */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
            <span className="text-forest">♜</span> Attending with no paid package
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={() => exportTableToCSV('#unpaid-table', 'unpaid_students.csv')}
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
        <p className="text-xs text-muted-custom mb-6">Every class here is revenue given away.</p>

        <div className="overflow-x-auto">
          <table id="unpaid-table" className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Student</th>
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Centre</th>
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Coach</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Classes Unpaid</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Value</th>
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Since</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedUnpaidStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-custom py-8">
                    ✓ Zero students outstanding! Great job!
                  </td>
                </tr>
              ) : (
                <>
                  {sortedUnpaidStudents.map(s => {
                    const unpaidCount = (s.flags as any)?.unpaid_classes || 0;
                    const val = (s.flags as any)?.unpaid_value || 0;
                    return (
                      <tr key={s.id} className="border-b border-line hover:bg-canvas/50 transition-all">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-ink">
                            <a href={`/students?id=${s.id}`} className="text-forest hover:underline font-bold">
                              {s.name}
                            </a>
                          </div>
                          <div className="text-xs text-muted-custom">Level: {s.level}</div>
                        </td>
                        <td className="py-4 px-4 text-ink">{s.centre?.name || '—'}</td>
                        <td className="py-4 px-4 text-ink">{getCoachName(s.coach)}</td>
                        <td className="py-4 px-4 text-right font-bold text-hot-custom">{unpaidCount}</td>
                        <td className="py-4 px-4 text-right font-mono font-semibold text-ink">AED {val.toLocaleString()}</td>
                        <td className="py-4 px-4 text-muted-custom text-sm">
                          {s.join_date ? new Date(s.join_date).toISOString().split('T')[0] : '—'}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleAction(s.id)}
                            className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                          >
                            Bill now
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Aggregated Total Row matching Image 1 */}
                  <tr className="bg-canvas/40 font-bold border-t-2 border-line">
                    <td className="py-4 px-4 text-ink">Total</td>
                    <td className="py-4 px-4"></td>
                    <td className="py-4 px-4"></td>
                    <td className="py-4 px-4 text-right text-ink font-mono">{classesGivenAway}</td>
                    <td className="py-4 px-4 text-right text-ink font-mono">AED {recoverableAmount.toLocaleString()}</td>
                    <td className="py-4 px-4 text-muted-custom">{invoiceNowCount} students</td>
                    <td className="py-4 px-4"></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Packages expiring — renew now */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
            <span className="text-[#C4A249]">👑</span> Packages expiring — renew now
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={() => exportTableToCSV('#expiring-table', 'expiring_packages.csv')}
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
        <p className="text-xs text-muted-custom mb-6">Flagged automatically when package balance reaches <b>≤20% threshold</b> (fewest classes remaining first).</p>

        <div className="overflow-x-auto">
          <table id="expiring-table" className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Student</th>
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Centre</th>
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Coach</th>
                <th className="text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Package</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Paid</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Used</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Left</th>
                <th className="text-center text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Trigger</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpiringPackages.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-muted-custom py-8">
                    ✓ Zero expiring packages! Great job!
                  </td>
                </tr>
              ) : (
                sortedExpiringPackages.map(pkg => (
                  <tr key={pkg.id} className="border-b border-line hover:bg-canvas/50 transition-all">
                    <td className="py-4 px-4 font-semibold text-ink">
                      <a href={`/student-dashboard?studentId=${pkg.studentId}`} className="hover:text-forest hover:underline">
                        {pkg.studentName}
                      </a>
                    </td>
                    <td className="py-4 px-4 text-ink">{pkg.centreName}</td>
                    <td className="py-4 px-4 text-ink">{pkg.coachName}</td>
                    <td className="py-4 px-4 text-ink font-medium">{pkg.packageName}</td>
                    <td className="py-4 px-4 text-right font-mono text-ink">{pkg.paid}</td>
                    <td className="py-4 px-4 text-right font-mono text-ink">{pkg.used}</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-hot-custom">{pkg.left} ({pkg.pctLeft}%)</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                        pkg.pctLeft <= 20
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {pkg.pctLeft <= 20 ? '⚡ 20% Trigger' : 'Expiring'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => router.push(`/packages?studentId=${pkg.studentId}`)}
                        className="bg-forest hover:bg-forest/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        Renew
                      </button>
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
};
