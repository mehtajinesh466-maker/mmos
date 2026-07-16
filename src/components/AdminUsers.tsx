"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Coach, Centre, Student } from '../lib/db';
import {
  addCoachDB, updateCoachDB, reassignCoachDB, deleteCoachDB,
  saveCentreDB, updateCentreStatusDB, deleteCentreDB,
  syncDatabaseToClient
} from '../app/actions';

interface AdminUsersProps {
  currentUser: User;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [tab, setTab] = useState<'centres' | 'coaches'>('coaches');
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Add coach form
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachCentre, setNewCoachCentre] = useState('');

  // Bulk reassign
  const [fromCoachId, setFromCoachId] = useState('');
  const [toCoachName, setToCoachName] = useState('');

  // Add centre form
  const [newCentreName, setNewCentreName] = useState('');
  const [newCentreStatus, setNewCentreStatus] = useState('Live');

  // Inline coach rename state: { [coachId]: string }
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [coachCentres, setCoachCentres] = useState<Record<string, string>>({});

  const refresh = () => {
    const c = db.getCoaches().filter(ch => ch.active);
    const ct = db.getCentres();
    const s = db.getStudents();
    setCoaches(c);
    setCentres(ct);
    setStudents(s);
    // Init rename + centre state from DB values
    const r: Record<string, string> = {};
    const cc: Record<string, string> = {};
    c.forEach(ch => { r[ch.id] = ch.name; cc[ch.id] = ch.centre_id; });
    setRenames(r);
    setCoachCentres(cc);
    if (ct.length > 0 && !newCoachCentre) setNewCoachCentre(ct[0]?.id || '');
    if (ct.length > 0 && !fromCoachId && c.length > 0) setFromCoachId(c[0]?.id || '');
  };

  useEffect(() => {
    refresh();
    window.addEventListener('db-synced', refresh);
    return () => window.removeEventListener('db-synced', refresh);
  }, []);

  // ── Computed coach roster stats ──────────────────────────────────────────
  const coachStats = useMemo(() => {
    return coaches.map(coach => {
      const myStudents = students.filter(s => s.coach_id === coach.id && s.status === 'active');
      const engaged = myStudents.filter(s => s.last_attended).length;
      // CLS 30D: students attended in last 30 days (using last_attended as proxy)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cls30d = myStudents.filter(s => s.last_attended && new Date(s.last_attended) >= thirtyDaysAgo).length * 4; // approx sessions
      // Run rate: simple estimation (students × AED 100 avg × classes per month)
      const runRate = myStudents.length * 100 * 1.4;
      return { coachId: coach.id, students: myStudents.length, engaged, cls30d, runRate };
    });
  }, [coaches, students]);

  // ── Centre stats ─────────────────────────────────────────────────────────
  const centreStats = useMemo(() => {
    return centres.map(c => {
      const myStudents = students.filter(s => s.centre_id === c.id && s.status === 'active');
      const active = myStudents.filter(s => s.last_attended).length;
      const runRate = myStudents.length * 100 * 1.4;
      return { centreId: c.id, students: myStudents.length, active, runRate };
    });
  }, [centres, students]);

  const getCentreName = (id: string) => centres.find(c => c.id === id)?.name || '—';

  const formatAED = (n: number) => `AED ${Math.round(n / 1000)}K`;

  const toast = (msg: string, ms = 5000) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), ms);
  };

  // ── Add coach ─────────────────────────────────────────────────────────────
  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoachName.trim()) return;
    setIsSaving(true);
    try {
      await addCoachDB(newCoachName.trim(), newCoachCentre);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      setNewCoachName('');
      toast('✓ Coach added and saved to database.');
    } catch (err: any) {
      toast('❌ ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Bulk reassign ─────────────────────────────────────────────────────────
  const handleReassign = async () => {
    const toCoach = coaches.find(c => c.name.toLowerCase() === toCoachName.toLowerCase());
    if (!fromCoachId || !toCoach) { toast('❌ Select valid "from" and "to" coaches.'); return; }
    setIsSaving(true);
    try {
      await reassignCoachDB(fromCoachId, toCoach.id);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      setToCoachName('');
      toast('✓ Students reassigned successfully.');
    } catch (err: any) {
      toast('❌ ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Save coach rename / centre change ─────────────────────────────────────
  const handleSaveCoach = async (coachId: string) => {
    setIsSaving(true);
    try {
      await updateCoachDB(coachId, renames[coachId], coachCentres[coachId]);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      toast('✓ Coach updated in database.');
    } catch (err: any) {
      toast('❌ ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCoach = async (coachId: string) => {
    try {
      await deleteCoachDB(coachId);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      toast('✓ Coach archived.');
    } catch (err: any) {
      toast('❌ ' + err.message);
    }
  };

  // ── Add centre ────────────────────────────────────────────────────────────
  const handleAddCentre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCentreName.trim()) return;
    setIsSaving(true);
    try {
      await saveCentreDB({ name: newCentreName.trim(), status: newCentreStatus.toLowerCase() });
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      setNewCentreName('');
      toast('✓ Centre added to database.');
    } catch (err: any) {
      toast('❌ ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Update centre status ──────────────────────────────────────────────────
  const handleCentreStatus = async (centreId: string, newStatus: string) => {
    try {
      await updateCentreStatusDB(centreId, newStatus.toLowerCase());
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      toast('✓ Centre status updated.');
    } catch (err: any) {
      toast('❌ ' + err.message);
    }
  };

  const handleDeleteCentre = async (centreId: string) => {
    try {
      await deleteCentreDB(centreId);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      toast('✓ Centre archived.');
    } catch (err: any) {
      toast('❌ ' + err.message);
    }
  };

  if (currentUser.role !== 'owner') return <div className="p-8 text-ink">Unauthorized.</div>;

  const fromCoach = coaches.find(c => c.id === fromCoachId);
  const fromStudentCount = fromCoach ? students.filter(s => s.coach_id === fromCoach.id && s.status === 'active').length : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-6 text-ink">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">INPUT · ADMIN</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Centres &amp; Coaches</h1>
        </div>
        <select className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none">
          <option>All centres</option>
          {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-custom">
        Coaches are <b className="text-ink">edited here, in this system</b> — not in the source export. The legacy coach field is known-bad; this is where it gets fixed. Every edit recomputes every dashboard and report immediately.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 bg-canvas border border-line rounded-lg p-1 w-fit">
        {(['centres', 'coaches'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${tab === t ? 'bg-[#173F35] text-white shadow' : 'text-muted-custom hover:text-ink'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Status message */}
      {status && (
        <div className={`p-3 rounded-xl border text-xs font-semibold ${status.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {status}
        </div>
      )}

      {/* ── COACHES TAB ─────────────────────────────────────────────────── */}
      {tab === 'coaches' && (
        <div className="space-y-6">
          {/* Warning banner */}
          <div className="p-4 rounded-[10px] bg-amber-50 border border-amber-200 border-l-4 border-l-[#C4A249] text-xs text-ink/80">
            <div className="font-bold text-ink mb-0.5">▶ This screen is the remedy, not the symptom</div>
            Until the roster below is corrected and every student carries the right coach, the four Coaching reports stay <b className="text-ink">structure-only</b>. Fix it here and they become live — no code change.
          </div>

          {/* Two-column action cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Add a coach */}
            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">↘ Add a coach</h3>
                <p className="text-[10px] text-muted-custom mt-0.5">New hire, or a coach missing from the export.</p>
              </div>
              <form onSubmit={handleAddCoach} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mahri Geldiyeva"
                    value={newCoachName}
                    onChange={e => setNewCoachName(e.target.value)}
                    className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Home Centre</label>
                  <select
                    value={newCoachCentre}
                    onChange={e => setNewCoachCentre(e.target.value)}
                    className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                  >
                    {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-4 py-2 rounded-lg transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {isSaving ? <span className="inline-block w-3 h-3 border-2 border-ink border-t-transparent rounded-full animate-spin" /> : null}
                  + Add coach
                </button>
              </form>
            </div>

            {/* Bulk reassign */}
            <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-ink">⇌ Bulk reassign students</h3>
                <p className="text-[10px] text-muted-custom mt-0.5">Move a whole caseload from one coach to another — the fastest way to clean the bad field.</p>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Move students from</label>
                  <select
                    value={fromCoachId}
                    onChange={e => setFromCoachId(e.target.value)}
                    className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                  >
                    {coaches.map(c => {
                      const cnt = students.filter(s => s.coach_id === c.id && s.status === 'active').length;
                      return <option key={c.id} value={c.id}>{c.name} ({cnt} students)</option>;
                    })}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">To coach</label>
                  <input
                    type="text"
                    placeholder="Pick or type a new name"
                    value={toCoachName}
                    onChange={e => setToCoachName(e.target.value)}
                    list="coach-names-list"
                    className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                  />
                  <datalist id="coach-names-list">
                    {coaches.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <button
                  onClick={handleReassign}
                  disabled={isSaving}
                  className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-4 py-2 rounded-lg transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {isSaving ? <span className="inline-block w-3 h-3 border-2 border-ink border-t-transparent rounded-full animate-spin" /> : null}
                  ⇌ Reassign
                </button>
              </div>
            </div>
          </div>

          {/* Coach roster table */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-ink">↑ Coach roster</h3>
                <p className="text-[10px] text-muted-custom mt-0.5">Counts recompute from the student records on every edit — nothing is cached.</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                <button className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Coach</th>
                    <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Rename</th>
                    <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Centre</th>
                    <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Students</th>
                    <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Engaged</th>
                    <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Cls 30D</th>
                    <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Run-Rate</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {coaches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-muted-custom">No coaches found. Add one above.</td>
                    </tr>
                  ) : coaches.map(coach => {
                    const stats = coachStats.find(s => s.coachId === coach.id) || { students: 0, engaged: 0, cls30d: 0, runRate: 0 };
                    const isHighLoad = stats.students > 80;
                    return (
                      <tr key={coach.id} className="border-b border-line hover:bg-canvas/40">
                        <td className="py-3 px-3 font-bold text-xs text-ink uppercase">{coach.name}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <input
                              value={renames[coach.id] || coach.name}
                              onChange={e => setRenames(prev => ({ ...prev, [coach.id]: e.target.value }))}
                              className="bg-white border border-line rounded px-2 py-1 text-xs text-[#C4A249] font-medium outline-none focus:border-forest w-36"
                            />
                            <button
                              onClick={() => handleSaveCoach(coach.id)}
                              disabled={isSaving}
                              className="bg-white border border-line text-ink font-bold text-[9px] px-2 py-1 rounded hover:bg-canvas disabled:opacity-60"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <select
                             value={coachCentres[coach.id] || coach.centre_id}
                            onChange={e => setCoachCentres(prev => ({ ...prev, [coach.id]: e.target.value }))}
                            className="bg-white border border-line rounded px-2 py-1 text-xs text-ink outline-none"
                          >
                            {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono text-sm font-bold ${isHighLoad ? 'text-[#C4A249]' : 'text-ink'}`}>{stats.students}</td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-ink">{stats.engaged}</td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-ink">{stats.cls30d}</td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-ink">{formatAED(stats.runRate)}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteCoach(coach.id)}
                            className="w-6 h-6 flex items-center justify-center rounded border border-red-200 text-hot-custom text-xs hover:bg-red-50"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-muted-custom">
            ✦ Coach edits are local to this reference build. In production these write to users/students in Supabase and are captured in the audit log.
          </p>
        </div>
      )}

      {/* ── CENTRES TAB ─────────────────────────────────────────────────── */}
      {tab === 'centres' && (
        <div className="space-y-6">
          {/* Centre registry table */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-ink">■ Centre registry</h3>
                <p className="text-[10px] text-muted-custom mt-0.5">Live centres carry data and appear in analysis. Planned centres appear in pickers but hold no students yet.</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">↓ Excel</button>
                <button className="bg-white border border-line text-ink font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-canvas">⎙ PDF</button>
              </div>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Centre</th>
                  <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Code</th>
                  <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Descriptor</th>
                  <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Status</th>
                  <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Students</th>
                  <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Active</th>
                  <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-2">Run-Rate</th>
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {centres.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-muted-custom">No centres found.</td>
                  </tr>
                ) : centres.map(c => {
                  const stats = centreStats.find(s => s.centreId === c.id) || { students: 0, active: 0, runRate: 0 };
                  const isLive = c.status === 'active' || c.status === 'live';
                  const code = c.name.charAt(0).toUpperCase();
                  return (
                    <tr key={c.id} className="border-b border-line hover:bg-canvas/30">
                      <td className="py-3 pr-4 font-bold text-xs text-ink">{c.name}</td>
                      <td className="py-3 pr-4">
                        <span className="text-[#C4A249] font-bold text-xs">{code}</span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-custom">
                        {c.name === 'Bay Avenue' ? 'Business Bay · flagship' :
                         c.name === 'JLT' ? 'Saba Tower 1 · growth engine' :
                         `${c.name} · planned`}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={isLive ? 'Live' : 'Planned'}
                          onChange={e => handleCentreStatus(c.id, e.target.value)}
                          className="bg-white border border-line rounded px-2 py-1 text-[10px] text-ink outline-none"
                        >
                          <option>Live</option>
                          <option>Planned</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs text-ink">
                        {isLive ? stats.students : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs text-ink">
                        {isLive ? stats.active : '—'}
                      </td>
                      <td className="py-3 pr-2 text-right font-mono text-xs text-ink">
                        {isLive ? formatAED(stats.runRate) : '—'}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => handleDeleteCentre(c.id)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-red-200 text-hot-custom text-xs hover:bg-red-50"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Town Square modelling note */}
          <div className="p-4 rounded-[10px] bg-emerald-50 border border-emerald-200 border-l-4 border-l-forest text-xs text-ink/80 leading-relaxed">
            <b className="text-ink">Town Square modelling note.</b> When Town Square goes live, model its ramp on the <b className="text-ink">JLT curve</b> (46% active rate, grew ~243% YoY), not Bay Avenue steady-state. The New Centre Model report does this automatically once the centre is marked Live.
          </div>

          {/* Add centre form */}
          <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-ink">+ Add a new centre</h3>
            <form onSubmit={handleAddCentre} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Centre name</label>
                <input
                  type="text"
                  placeholder="e.g. Town Square"
                  value={newCentreName}
                  onChange={e => setNewCentreName(e.target.value)}
                  required
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Status</label>
                <select
                  value={newCentreStatus}
                  onChange={e => setNewCentreStatus(e.target.value)}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                >
                  <option>Live</option>
                  <option>Planned</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs px-5 py-2 rounded-lg transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {isSaving ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                + Add centre
              </button>
            </form>
          </div>

          <p className="text-[10px] text-muted-custom">
            ✦ Centre edits are local to this reference build. In production these write to the centres table; students carry centre_id, so no report needs changing when a centre is added.
          </p>
        </div>
      )}
    </div>
  );
};
