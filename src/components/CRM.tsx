"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { User, Enquiry, Centre, Student } from '../lib/db';
import { saveEnquiryDB, syncDatabaseToClient } from '../app/actions';

interface CRMProps {
  currentUser: User;
  activeCentre: string;
}

export const CRM: React.FC<CRMProps> = ({ currentUser, activeCentre }) => {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [formData, setFormData] = useState({
    child: '',
    age: '',
    parent: '',
    phone: '',
    centre_id: activeCentre === 'All' ? '' : activeCentre,
    source: 'Instagram',
    experience: 'Complete beginner',
    stage: 'New',
    trial_date: '',
    coach_id: '',
    notes: '',
  });
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const freshData = await syncDatabaseToClient();
      if (freshData) db.syncFromNeon(freshData);
    } catch (e) {
      // Fallback to local storage if sync fails
    }
    const enqs = db.getEnquiries();
    const ctrs = db.getCentres();
    setEnquiries(enqs);
    setCentres(ctrs);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.child || !formData.parent || !formData.phone) return;

    setIsSaving(true);
    try {
      const newEnq: Enquiry = {
        id: 'enq-' + Math.random().toString(36).substr(2, 9),
        child: formData.child,
        age: formData.age,
        parent: formData.parent,
        phone: formData.phone,
        source: formData.source,
        stage: 'new',
        centre_id: formData.centre_id || (centres[0]?.id || 'c-1'),
        experience: formData.experience,
        trial_date: formData.trial_date || undefined,
        coach_id: formData.coach_id || undefined,
        notes: formData.notes || undefined,
        created_at: new Date().toISOString(),
      };

      // Save to localStorage immediately
      db.saveEnquiry(newEnq);

      // Persist to Neon Postgres in background
      await saveEnquiryDB({
        child: newEnq.child,
        age: newEnq.age,
        parent: newEnq.parent,
        phone: newEnq.phone,
        source: newEnq.source,
        stage: newEnq.stage,
        centre_id: newEnq.centre_id,
        experience: newEnq.experience,
        trial_date: newEnq.trial_date,
        coach_id: newEnq.coach_id,
        notes: newEnq.notes,
      });

      setMessage('✓ Enquiry saved to database!');
      setFormData({
        child: '',
        age: '',
        parent: '',
        phone: '',
        centre_id: activeCentre === 'All' ? '' : activeCentre,
        source: 'Instagram',
        experience: 'Complete beginner',
        stage: 'New',
        trial_date: '',
        coach_id: '',
        notes: '',
      });
    } catch (err: any) {
      setMessage('❌ Error saving: ' + err.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleUpdateStage = (enqId: string, stage: Enquiry['stage']) => {
    const enqs = db.getEnquiries();
    const idx = enqs.findIndex(e => e.id === enqId);
    if (idx !== -1) {
      const before = { ...enqs[idx] };
      enqs[idx].stage = stage;
      db.save('enquiries', enqs);
      db.logAudit('update_enquiry_stage', 'enquiries', before, enqs[idx]);
      window.dispatchEvent(new Event('db-synced'));
    }
  };

  const getCentreName = (centreId: string) => {
    const c = centres.find(ct => ct.id === centreId);
    return c ? c.name : 'Bay Avenue';
  };

  const totalLeads = enquiries.length;
  const newLeads = enquiries.filter(e => e.stage === 'new').length;
  const contacted = enquiries.filter(e => e.stage === 'contacted').length;
  const trials = enquiries.filter(e => e.stage === 'trial_booked' || e.stage === 'trial_done').length;
  const converted = enquiries.filter(e => e.stage === 'converted').length;

  const filteredEnquiries = enquiries.filter(e => {
    if (activeCentre !== 'All' && e.centre_id !== activeCentre) return false;
    return true;
  });

  const getCoachName = (coachId?: string) => {
    if (!coachId) return 'Unassigned';
    const coach = db.getCoaches().find(c => c.id === coachId);
    return coach?.name || 'Unassigned';
  };

  const stageBadgeClass = (stage: string) => {
    if (stage === 'converted') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    if (stage === 'lost') return 'bg-red-50 border-red-200 text-hot-custom';
    if (stage === 'trial_booked' || stage === 'trial_done') return 'bg-blue-50 border-blue-200 text-blue-800';
    if (stage === 'contacted') return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-teal-50 border-teal-200 text-forest';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 text-ink">
      {/* Head */}
      <div>
        <div className="text-xs font-bold tracking-widest text-forest uppercase">FRONT DESK · CRM</div>
        <h1 className="text-3xl font-bold font-display text-ink mt-1">Enquiry Intake &amp; Funnel</h1>
        <p className="text-sm text-muted-custom mt-1">Capture marketing leads, schedule trials, and track conversions.</p>
      </div>

      {message && (
        <div className={`rounded-xl p-4 text-sm font-semibold border ${ message.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {message}
        </div>
      )}

      {/* Funnel overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'TOTAL LEADS', value: totalLeads, desc: 'all time inquiries', color: 'before:bg-forest' },
          { label: 'NEW & UNTOUCHED', value: newLeads, desc: 'require callbacks', color: 'before:bg-warm-custom' },
          { label: 'CONTACTED', value: contacted, desc: 'active communication', color: 'before:bg-forest' },
          { label: 'TRIALS & EVALS', value: trials, desc: 'booked or completed', color: 'before:bg-brass' },
          { label: 'CONVERTED', value: converted, desc: 'joined chess academy', color: 'before:bg-ok-custom' }
        ].map((kpi, idx) => (
          <div key={idx} className={`bg-surface border border-line rounded-[14px] p-5 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] ${kpi.color}`}>
            <div className="text-[9px] font-bold text-muted-custom tracking-wider uppercase">{kpi.label}</div>
            <div className="text-2xl font-bold font-display text-ink mt-2">{kpi.value}</div>
            <div className="text-[10px] text-muted-custom mt-0.5">{kpi.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-6">
        
        {/* Left - Intake Form */}
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4 self-start">
          <div>
            <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
              <span className="text-forest">♟</span> New Enquiry Intake
            </h3>
            <p className="text-xs text-muted-custom mt-1">Log new lead from social media, referral, or walk-ins.</p>
          </div>

          <form onSubmit={handleCreateEnquiry} className="space-y-4 pt-2">
            <div className="text-[10px] font-bold text-[#C4A249] tracking-widest uppercase border-b border-line pb-2">ENQUIRY</div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Child name *</label>
                <input 
                  type="text" 
                  name="child" 
                  value={formData.child} 
                  onChange={handleChange} 
                  required 
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Age</label>
                <input 
                  type="text" 
                  name="age" 
                  value={formData.age} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Parent name *</label>
                <input 
                  type="text" 
                  name="parent" 
                  value={formData.parent} 
                  onChange={handleChange} 
                  required 
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Mobile (WhatsApp) *</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  required 
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Centre of interest</label>
                <select 
                  name="centre_id" 
                  value={formData.centre_id} 
                  onChange={handleChange}
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all"
                >
                  <option value="">-- Choose Centre --</option>
                  {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Source *</label>
                <select 
                  name="source" 
                  value={formData.source} 
                  onChange={handleChange}
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all"
                >
                  <option value="Instagram">Instagram</option>
                  <option value="Website">Website</option>
                  <option value="Referral">Referral</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Kidzapp">Kidzapp</option>
                  <option value="Google">Google</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Experience</label>
                <select 
                  name="experience" 
                  value={formData.experience} 
                  onChange={handleChange}
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all"
                >
                  <option value="Complete beginner">Complete beginner</option>
                  <option value="Knows basic rules">Knows basic rules</option>
                  <option value="Club player">Club player</option>
                  <option value="Tournament player">Tournament player</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Stage</label>
                <select 
                  name="stage" 
                  value={formData.stage} 
                  onChange={handleChange}
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all"
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Trial Booked">Trial Booked</option>
                  <option value="Trial Done">Trial Done</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Trial date</label>
                <input 
                  type="date" 
                  name="trial_date" 
                  value={formData.trial_date} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-ink">Assign coach</label>
                <select 
                  name="coach_id" 
                  value={formData.coach_id} 
                  onChange={handleChange}
                  className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all"
                >
                  <option value="">Unassigned</option>
                  {db.getCoaches().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Notes</label>
              <textarea 
                name="notes" 
                value={formData.notes} 
                onChange={handleChange}
                rows={3}
                className="w-full bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-forest transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="submit" 
                disabled={isSaving}
                className="bg-forest text-white font-bold py-2.5 px-5 rounded-lg text-xs transition-all hover:bg-forest/90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : 'Save enquiry'}
              </button>
              <button 
                type="button" 
                disabled={isSaving}
                className="bg-white border border-line text-ink font-bold py-2.5 px-5 rounded-lg text-xs transition-all hover:bg-canvas disabled:opacity-60"
              >
                Convert to enrolment
              </button>
            </div>
          </form>
        </div>

        {/* Right - Leads List */}
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
              <span className="text-forest">⚏</span> Active Inquiry Pipeline
            </h3>
            <p className="text-xs text-muted-custom mt-1">Click a row to view full details. Update stage from the dropdown.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-3">Child / Parent</th>
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-3">Centre · Source</th>
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-3">Trial Date</th>
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-3">Stage</th>
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-3">Move</th>
                  <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEnquiries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-custom py-8 text-xs">
                      No active enquiries in pipeline.
                    </td>
                  </tr>
                ) : (
                  filteredEnquiries.map(enq => (
                    <tr key={enq.id} className="border-b border-line hover:bg-canvas/50 cursor-pointer" onClick={() => setSelectedEnquiry(enq)}>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-xs text-ink">{enq.child}{enq.age ? <span className="text-muted-custom font-normal ml-1">Age {enq.age}</span> : ''}</div>
                        <div className="text-[10px] text-muted-custom mt-0.5">{enq.parent} · {enq.phone}</div>
                        {enq.experience && <div className="text-[9px] text-muted-custom mt-0.5 italic">{enq.experience}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-xs text-ink">{getCentreName(enq.centre_id)}</div>
                        <div className="text-[10px] text-muted-custom">via {enq.source}</div>
                      </td>
                      <td className="py-3 px-3">
                        {enq.trial_date 
                          ? <span className="text-xs font-mono text-ink">{enq.trial_date}</span>
                          : <span className="text-[10px] text-muted-custom">—</span>
                        }
                      </td>
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${stageBadgeClass(enq.stage)}`}>
                          {enq.stage.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <select 
                          value={enq.stage} 
                          onChange={(e) => handleUpdateStage(enq.id, e.target.value as any)}
                          className="bg-white border border-line rounded-lg px-2 py-1 text-[10px] text-ink outline-none focus:border-forest"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="trial_booked">Trial Booked</option>
                          <option value="trial_done">Trial Done</option>
                          <option value="converted">Convert</option>
                          <option value="lost">Lost</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => setSelectedEnquiry(enq)}
                          className="text-[10px] font-bold text-forest hover:underline"
                        >
                          View →
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

      {/* Detail Slide-over Panel */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedEnquiry(null)}
          />

          {/* Panel */}
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Panel Header */}
            <div className="bg-[#173F35] text-white p-6 flex justify-between items-start">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-200 uppercase">ENQUIRY DETAILS</div>
                <h2 className="text-xl font-bold mt-1">{selectedEnquiry.child}</h2>
                <div className="text-xs text-emerald-200 mt-0.5">{selectedEnquiry.parent} · {selectedEnquiry.phone}</div>
              </div>
              <button 
                onClick={() => setSelectedEnquiry(null)}
                className="text-white/70 hover:text-white text-xl font-bold leading-none mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Stage Badge */}
            <div className="px-6 py-3 border-b border-line bg-canvas flex items-center gap-3">
              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${stageBadgeClass(selectedEnquiry.stage)}`}>
                {selectedEnquiry.stage.replace('_', ' ').toUpperCase()}
              </span>
              <select 
                value={selectedEnquiry.stage} 
                onChange={(e) => {
                  handleUpdateStage(selectedEnquiry.id, e.target.value as any);
                  setSelectedEnquiry({ ...selectedEnquiry, stage: e.target.value as any });
                }}
                className="bg-white border border-line rounded-lg px-2 py-1 text-[10px] text-ink outline-none focus:border-forest"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="trial_booked">Trial Booked</option>
                <option value="trial_done">Trial Done</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            {/* Detail Fields */}
            <div className="p-6 space-y-5 flex-1">

              <div>
                <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">CHILD PROFILE</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Name</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{selectedEnquiry.child || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Age</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{selectedEnquiry.age || '—'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Experience</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{selectedEnquiry.experience || '—'}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">PARENT / CONTACT</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Parent Name</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{selectedEnquiry.parent || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Mobile (WhatsApp)</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{selectedEnquiry.phone || '—'}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">ENQUIRY DETAILS</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Centre of Interest</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{getCentreName(selectedEnquiry.centre_id)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Source</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{selectedEnquiry.source || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Trial Date</div>
                    <div className="text-xs font-semibold text-ink mt-0.5 font-mono">{selectedEnquiry.trial_date || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-custom uppercase font-bold">Assigned Coach</div>
                    <div className="text-xs font-semibold text-ink mt-0.5">{getCoachName(selectedEnquiry.coach_id)}</div>
                  </div>
                </div>
              </div>

              {selectedEnquiry.notes && (
                <div>
                  <div className="text-[10px] font-bold text-[#C4A249] uppercase tracking-wider mb-3 border-b border-line pb-2">NOTES</div>
                  <div className="text-xs text-ink bg-canvas border border-line rounded-lg p-3 leading-relaxed">
                    {selectedEnquiry.notes}
                  </div>
                </div>
              )}

            </div>

            {/* Panel Footer */}
            <div className="p-6 border-t border-line bg-canvas flex gap-3">
              <button 
                onClick={() => {
                  if (!selectedEnquiry) return;

                  // 1. Create family
                  const familyId = 'fam-' + Math.random().toString(36).substring(2, 9);
                  
                  // 2. Create student record from enquiry data
                  const newStudent: Student = {
                    id: 'stu-' + Math.random().toString(36).substring(2, 9),
                    family_id: familyId,
                    centre_id: selectedEnquiry.centre_id || (centres[0]?.id || 'c-1'),
                    coach_id: selectedEnquiry.coach_id || null,
                    name: selectedEnquiry.child || 'New Student',
                    dob: new Date().toISOString().split('T')[0],
                    gender: 'Boy',
                    school: 'Primary School',
                    level: selectedEnquiry.experience === 'Club player' ? 'Intermediate' : selectedEnquiry.experience === 'Tournament player' ? 'Advanced' : 'Beginner',
                    status: 'active',
                    join_date: new Date().toISOString().split('T')[0],
                    last_attended: null,
                    pace_status: 'New',
                    pace_reason: null,
                    flags: {}
                  };

                  // Save student locally & sync
                  db.saveStudent(newStudent);

                  // 3. Mark enquiry as converted
                  handleUpdateStage(selectedEnquiry.id, 'converted');

                  setMessage(`✓ ${selectedEnquiry.child} converted to active Enrolment! Student profile created.`);
                  setSelectedEnquiry(null);
                  setTimeout(() => setMessage(''), 6000);
                }}
                className="flex-1 bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-all shadow"
              >
                🎓 Convert to Enrolment
              </button>
              <button 
                onClick={() => setSelectedEnquiry(null)}
                className="bg-white border border-line text-ink font-bold text-xs px-4 py-2.5 rounded-lg transition-all hover:bg-canvas"
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
