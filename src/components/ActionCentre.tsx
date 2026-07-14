"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { User, Student } from '../lib/db';
import { renewPackage } from '../app/actions';

interface ActionCentreProps {
  currentUser: User;
  activeCentre: string;
}

export const ActionCentre: React.FC<ActionCentreProps> = ({ currentUser, activeCentre }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = () => {
    const stds = db.getStudents();
    const pkgs = db.getPackages();
    const chs = db.getCoaches();
    setStudents(stds);
    setPackages(pkgs);
    setCoaches(chs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  // Filter students attending with no paid packages (unpaid classes > 0)
  const getUnpaidAttending = () => {
    return students.filter(s => {
      if (activeCentre !== 'All' && s.centre_id !== activeCentre) return false;
      return ((s.flags as any)?.unpaid_classes || 0) > 0;
    });
  };

  const unpaidStudents = getUnpaidAttending();

  const handleBillNow = async (studentId: string) => {
    try {
      await renewPackage(studentId, db.getTiers()[1]?.id || 't-core-id', 'renewal');
      setMessage('✓ Invoice generated and package renewed successfully!');
      setTimeout(() => setMessage(''), 4000);
      window.dispatchEvent(new Event('db-synced'));
    } catch (e: any) {
      alert('Error raising invoice: ' + e.message);
    }
  };

  const getCoachName = (coachId: string | null) => {
    if (!coachId) return 'Unassigned';
    const c = coaches.find(co => co.id === coachId);
    return c ? c.name : 'Unassigned';
  };

  const getCentreName = (centreId: string) => {
    return centreId === 'c-2' || centreId === 'JLT' ? 'JLT' : 'Bay Avenue';
  };

  // Calculate Action Centre metrics
  const invoiceNowCount = unpaidStudents.length;
  const renewNowCount = students.filter(s => (s.flags as any)?.low_package).length;
  const recoverableAmount = unpaidStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_value || 0), 0);
  const classesGivenAway = unpaidStudents.reduce((sum, s) => sum + ((s.flags as any)?.unpaid_classes || 0), 0);

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Action Centre...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 text-ink">
      {/* Head */}
      <div>
        <div className="text-xs font-bold tracking-widest text-forest uppercase">FRONT DESK</div>
        <h1 className="text-3xl font-bold font-display text-ink mt-1">Action Centre</h1>
        <p className="text-sm text-muted-custom mt-1">Your two lists. Work them to zero every week — this is the job.</p>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm font-semibold">
          {message}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'INVOICE NOW', value: invoiceNowCount, desc: 'attending unpaid', color: 'before:bg-forest' },
          { label: 'RENEW NOW', value: renewNowCount, desc: '≤3 classes left', color: 'before:bg-warm-custom' },
          { label: 'RECOVERABLE', value: `AED ${(recoverableAmount / 1000).toFixed(0)}K`, desc: 'invoice today', color: 'before:bg-brass' },
          { label: 'CLASSES GIVEN AWAY', value: classesGivenAway, desc: 'never billed', color: 'before:bg-hot-custom' }
        ].map((kpi, idx) => (
          <div key={idx} className={`bg-surface border border-line rounded-[14px] p-6 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] ${kpi.color}`}>
            <div className="text-[10px] font-bold text-muted-custom tracking-wider uppercase">{kpi.label}</div>
            <div className="text-3xl font-bold font-display text-ink mt-2">{kpi.value}</div>
            <div className="text-xs text-muted-custom mt-1">{kpi.desc}</div>
          </div>
        ))}
      </div>

      {/* Alert Banner */}
      <div className="flex gap-4 p-5 rounded-[14px] bg-red-50 border border-red-200 border-l-4 border-l-hot-custom">
        <span className="text-xl">⌛</span>
        <div>
          <div className="font-bold text-hot-custom">{invoiceNowCount} students are attending with no paid package</div>
          <div className="text-xs text-ink/80 mt-1">
            Every class they take is revenue given away — AED {recoverableAmount.toLocaleString()} so far. Invoice them, then sell the next package before the next class.
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm">
        <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2 mb-1">
          <span className="text-forest">♜</span> Attending with no paid package
        </h3>
        <p className="text-xs text-muted-custom mb-6">Roster of students active in the current cycle with zero class balance.</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Student</th>
                <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Centre</th>
                <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Coach</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Classes Unpaid</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Value</th>
                <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Since</th>
                <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {unpaidStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-custom py-8">
                    ✓ Zero students outstanding! Great job!
                  </td>
                </tr>
              ) : (
                unpaidStudents.map(s => {
                  const unpaidCount = (s.flags as any)?.unpaid_classes || 0;
                  const val = (s.flags as any)?.unpaid_value || 0;
                  return (
                    <tr key={s.id} className="border-b border-line hover:bg-canvas/50 transition-all">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-ink">
                          <a href={`/student-dashboard?studentId=${s.id}`} className="hover:text-forest hover:underline">
                            {s.name}
                          </a>
                        </div>
                        <div className="text-xs text-muted-custom">Level: {s.level}</div>
                      </td>
                      <td className="py-4 px-4 text-ink">{getCentreName(s.centre_id)}</td>
                      <td className="py-4 px-4 text-ink">{getCoachName(s.coach_id)}</td>
                      <td className="py-4 px-4 text-right font-bold text-hot-custom">{unpaidCount}</td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-ink">AED {val.toLocaleString()}</td>
                      <td className="py-4 px-4 text-muted-custom text-sm">
                        {s.join_date ? new Date(s.join_date).toISOString().split('T')[0] : '2026-04-12'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleBillNow(s.id)}
                          className="bg-forest hover:bg-forest/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all active:scale-95"
                        >
                          Bill now
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
