"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import type { User, Coach, Centre, Student } from '../lib/db';
import {
  addCoachDB, updateCoachDB, reassignCoachDB, deleteCoachDB,
  saveCentreDB, updateCentreStatusDB, deleteCentreDB,
  updateUserCredentialsDB, registerUser, backfillParentUsersDB,
  syncDatabaseToClient, purgeTestStudents
} from '../app/actions';

interface AdminUsersProps {
  currentUser: User;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [tab, setTab] = useState<'centres' | 'coaches' | 'users'>('coaches');
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [summerCampDuration, setSummerCampDuration] = useState<number>(2);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mmos_summer_camp_duration');
      setSummerCampDuration(stored === '2' ? 2 : 1);
    }
  }, []);

  // User management state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userEmailEdit, setUserEmailEdit] = useState('');
  const [userNameEdit, setUserNameEdit] = useState('');
  const [userPassEdit, setUserPassEdit] = useState('');
  const [userRoleEdit, setUserRoleEdit] = useState('');

  // Add new user state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'owner' | 'coach' | 'front_desk' | 'parent'>('coach');

  // Add coach form
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachCentre, setNewCoachCentre] = useState('');
  const [newCoachCentres, setNewCoachCentres] = useState<string[]>([]);

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
    const u = db.getUsers();
    setCoaches(c);
    setCentres(ct);
    setStudents(s);
    setUsers(u);
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
      const res = await addCoachDB(newCoachName.trim(), newCoachCentre, newCoachCentres);
      const fresh = await syncDatabaseToClient();
      db.syncFromNeon(fresh);
      setNewCoachName('');
      setNewCoachCentres([]);
      toast(`✓ Coach added! Login Email: ${res.email} | Password: ${res.generatedPassword}`, 10000);
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
        {(['centres', 'coaches', 'users'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${tab === t ? 'bg-[#173F35] text-white shadow' : 'text-muted-custom hover:text-ink'}`}
          >
            {t === 'users' ? 'User Accounts' : t.charAt(0).toUpperCase() + t.slice(1)}
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
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-custom uppercase tracking-wider">Assigned Centres</label>
                  <div className="space-y-1.5 border border-line rounded-lg p-3 bg-canvas/30 max-h-40 overflow-y-auto">
                    {centres.map(c => {
                      const isChecked = newCoachCentres.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-xs text-ink cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setNewCoachCentres(prev => [...prev, c.id]);
                              } else {
                                setNewCoachCentres(prev => prev.filter(id => id !== c.id));
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
                    <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3 w-12">S.No</th>
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
                      <td colSpan={9} className="py-8 text-center text-xs text-muted-custom">No coaches found. Add one above.</td>
                    </tr>
                  ) : coaches.map((coach, idx) => {
                    const stats = coachStats.find(s => s.coachId === coach.id) || { students: 0, engaged: 0, cls30d: 0, runRate: 0 };
                    const isHighLoad = stats.students > 80;
                    return (
                      <tr key={coach.id} className="border-b border-line hover:bg-canvas/40">
                        <td className="py-3 px-3 font-mono text-muted-custom text-xs w-12">{idx + 1}</td>
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
                  <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4 w-12">S.No</th>
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
                    <td colSpan={9} className="py-8 text-center text-xs text-muted-custom">No centres found.</td>
                  </tr>
                ) : centres.map((c, idx) => {
                  const stats = centreStats.find(s => s.centreId === c.id) || { students: 0, active: 0, runRate: 0 };
                  const isLive = c.status === 'active' || c.status === 'live';
                  const code = c.name.charAt(0).toUpperCase();
                  return (
                    <tr key={c.id} className="border-b border-line hover:bg-canvas/30">
                      <td className="py-3 pr-4 font-mono text-muted-custom text-xs w-12">{idx + 1}</td>
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

      {/* ── USER ACCOUNTS TAB ─────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-6">
          <div className="p-4 rounded-[10px] bg-emerald-50 border border-emerald-200 border-l-4 border-l-forest text-xs text-ink/90 flex justify-between items-center">
            <div>
              <div className="font-bold text-forest mb-0.5">👤 User Account &amp; Credential Management</div>
              Generate separate login accounts for every student. You can view, update emails, and reset passwords below.
            </div>
            <button
              onClick={async () => {
                setIsSaving(true);
                try {
                  const res = await backfillParentUsersDB();
                  const fresh = await syncDatabaseToClient();
                  db.syncFromNeon(fresh);
                  toast(`✓ Generated ${res.createdCount} student user accounts!`);
                } catch (err: any) {
                  toast('❌ ' + err.message);
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
              className="bg-forest hover:bg-forest-light text-white font-bold text-xs px-4 py-2 rounded-lg transition-all ml-4 disabled:opacity-50"
            >
              Generate Student Accounts
            </button>
          </div>

          {/* Create User Form */}
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">+ Create User Account</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newUserEmail.trim() || !newUserName.trim()) return;
                setIsSaving(true);
                try {
                  const res = await registerUser({
                    name: newUserName.trim(),
                    email: newUserEmail.trim(),
                    role: newUserRole,
                    centre_id: null
                  });
                  const fresh = await syncDatabaseToClient();
                  db.syncFromNeon(fresh);
                  setNewUserName('');
                  setNewUserEmail('');
                  toast(`✓ User created! Email: ${res.email} | Password: ${res.generatedPassword}`, 10000);
                } catch (err: any) {
                  toast('❌ ' + err.message);
                } finally {
                  setIsSaving(false);
                }
              }}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-custom uppercase">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  required
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-custom uppercase">Email *</label>
                <input
                  type="email"
                  placeholder="sarah@mastermoves.ae"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  required
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-custom uppercase">Role *</label>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                >
                  <option value="coach">Coach</option>
                  <option value="front_desk">Front Desk</option>
                  <option value="parent">Parent</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-forest hover:bg-forest-light text-white font-bold text-xs py-2 px-4 rounded-lg transition-all"
              >
                + Create User
              </button>
            </form>
          </div>

          {/* User Accounts Table */}
          <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <h3 className="text-xs font-bold text-ink font-display uppercase tracking-wider">All System Users ({users.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-canvas border-b border-line text-left text-[9px] font-bold text-muted-custom uppercase tracking-widest">
                    <th className="py-3 px-4">NAME</th>
                    <th className="py-3 px-4">EMAIL</th>
                    <th className="py-3 px-4">ROLE</th>
                    <th className="py-3 px-4">NEW PASSWORD</th>
                    <th className="py-3 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-custom text-xs">
                        No user accounts loaded in local state.
                      </td>
                    </tr>
                  ) : (
                    users.map(u => {
                      const isEditing = editingUserId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-canvas/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-ink">
                            {isEditing ? (
                              <input
                                type="text"
                                value={userNameEdit}
                                onChange={e => setUserNameEdit(e.target.value)}
                                className="bg-white border border-line rounded px-2 py-1 text-xs w-full"
                              />
                            ) : (
                              u.name
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-custom">
                            {isEditing ? (
                              <input
                                type="email"
                                value={userEmailEdit}
                                onChange={e => setUserEmailEdit(e.target.value)}
                                className="bg-white border border-line rounded px-2 py-1 text-xs w-full"
                              />
                            ) : (
                              u.email
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              u.role === 'owner' ? 'bg-amber-100 text-amber-800' : u.role === 'coach' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <input
                                type="text"
                                placeholder="Type new password..."
                                value={userPassEdit}
                                onChange={e => setUserPassEdit(e.target.value)}
                                className="bg-white border border-line rounded px-2 py-1 text-xs w-full font-mono"
                              />
                            ) : (
                              <span className="text-muted-custom/60 font-mono">••••••••</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                      await updateUserCredentialsDB(u.id, {
                                        name: userNameEdit,
                                        email: userEmailEdit,
                                        password: userPassEdit
                                      });
                                      const fresh = await syncDatabaseToClient();
                                      db.syncFromNeon(fresh);
                                      setEditingUserId(null);
                                      toast(`✓ Updated credentials for ${userNameEdit}!`, 6000);
                                    } catch (err: any) {
                                      toast('❌ ' + err.message);
                                    } finally {
                                      setIsSaving(false);
                                    }
                                  }}
                                  className="bg-forest text-white font-bold text-[10px] px-3 py-1 rounded hover:bg-forest-light transition-all"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="bg-white border border-line text-ink font-bold text-[10px] px-2.5 py-1 rounded hover:bg-canvas"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setUserNameEdit(u.name);
                                  setUserEmailEdit(u.email);
                                  setUserPassEdit('');
                                }}
                                className="bg-white border border-line hover:bg-canvas text-ink font-bold text-[10px] px-3 py-1 rounded transition-all"
                              >
                                ✏ Edit Credentials
                              </button>
                            )}
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
      )}

      {/* Summer Camp Setting */}
      <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm mt-6 space-y-4 max-w-4xl">
        <div className="flex items-center gap-2">
          <span className="text-sm">☀️</span>
          <h3 className="font-bold text-sm text-ink uppercase tracking-wider font-display">Summer Camp Settings</h3>
        </div>
        <p className="text-[11px] text-muted-custom">
          Choose the package burn rate (billing duration) when a student attendance status is logged as <b>Present</b> in a Summer Camp class.
        </p>
        <div className="flex flex-wrap gap-6 pt-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer bg-canvas/30 px-4 py-2.5 rounded-xl border border-line hover:bg-canvas/50 transition-all select-none">
            <input
              type="radio"
              name="summerCampDuration"
              value={1}
              checked={summerCampDuration === 1}
              onChange={() => {
                localStorage.setItem('mmos_summer_camp_duration', '1');
                setSummerCampDuration(1);
              }}
              className="text-forest focus:ring-forest cursor-pointer"
            />
            Deduct 1 Class Credit (e.g. 2-hour summer camp class counts as 1 hour)
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer bg-canvas/30 px-4 py-2.5 rounded-xl border border-line hover:bg-canvas/50 transition-all select-none">
            <input
              type="radio"
              name="summerCampDuration"
              value={2}
              checked={summerCampDuration === 2}
              onChange={() => {
                localStorage.setItem('mmos_summer_camp_duration', '2');
                setSummerCampDuration(2);
              }}
              className="text-forest focus:ring-forest cursor-pointer"
            />
            Deduct 2 Class Credits (Charge full 2 hours)
          </label>
        </div>
      </div>

      {/* Danger Zone: Purge Test Data */}
      <div className="bg-surface border border-red-200 rounded-2xl p-6 shadow-sm mt-6 space-y-4 max-w-4xl">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚠️</span>
          <h3 className="font-bold text-sm text-red-700 uppercase tracking-wider font-display">Danger Zone — Purge Test Data</h3>
        </div>
        <p className="text-[11px] text-muted-custom">
          Permanently deletes all students whose names start with <b>TEST_MMOS_</b>, <b>ZZTEST</b>, or <b>QA0813</b>, along with all their associated packages, attendance records, invoices, and enrollments. This action cannot be undone.
        </p>
        <button
          id="btn-purge-test-students"
          onClick={async () => {
            if (!confirm('Are you sure? This will permanently delete all TEST_MMOS_, ZZTEST, and QA0813 students and all their data.')) return;
            setIsSaving(true);
            setStatus('Purging test students...');
            try {
              const result = await purgeTestStudents();
              const freshData = await syncDatabaseToClient();
              db.syncFromNeon(freshData);
              setStatus(`✓ Purged ${result.purgedCount} test student(s): ${result.purgedNames.join(', ') || 'none found'}`);
            } catch (err: any) {
              setStatus('❌ Purge failed: ' + err.message);
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
        >
          🗑 Purge Test Students
        </button>
        {status && (
          <p className={`text-xs font-semibold mt-1 ${status.startsWith('❌') ? 'text-red-600' : 'text-forest'}`}>{status}</p>
        )}
      </div>
    </div>
  );
};
