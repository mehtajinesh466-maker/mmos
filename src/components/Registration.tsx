"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { registerStudent, syncDatabaseToClient } from '../app/actions';

interface RegistrationProps {
  currentUser: any;
  activeCentre: string;
}

export const Registration: React.FC<RegistrationProps> = ({ currentUser, activeCentre }) => {
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: 'Boy',
    centre_id: activeCentre === 'All' ? 'c-1' : activeCentre, // default to Bay Avenue (c-1) if All
    coach_id: '',
    level: '',
    school: '',
    parent_name: '',
    relationship: 'Mother',
    phone: '',
    email: '',
    sibling: 'No',
    emergency_contact: '',
    package_size: '12 classes',
    rate_per_class: '100',
    start_date: '',
    acquisition_source: 'Instagram',
    fide_id: '',
    consent_ops: true,
    consent_mktg: false,
    consent_media: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [studentIdAuto, setStudentIdAuto] = useState('BAY-363 (auto)');

  // Hardcoded or fetched centres and coaches
  const centres = db.getCentres().length > 0 ? db.getCentres() : [
    { id: 'c-1', name: 'Bay Avenue' },
    { id: 'c-2', name: 'JLT' }
  ];

  const coaches = db.getCoaches().length > 0 ? db.getCoaches() : [
    { id: 'james', name: 'JAMES', centre_id: 'c-1' },
    { id: 'john', name: 'JOHN', centre_id: 'c-1' },
    { id: 'brett', name: 'BRETT', centre_id: 'c-2' }
  ];

  const filteredCoaches = formData.centre_id ? coaches.filter(c => c.centre_id === formData.centre_id) : coaches;

  // Auto student ID calculation based on centre selection
  useEffect(() => {
    const prefix = formData.centre_id === 'c-2' ? 'JLT' : 'BAY';
    setStudentIdAuto(`${prefix}-363 (auto)`);
  }, [formData.centre_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Compute Package Total Box
  const getPackageTotalDetails = () => {
    const classes = parseInt(formData.package_size) || 12;
    const rate = parseFloat(formData.rate_per_class) || 100;
    const baseTotal = classes * rate;
    const hasSiblingDiscount = formData.sibling === 'Yes';
    const discount = hasSiblingDiscount ? 0.1 : 0;
    const finalTotal = baseTotal * (1 - discount);

    return {
      total: finalTotal,
      text: `Package total: AED ${finalTotal.toLocaleString()} · ${classes} × AED ${rate} · ${hasSiblingDiscount ? '10% sibling discount applied' : 'no discount applied'}`
    };
  };

  const packageDetails = getPackageTotalDetails();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveStatus('');

    // Map fields to match action expectation
    const payload = {
      name: formData.name,
      parent_name: formData.parent_name,
      phone: formData.phone,
      email: formData.email,
      dob: formData.dob,
      gender: formData.gender,
      school: formData.school,
      fide_id: formData.fide_id,
      centre_id: formData.centre_id,
      coach_id: formData.coach_id || (filteredCoaches[0]?.id || ''),
      level: formData.level || 'Beginner',
      tier_id: 'tier-12-class', // maps to a default tier
      consent_ops: formData.consent_ops,
      consent_mktg: formData.consent_mktg,
    };

    try {
      await registerStudent(payload);
      
      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      
      setSaveStatus('✓ Student registered and package created successfully!');
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        name: '',
        parent_name: '',
        phone: '',
        email: '',
        dob: '',
        school: '',
        fide_id: '',
        emergency_contact: ''
      }));
    } catch (error: any) {
      console.error(error);
      setSaveStatus('❌ Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start pb-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">INPUT</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Register Student</h1>
        </div>

        <div>
          <select className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none">
            <option>All centres</option>
            <option>Bay Avenue</option>
            <option>JLT</option>
          </select>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${saveStatus.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {saveStatus}
        </div>
      )}

      {/* Top Banner */}
      <div className="p-4 rounded-[14px] bg-emerald-50/50 border border-emerald-100 border-l-4 border-l-forest text-xs text-ink/80">
        ✍ <b className="text-ink">Register student.</b> Creates the student record, the family link, the first package and queues the welcome message — one pass, no re-keying.
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-[14px] p-8 shadow-sm space-y-8">
        
        {/* STUDENT SECTION */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">STUDENT</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Full name *</label>
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                required 
                placeholder="e.g. Aarav Sharma"
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Student ID</label>
              <input 
                type="text" 
                value={studentIdAuto} 
                disabled 
                className="bg-canvas/50 border border-line rounded-lg px-3 py-2 text-xs text-muted-custom cursor-not-allowed outline-none font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Date of birth *</label>
              <input 
                type="date" 
                name="dob" 
                value={formData.dob} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Gender</label>
              <select 
                name="gender" 
                value={formData.gender} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="Boy">Boy</option>
                <option value="Girl">Girl</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Centre *</label>
              <select 
                name="centre_id" 
                value={formData.centre_id} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Assigned coach *</label>
              <select 
                name="coach_id" 
                value={formData.coach_id} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="">Select...</option>
                {filteredCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Level *</label>
              <select 
                name="level" 
                value={formData.level} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="">Select...</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
              <span className="text-[10px] text-muted-custom">Mandatory — 211 of 362 current students have no level set</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">School</label>
              <input 
                type="text" 
                name="school" 
                value={formData.school} 
                onChange={handleChange} 
                placeholder="e.g. GEMS Wellington"
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>
          </div>
        </div>

        {/* PARENT / GUARDIAN SECTION */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">PARENT / GUARDIAN</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Parent name *</label>
              <input 
                type="text" 
                name="parent_name" 
                value={formData.parent_name} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Relationship</label>
              <select 
                name="relationship" 
                value={formData.relationship} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Guardian">Guardian</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Mobile (WhatsApp) *</label>
              <input 
                type="text" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange} 
                required 
                placeholder="+971 5X XXX XXXX"
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
              <span className="text-[10px] text-muted-custom">Used for renewals, reminders and reports</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Email</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Sibling at the club?</label>
              <select 
                name="sibling" 
                value={formData.sibling} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
              <span className="text-[10px] text-muted-custom">Applies sibling discount automatically</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Emergency contact</label>
              <input 
                type="text" 
                name="emergency_contact" 
                value={formData.emergency_contact} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>
          </div>
        </div>

        {/* FIRST PACKAGE SECTION */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">FIRST PACKAGE</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Package size *</label>
              <select 
                name="package_size" 
                value={formData.package_size} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="12 classes">12 classes</option>
                <option value="8 classes">8 classes</option>
                <option value="24 classes">24 classes</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Rate per class (AED) *</label>
              <input 
                type="number" 
                name="rate_per_class" 
                value={formData.rate_per_class} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none font-mono"
              />
              <span className="text-[10px] text-muted-custom">Median: Bay 100 - JLT 90</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Start date</label>
              <input 
                type="date" 
                name="start_date" 
                value={formData.start_date} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Acquisition source</label>
              <select 
                name="acquisition_source" 
                value={formData.acquisition_source} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="Instagram">Instagram</option>
                <option value="Google">Google</option>
                <option value="Referral">Referral</option>
                <option value="Word of Mouth">Word of Mouth</option>
              </select>
            </div>
          </div>

          {/* Package Calculation banner */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 border-l-4 border-l-[#C4A249] text-xs font-semibold text-ink/90">
            {packageDetails.text}
          </div>
        </div>

        {/* DOCUMENTS & CONSENT SECTION */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">DOCUMENTS & CONSENT</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Registration Form File Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Registration form</label>
              <div className="border border-dashed border-line hover:bg-canvas rounded-lg p-5 flex flex-col items-center justify-center text-xs text-muted-custom cursor-pointer transition-all">
                <span>⤒ Drop file or <b className="text-forest hover:underline">browse</b></span>
              </div>
            </div>

            {/* Student Photo File Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Student photo</label>
              <div className="border border-dashed border-line hover:bg-canvas rounded-lg p-5 flex flex-col items-center justify-center text-xs text-muted-custom cursor-pointer transition-all">
                <span>⤒ Drop file or <b className="text-forest hover:underline">browse</b></span>
              </div>
            </div>

            {/* Emirates ID File Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Emirates ID / passport</label>
              <div className="border border-dashed border-line hover:bg-canvas rounded-lg p-5 flex flex-col items-center justify-center text-xs text-muted-custom cursor-pointer transition-all">
                <span>⤒ Drop file or <b className="text-forest hover:underline">browse</b></span>
              </div>
            </div>

            {/* FIDE ID input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">FIDE ID (if any)</label>
              <input 
                type="text" 
                name="fide_id" 
                value={formData.fide_id} 
                onChange={handleChange} 
                placeholder="e.g. 366108825"
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              />
            </div>
          </div>

          {/* Consent Checkboxes */}
          <div className="flex flex-col gap-3 pt-2 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer text-ink font-medium">
              <input 
                type="checkbox" 
                name="consent_ops" 
                checked={formData.consent_ops} 
                onChange={handleChange} 
                className="rounded border-line text-forest focus:ring-forest"
              />
              Operational messages (attendance, renewals, reports)
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-ink font-medium">
              <input 
                type="checkbox" 
                name="consent_mktg" 
                checked={formData.consent_mktg} 
                onChange={handleChange} 
                className="rounded border-line text-forest focus:ring-forest"
              />
              Marketing messages
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-ink font-medium">
              <input 
                type="checkbox" 
                name="consent_media" 
                checked={formData.consent_media} 
                onChange={handleChange} 
                className="rounded border-line text-forest focus:ring-forest"
              />
              Photo / media consent
            </label>
          </div>
        </div>

        {/* Form Action Row */}
        <div className="flex justify-end gap-3 pt-4 border-t border-line">
          <button 
            type="button" 
            onClick={() => setFormData(prev => ({ ...prev, name: '' }))}
            className="bg-white border border-line hover:bg-canvas text-ink font-semibold text-xs px-5 py-2.5 rounded-lg transition-all"
          >
            Cancel
          </button>
          
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="bg-forest hover:bg-forest/90 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow transition-all"
          >
            {isSubmitting ? 'Registering...' : 'Register student'}
          </button>
        </div>

      </form>
    </div>
  );
};
