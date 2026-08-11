"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { registerStudent, syncDatabaseToClient } from '../app/actions';
import { useSearchParams } from 'next/navigation';

interface RegistrationProps {
  currentUser: any;
  activeCentre: string;
}

export const Registration: React.FC<RegistrationProps> = ({ currentUser, activeCentre }) => {
  const centres = db.getCentres();
  const coaches = db.getCoaches();
  const searchParams = useSearchParams();

  const bayCentre = centres.find(c => c.name === 'Bay Avenue');
  const jltCentre = centres.find(c => c.name === 'JLT');

  const visibleCentres = centres;

  const defaultCentreId = activeCentre === 'All' 
     ? (bayCentre ? bayCentre.id : (centres[0]?.id || '')) 
     : activeCentre;

  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: 'Boy',
    centre_id: defaultCentreId,
    coach_id: '',
    level: '',
    category: '',
    school: '',
    parent_name: '',
    relationship: 'Mother',
    phone: '',
    email: '',
    sibling: 'No',
    emergency_contact: '',
    package_size: '12',
    bonus_classes: '0',
    rate_per_class: '100',
    start_date: '',
    payment_method: 'cash',
    payment_status: 'paid',
    payment_remarks: '',
    acquisition_source: 'Instagram',
    fide_id: '',
    consent_ops: true,
    consent_mktg: false,
    consent_media: true
  });

  const [siblingSearchQuery, setSiblingSearchQuery] = useState('');
  const [siblingSearchResults, setSiblingSearchResults] = useState<any[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [selectedSiblingName, setSelectedSiblingName] = useState('');

  // Pre-fill form from CRM enquiry parameters
  useEffect(() => {
    const childVal = searchParams.get('child') || searchParams.get('name') || '';
    const parentVal = searchParams.get('parent') || searchParams.get('parent_name') || '';
    const phoneVal = searchParams.get('phone') || '';
    const emailVal = searchParams.get('email') || '';
    const centreVal = searchParams.get('centre_id') || '';

    if (childVal || parentVal || phoneVal || emailVal || centreVal) {
      setFormData(prev => ({
        ...prev,
        name: childVal || prev.name,
        parent_name: parentVal || prev.parent_name,
        phone: phoneVal || prev.phone,
        email: emailVal || prev.email,
        centre_id: centreVal || prev.centre_id
      }));
    }
  }, [searchParams]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [studentIdAuto, setStudentIdAuto] = useState('BAY-363 (auto)');

  const [photoUrl, setPhotoUrl] = useState('');
  const [regFormUrl, setRegFormUrl] = useState('');
  const [emiratesIdUrl, setEmiratesIdUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({});

  const [dobYear, setDobYear] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');

  const years = Array.from({ length: 30 }, (_, i) => String(2026 - i));
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  useEffect(() => {
    if (dobYear && dobMonth && dobDay) {
      const monthIdx = months.indexOf(dobMonth) + 1;
      const monthStr = monthIdx < 10 ? `0${monthIdx}` : `${monthIdx}`;
      const dayNum = parseInt(dobDay, 10);
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      setFormData(prev => ({
        ...prev,
        dob: `${dobYear}-${monthStr}-${dayStr}`
      }));
    }
  }, [dobYear, dobMonth, dobDay]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'reg_form' | 'emirates_id') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(prev => ({ ...prev, [field]: true }));
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('upload_preset', 'Master');

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/l3ec1ten/image/upload', {
        method: 'POST',
        body: uploadData,
      });
      const data = await res.json();
      if (data.secure_url) {
        if (field === 'photo') setPhotoUrl(data.secure_url);
        else if (field === 'reg_form') setRegFormUrl(data.secure_url);
        else if (field === 'emirates_id') setEmiratesIdUrl(data.secure_url);
        setSaveStatus(`✓ Uploaded successfully to Cloudinary!`);
      } else {
        alert('Upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading file to Cloudinary');
    } finally {
      setUploadProgress(prev => ({ ...prev, [field]: false }));
    }
  };

  const filteredCoaches = formData.centre_id ? coaches.filter(c => c.centre_id === formData.centre_id) : coaches;

  // Auto student ID calculation based on centre selection
  useEffect(() => {
    const prefix = formData.centre_id === jltCentre?.id ? 'JLT' : 'BAY';
    const count = db.getStudents().filter(s => s.centre_id === formData.centre_id).length;
    setStudentIdAuto(`${prefix}-${count + 1 + 100} (auto)`);
  }, [formData.centre_id, centres, jltCentre]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getPackageTotalDetails = () => {
    const classes = parseInt(formData.package_size) || 12;
    const rate = parseFloat(formData.rate_per_class) || 100;
    const baseTotal = classes * rate;
    const finalTotal = baseTotal;

    return {
      total: finalTotal,
      text: `Package total: AED ${finalTotal.toLocaleString()} · ${classes} × AED ${rate}`
    };
  };

  const packageDetails = getPackageTotalDetails();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveStatus('');

    const tiers = db.getTiers();
    const classesNum = formData.package_size || '12';
    const matchingTier = tiers.find(t => t.name.includes(`${classesNum} classes`)) 
      || tiers.find(t => t.name.includes(classesNum)) 
      || tiers[0];
    const tierId = matchingTier ? matchingTier.id : '';

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
      coach_id: formData.coach_id,
      level: formData.level || 'Beginner 1',
      category: formData.category || 'Early Starts',
      tier_id: tierId,
      package_size: formData.package_size,
      bonus_classes: formData.bonus_classes,
      rate_per_class: formData.rate_per_class,
      consent_ops: formData.consent_ops,
      consent_mktg: formData.consent_mktg,
      photo_url: photoUrl,
      family_id: selectedFamilyId || undefined,
      payment_method: formData.payment_method,
      payment_status: formData.payment_status || 'paid',
      payment_remarks: formData.payment_remarks,
      flags: {
        reg_form_url: regFormUrl,
        emirates_id_url: emiratesIdUrl,
        payment_method: formData.payment_method,
        payment_status: formData.payment_status || 'paid',
        payment_remarks: formData.payment_remarks
      }
    };

    try {
      const savedStudent = await registerStudent(payload);
      
      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);

      // T4: compute display ID (centre prefix + fide_id or id numeric part)
      const allCentres = db.getCentres();
      const centre = allCentres.find((c: any) => c.id === formData.centre_id);
      const prefix = (centre?.name || 'BAY').slice(0, 3).toUpperCase();
      const numPart = savedStudent.fide_id || savedStudent.id.replace(/\D/g, '').slice(0, 4) || '0000';
      const displayId = savedStudent.fide_id ? savedStudent.fide_id : `${prefix}-${numPart}`;

      // T5: confirmation message includes student name and ID
      setSaveStatus(`✓ ${savedStudent.name} registered successfully! ID: ${displayId}`);
      // T4: reflect the real ID on the form header
      setStudentIdAuto(displayId);
      setPhotoUrl('');
      setRegFormUrl('');
      setEmiratesIdUrl('');
      setSelectedFamilyId('');
      setSelectedSiblingName('');
      
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
        emergency_contact: '',
        bonus_classes: '0',
        payment_remarks: '',
        category: ''
      }));
    } catch (error: any) {
      console.error(error);
      setSaveStatus('❌ Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSaveStatus(''), 8000);
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
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={dobYear}
                  onChange={e => setDobYear(e.target.value)}
                  required
                  className="bg-white border border-line rounded-lg px-2 py-2 text-xs text-ink outline-none"
                >
                  <option value="">Year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  value={dobMonth}
                  onChange={e => setDobMonth(e.target.value)}
                  required
                  className="bg-white border border-line rounded-lg px-2 py-2 text-xs text-ink outline-none"
                >
                  <option value="">Month</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select
                  value={dobDay}
                  onChange={e => setDobDay(e.target.value)}
                  required
                  className="bg-white border border-line rounded-lg px-2 py-2 text-xs text-ink outline-none"
                >
                  <option value="">Day</option>
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <input type="hidden" name="dob" value={formData.dob} required />
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
                {visibleCentres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <label className="text-xs font-bold text-ink">Performance Level *</label>
              <select 
                name="level" 
                value={formData.level} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="">Select Level...</option>
                <option value="Beginner 1">Beginner 1</option>
                <option value="Beginner 2">Beginner 2</option>
                <option value="Intermediate 1">Intermediate 1</option>
                <option value="Intermediate 2">Intermediate 2</option>
                <option value="Advanced">Advanced</option>
                <option value="FIDE">FIDE</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Age Level (Category) *</label>
              <select 
                name="category" 
                value={formData.category} 
                onChange={handleChange} 
                required 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="">Select Category...</option>
                <option value="Early Starts">Early Starts</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
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
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value === 'No') {
                    setSelectedFamilyId('');
                    setSelectedSiblingName('');
                  }
                }} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
              <span className="text-[10px] text-muted-custom">Linked under the same parent/family.</span>
            </div>

            {formData.sibling === 'Yes' && (
              <div className="flex flex-col gap-2 p-3 bg-canvas border border-line rounded-lg mt-1 col-span-2">
                <label className="text-xs font-bold text-ink">Search Sibling / Parent Name or Email</label>
                <input
                  type="text"
                  placeholder="Type name or email to search..."
                  value={siblingSearchQuery}
                  onChange={(e) => {
                    setSiblingSearchQuery(e.target.value);
                    if (e.target.value.trim().length >= 2) {
                      const query = e.target.value.toLowerCase();
                      const matches = db.getStudents().filter(s => 
                        s.name.toLowerCase().includes(query) || 
                        (s.parent_name && s.parent_name.toLowerCase().includes(query))
                      );
                      // Deduplicate matches by family_id
                      const uniqueMatches: any[] = [];
                      const seenFamilies = new Set<string>();
                      matches.forEach(m => {
                        if (m.family_id && !seenFamilies.has(m.family_id)) {
                          seenFamilies.add(m.family_id);
                          uniqueMatches.push(m);
                        }
                      });
                      setSiblingSearchResults(uniqueMatches);
                    } else {
                      setSiblingSearchResults([]);
                    }
                  }}
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
                />
                
                {siblingSearchResults.length > 0 && (
                  <div className="border border-line rounded-lg bg-white max-h-32 overflow-y-auto divide-y divide-line">
                    {siblingSearchResults.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedFamilyId(s.family_id || '');
                          setSelectedSiblingName(`${s.parent_name || '—'} (Sibling: ${s.name})`);
                          setSiblingSearchQuery('');
                          setSiblingSearchResults([]);
                          
                          // Pre-fill parent's details from sibling
                          const families = db.get<any>('families') || [];
                          const matchedFamily = families.find((f: any) => f.id === s.family_id);
                          
                          setFormData(prev => ({
                            ...prev,
                            parent_name: s.parent_name || prev.parent_name,
                            phone: matchedFamily?.phone || prev.phone || '',
                            email: matchedFamily?.email || prev.email || '',
                          }));
                        }}
                        className="p-2 text-xs hover:bg-canvas cursor-pointer text-ink font-medium"
                      >
                        {s.name} (Parent: {s.parent_name || '—'})
                      </div>
                    ))}
                  </div>
                )}

                {selectedFamilyId && (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-2 text-xs font-semibold">
                    <span>Linked to: {selectedSiblingName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFamilyId('');
                        setSelectedSiblingName('');
                      }}
                      className="text-red-600 hover:text-red-800 font-bold"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

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
              <label className="text-xs font-bold text-ink">Package size (No. of classes) *</label>
              <input 
                type="number" 
                name="package_size" 
                value={formData.package_size} 
                onChange={handleChange} 
                required 
                min="1"
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Bonus classes</label>
              <input 
                type="number" 
                name="bonus_classes" 
                value={formData.bonus_classes} 
                onChange={handleChange} 
                min="0"
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none font-mono"
              />
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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Payment method *</label>
              <select 
                name="payment_method" 
                value={formData.payment_method} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="cash">Cash</option>
                <option value="bank transfer">Bank transfer</option>
                <option value="online">Online</option>
                <option value="center(POS)">Center(POS)</option>
                <option value="tabby">Tabby</option>
                <option value="others">Others</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Payment Status *</label>
              <select 
                name="payment_status" 
                value={formData.payment_status || 'paid'} 
                onChange={handleChange} 
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none"
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            {formData.payment_method === 'others' && (
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-ink">Payment method remarks</label>
                <textarea 
                  name="payment_remarks" 
                  value={formData.payment_remarks} 
                  onChange={handleChange} 
                  rows={2}
                  placeholder="Enter remarks for payment method..."
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none w-full"
                />
              </div>
            )}
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
              <input 
                type="file" 
                onChange={e => handleFileUpload(e, 'reg_form')}
                className="hidden" 
                id="reg-form-file-input"
              />
              <div 
                onClick={() => document.getElementById('reg-form-file-input')?.click()}
                className="border border-dashed border-line hover:bg-canvas rounded-lg p-5 flex flex-col items-center justify-center text-xs text-muted-custom cursor-pointer transition-all"
              >
                {uploadProgress['reg_form'] ? (
                  <span className="text-forest animate-pulse font-semibold">Uploading to Cloudinary...</span>
                ) : regFormUrl ? (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="text-forest font-bold">✓ Uploaded Registration Form</span>
                    <a href={regFormUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-muted-custom hover:underline font-mono truncate max-w-xs">{regFormUrl}</a>
                  </div>
                ) : (
                  <span>⤒ Drop file or <b className="text-forest hover:underline">browse</b></span>
                )}
              </div>
            </div>

            {/* Student Photo File Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Student photo</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => handleFileUpload(e, 'photo')}
                className="hidden" 
                id="student-photo-file-input"
              />
              <div 
                onClick={() => document.getElementById('student-photo-file-input')?.click()}
                className="border border-dashed border-line hover:bg-canvas rounded-lg p-5 flex flex-col items-center justify-center text-xs text-muted-custom cursor-pointer transition-all"
              >
                {uploadProgress['photo'] ? (
                  <span className="text-forest animate-pulse font-semibold">Uploading to Cloudinary...</span>
                ) : photoUrl ? (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <img src={photoUrl} alt="" className="w-10 h-10 object-cover rounded-full border border-line" />
                    <span className="text-forest font-bold">✓ Uploaded Photo</span>
                    <a href={photoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-muted-custom hover:underline font-mono truncate max-w-xs">{photoUrl}</a>
                  </div>
                ) : (
                  <span>⤒ Drop file or <b className="text-forest hover:underline">browse</b></span>
                )}
              </div>
            </div>

            {/* Emirates ID File Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Emirates ID / passport</label>
              <input 
                type="file" 
                onChange={e => handleFileUpload(e, 'emirates_id')}
                className="hidden" 
                id="emirates-id-file-input"
              />
              <div 
                onClick={() => document.getElementById('emirates-id-file-input')?.click()}
                className="border border-dashed border-line hover:bg-canvas rounded-lg p-5 flex flex-col items-center justify-center text-xs text-muted-custom cursor-pointer transition-all"
              >
                {uploadProgress['emirates_id'] ? (
                  <span className="text-forest animate-pulse font-semibold">Uploading to Cloudinary...</span>
                ) : emiratesIdUrl ? (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="text-forest font-bold">✓ Uploaded Emirates ID / Passport</span>
                    <a href={emiratesIdUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-muted-custom hover:underline font-mono truncate max-w-xs">{emiratesIdUrl}</a>
                  </div>
                ) : (
                  <span>⤒ Drop file or <b className="text-forest hover:underline">browse</b></span>
                )}
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
