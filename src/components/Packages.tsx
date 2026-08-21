"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../lib/db';
import { renewPackage, renewSiblingPackage, syncDatabaseToClient, saveStudentDB } from '../app/actions';
import { useSearchParams } from 'next/navigation';

interface PackagesProps {
  currentUser: any;
  activeCentre: string;
}

export const Packages: React.FC<PackagesProps> = ({ currentUser, activeCentre }) => {
  const searchParams = useSearchParams();
  const studentIdParam = searchParams?.get('studentId') || '';

  const [students, setStudents] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(studentIdParam);
  const [packageType, setPackageType] = useState('Renewal');
  const [packageSize, setPackageSize] = useState('12');
  const [ratePerClass, setRatePerClass] = useState('100');
  const [discount, setDiscount] = useState('None');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isFamilyShared, setIsFamilyShared] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);

  // Sibling tagging and class/amount split state
  const [siblingAllocations, setSiblingAllocations] = useState<Array<{ studentId: string; classes: number; amount: number }>>([]);
  const [siblingSelectId, setSiblingSelectId] = useState('');

  // Student search filter state
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Centre state
  const [centres, setCentres] = useState<any[]>([]);
  const [selectedCentreId, setSelectedCentreId] = useState<string>('All');

  // Fetch active students, centres, tiers, packages on mount
  useEffect(() => {
    const allCentres = db.getCentres();
    setCentres(allCentres);
    setTiers(db.getTiers());
    setPackages(db.getPackages());
    setSlots(db.getScheduleSlots ? db.getScheduleSlots() : []);
    setEnrollments(db.getEnrollments ? db.getEnrollments() : []);
    setCoaches(db.getCoaches ? db.getCoaches() : []);
  }, []);

  // Sync selectedSlotIds when selectedStudentId changes
  useEffect(() => {
    if (selectedStudentId && enrollments.length > 0) {
      const studentEnrs = enrollments.filter(e => e.student_id === selectedStudentId);
      setSelectedSlotIds(studentEnrs.map(e => e.slot_id));
    } else {
      setSelectedSlotIds([]);
    }
  }, [selectedStudentId, enrollments]);

  const handleToggleSlot = (slotId: string) => {
    setSelectedSlotIds(prev => 
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  // Sync selectedCentreId with activeCentre prop if it changes
  useEffect(() => {
    if (activeCentre) {
      setSelectedCentreId(activeCentre);
    }
  }, [activeCentre]);

  // Fetch active students based on selectedCentreId
  useEffect(() => {
    let list = db.getStudents().filter(s => ['active', 'inactive', 'departed'].includes(s.status));
    if (selectedCentreId !== 'All') {
      list = list.filter(s => s.centre_id === selectedCentreId || s.id === studentIdParam);
    }
    setStudents(list);
    
    if (studentIdParam && list.some(s => s.id === studentIdParam)) {
      setSelectedStudentId(studentIdParam);
    } else if (selectedStudentId && list.some(s => s.id === selectedStudentId)) {
      // Keep currently selected student
    } else {
      setSelectedStudentId('');
    }
  }, [selectedCentreId, studentIdParam]);

  // Auto-detect first package: if student has no prior real packages, force 'New'
  useEffect(() => {
    if (!selectedStudentId) return;
    const allPkgs = db.getPackages();
    const studentPkgs = allPkgs.filter(
      p => p.student_id === selectedStudentId && p.kind !== 'unbilled' && p.kind !== 'settled'
    );
    setPackageType(studentPkgs.length === 0 ? 'New' : 'Renewal');
  }, [selectedStudentId]);

  const getCentreName = (centreId?: string) => {
    if (!centreId) return 'Unassigned';
    const c = centres.find(ctr => ctr.id === centreId);
    return c ? c.name : 'Unassigned';
  };

  const handleMoveStudentCentre = async (studentId: string, newCentreId: string) => {
    const studentToUpdate = db.getStudents().find(s => s.id === studentId);
    if (!studentToUpdate) return;

    try {
      setIsSubmitting(true);
      const updated = {
        ...studentToUpdate,
        centre_id: newCentreId
      };
      
      // 1. Update in client local storage
      db.saveStudent(updated);

      // 2. Update in Postgres database
      await saveStudentDB(updated);

      // 3. Sync from Postgres database to ensure client is in sync
      try {
        const freshData = await syncDatabaseToClient();
        db.syncFromNeon(freshData);
      } catch (syncErr) {
        console.warn("Post-update sync failed:", syncErr);
      }

      // 4. Reload local data
      let list = db.getStudents().filter(s => ['active', 'inactive', 'departed'].includes(s.status));
      if (selectedCentreId !== 'All') {
        list = list.filter(s => s.centre_id === selectedCentreId || s.id === studentIdParam);
      }
      setStudents(list);

      // Update state message
      setSaveStatus(`✓ Student centre moved to ${getCentreName(newCentreId)} successfully.`);
      setTimeout(() => setSaveStatus(''), 4000);
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('Error moving student centre: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamically calculate total
  const getPackageTotal = () => {
    const classes = parseInt(packageSize) || 12;
    const rate = parseFloat(ratePerClass) || 100;
    const baseTotal = classes * rate;
    const discountPct = discount === 'Sibling (10%)' ? 0.1 : 0;
    const total = baseTotal * (1 - discountPct);
    const text = `Total: AED ${total.toLocaleString()} · ${classes} × AED ${rate} · VAT tracked separately`;
    return { classes, total, text };
  };

  const calculatedDetails = getPackageTotal();

  // Detect siblings and auto-populate when student or discount changes
  useEffect(() => {
    if (!selectedStudentId) return;

    if (discount === 'Sibling (10%)') {
      const allDbStudents = db.getStudents();
      const primary = allDbStudents.find(s => s.id === selectedStudentId);
      if (!primary) return;

      // Find siblings by family_id or parent_name
      const siblingsInFamily = allDbStudents.filter(s => 
        s.id !== selectedStudentId && 
        ((primary.family_id && s.family_id === primary.family_id) || 
         (primary.parent_name && s.parent_name && s.parent_name.toLowerCase() === primary.parent_name.toLowerCase()))
      );

      const targetIds = Array.from(new Set([selectedStudentId, ...siblingsInFamily.map(s => s.id)]));
      const totalClasses = calculatedDetails.classes;
      const totalAmount = Math.round(calculatedDetails.total);

      const splitCount = targetIds.length || 1;
      const baseC = Math.floor(totalClasses / splitCount);
      const remC = totalClasses % splitCount;
      const baseA = Math.floor(totalAmount / splitCount);
      const remA = totalAmount % splitCount;

      const newAllocations = targetIds.map((id, index) => ({
        studentId: id,
        classes: baseC + (index === 0 ? remC : 0),
        amount: baseA + (index === 0 ? remA : 0),
      }));

      setSiblingAllocations(newAllocations);
    } else {
      setSiblingAllocations([]);
    }
  }, [selectedStudentId, discount, packageSize, ratePerClass]);

  const handleAutoSplitEvenly = () => {
    if (siblingAllocations.length === 0) return;
    const totalClasses = calculatedDetails.classes;
    const totalAmount = Math.round(calculatedDetails.total);

    const splitCount = siblingAllocations.length;
    const baseC = Math.floor(totalClasses / splitCount);
    const remC = totalClasses % splitCount;
    const baseA = Math.floor(totalAmount / splitCount);
    const remA = totalAmount % splitCount;

    setSiblingAllocations(siblingAllocations.map((item, index) => ({
      ...item,
      classes: baseC + (index === 0 ? remC : 0),
      amount: baseA + (index === 0 ? remA : 0)
    })));
  };

  const handleAddSibling = (studentIdToAdd: string) => {
    if (!studentIdToAdd || siblingAllocations.some(a => a.studentId === studentIdToAdd)) return;
    const updated = [...siblingAllocations, { studentId: studentIdToAdd, classes: 0, amount: 0 }];
    const totalClasses = calculatedDetails.classes;
    const totalAmount = Math.round(calculatedDetails.total);
    const count = updated.length;
    const baseC = Math.floor(totalClasses / count);
    const remC = totalClasses % count;
    const baseA = Math.floor(totalAmount / count);
    const remA = totalAmount % count;

    setSiblingAllocations(updated.map((item, index) => ({
      ...item,
      classes: baseC + (index === 0 ? remC : 0),
      amount: baseA + (index === 0 ? remA : 0)
    })));
    setSiblingSelectId('');
  };

  const handleRemoveSibling = (studentIdToRemove: string) => {
    if (siblingAllocations.length <= 1) return;
    const updated = siblingAllocations.filter(a => a.studentId !== studentIdToRemove);
    const totalClasses = calculatedDetails.classes;
    const totalAmount = Math.round(calculatedDetails.total);
    const count = updated.length;
    const baseC = Math.floor(totalClasses / count);
    const remC = totalClasses % count;
    const baseA = Math.floor(totalAmount / count);
    const remA = totalAmount % count;

    setSiblingAllocations(updated.map((item, index) => ({
      ...item,
      classes: baseC + (index === 0 ? remC : 0),
      amount: baseA + (index === 0 ? remA : 0)
    })));
  };

  const handleUpdateAllocation = (studentId: string, field: 'classes' | 'amount', val: number) => {
    setSiblingAllocations(prev => {
      // 1. Calculate updated item
      const nextAllocations = prev.map(item => {
        if (item.studentId === studentId) {
          return { ...item, [field]: Math.max(0, val) };
        }
        return item;
      });

      // 2. If classes was updated, recalculate the amounts proportionally
      if (field === 'classes') {
        const totalCls = nextAllocations.reduce((sum, a) => sum + a.classes, 0);
        const totalAmount = Math.round(calculatedDetails.total);

        if (totalCls > 0) {
          let runningAmountSum = 0;
          return nextAllocations.map((alloc, idx) => {
            // Last element gets the remainder to avoid rounding loss
            if (idx === nextAllocations.length - 1) {
              return { ...alloc, amount: totalAmount - runningAmountSum };
            }
            const proportionalAmount = Math.round(totalAmount * (alloc.classes / totalCls));
            runningAmountSum += proportionalAmount;
            return { ...alloc, amount: proportionalAmount };
          });
        } else {
          // If all classes are 0, split the amount evenly
          const baseA = Math.floor(totalAmount / nextAllocations.length);
          const remA = totalAmount % nextAllocations.length;
          return nextAllocations.map((alloc, idx) => ({
            ...alloc,
            amount: baseA + (idx === 0 ? remA : 0)
          }));
        }
      }

      return nextAllocations;
    });
  };

  const totalAllocatedClasses = siblingAllocations.reduce((sum, a) => sum + Number(a.classes || 0), 0);
  const totalAllocatedAmount = siblingAllocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    setIsSubmitting(true);
    setSaveStatus('');
    try {
      const classCount = calculatedDetails.classes;
      const matchedTier = tiers.find(t => {
        if (Array.isArray(t.inclusions)) {
          return t.inclusions.some((inc: string) => inc?.includes(`${classCount} class`));
        }
        return false;
      });
      const tierId = matchedTier?.id || tiers[0]?.id || 'tier-12-class';

      if (discount === 'Sibling (10%)' && siblingAllocations.length > 1) {
        await renewSiblingPackage(
          tierId,
          packageType.toLowerCase() as any,
          siblingAllocations.map(a => ({
            studentId: a.studentId,
            classes: Number(a.classes),
            amount: Number(a.amount),
            discountPct: 10
          }))
        );

        try {
          const freshData = await syncDatabaseToClient();
          db.syncFromNeon(freshData);
        } catch (syncErr) {
          console.warn("Sync failed:", syncErr);
        }

        const taggedNames = siblingAllocations
          .map(a => students.find(s => s.id === a.studentId)?.name || 'Student')
          .join(', ');

        setSaveStatus(`✓ Sibling package created! Split ${calculatedDetails.classes} classes & AED ${Math.round(calculatedDetails.total)} across tagged siblings: ${taggedNames}. (Local database sync will complete on reload).`);
        
        // Reset form inputs
        setSelectedStudentId('');
        setStudentSearchQuery('');
        setPackageType('Renewal');
        setPackageSize('12');
        setRatePerClass('100');
        setDiscount('None');
        setPaymentMethod('cash');
        setPaymentRemarks('');
        setIsFamilyShared(false);
        setSiblingAllocations([]);

        // Scroll main panel to top to show success banner
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const res = await renewPackage(
          selectedStudentId, 
          tierId, 
          packageType.toLowerCase() as any, 
          isFamilyShared,
          Number(packageSize),
          Number(ratePerClass),
          paymentMethod,
          paymentRemarks,
          selectedSlotIds
        );
        if (res && !res.success) {
          throw new Error(res.error);
        }
        try {
          const freshData = await syncDatabaseToClient();
          db.syncFromNeon(freshData);
        } catch (syncErr) {
          console.warn("Sync failed:", syncErr);
        }
        setSaveStatus('✓ Package created and saved to database! Ledger records updated. (Local database sync will complete on reload).');

        // Reset form inputs
        setSelectedStudentId('');
        setStudentSearchQuery('');
        setPackageType('Renewal');
        setPackageSize('12');
        setRatePerClass('100');
        setDiscount('None');
        setPaymentMethod('cash');
        setPaymentRemarks('');
        setIsFamilyShared(false);
        setSiblingAllocations([]);
        setSelectedSlotIds([]);

        // Scroll main panel to top to show success banner
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error: any) {
      console.error(error);
      setSaveStatus('❌ Error: ' + error.message);
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header */}
      <div className="flex justify-between items-start pb-4">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">INPUT</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">New / Renew Package</h1>
        </div>

        <div>
          <select 
            value={selectedCentreId}
            onChange={e => {
              setSelectedCentreId(e.target.value);
              setSelectedStudentId('');
              setStudentSearchQuery('');
            }}
            className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none"
          >
            <option value="All">All centres</option>
            {centres.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${saveStatus.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {saveStatus}
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-[14px] p-8 shadow-sm space-y-8">
        
        {/* PACKAGE SECTION */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">PACKAGE</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Centre Filter *</label>
              <select 
                value={selectedCentreId}
                onChange={e => {
                  setSelectedCentreId(e.target.value);
                  setSelectedStudentId('');
                  setStudentSearchQuery('');
                }}
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              >
                <option value="All">All Centres</option>
                {centres.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Primary Student *</label>
              <input 
                type="text"
                placeholder="🔍 Type student name to filter list..."
                value={studentSearchQuery}
                onChange={e => setStudentSearchQuery(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none mb-1"
              />
              <select 
                value={selectedStudentId} 
                onChange={e => setSelectedStudentId(e.target.value)}
                required
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              >
                <option value="">Select Student...</option>
                {students
                  .filter(s => s.id === selectedStudentId || s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                  .map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
              {selectedStudentId && (
                <div className="mt-1 text-[10px] text-muted-custom space-y-1">
                  {students.find(s => s.id === selectedStudentId)?.parent_name && (
                    <div>Parent Contact: <span className="font-semibold text-ink">{students.find(s => s.id === selectedStudentId)?.parent_name}</span></div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span>Current Centre: <span className="font-semibold text-ink">{getCentreName(students.find(s => s.id === selectedStudentId)?.centre_id)}</span></span>
                    <span className="text-muted-custom">·</span>
                    <span>Move to:</span>
                    <select
                      value={students.find(s => s.id === selectedStudentId)?.centre_id || ''}
                      onChange={async (e) => {
                        const newCentreId = e.target.value;
                        if (confirm(`Are you sure you want to move this student to ${getCentreName(newCentreId)}?`)) {
                          await handleMoveStudentCentre(selectedStudentId, newCentreId);
                        }
                      }}
                      className="bg-white border border-line rounded px-1.5 py-0.5 text-[10px] text-ink outline-none font-medium cursor-pointer"
                    >
                      {centres.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Type *</label>
              {(() => {
                const studentPkgs = selectedStudentId
                  ? (db.getPackages() as any[]).filter(
                      p => p.student_id === selectedStudentId && p.kind !== 'unbilled' && p.kind !== 'settled'
                    )
                  : [];
                const isFirstPkg = selectedStudentId && studentPkgs.length === 0;
                return isFirstPkg ? (
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-2 rounded-lg">
                      ✦ New (First Package — auto-detected)
                    </span>
                    <input type="hidden" value="New" />
                  </div>
                ) : (
                  <select
                    value={packageType}
                    onChange={e => setPackageType(e.target.value)}
                    className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
                  >
                    <option value="Renewal">Renewal</option>
                    <option value="New">New</option>
                    <option value="Tournament">Tournament</option>
                  </select>
                );
              })()}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Package size (Classes) *</label>
              <input 
                type="number"
                min="1"
                value={packageSize} 
                onChange={e => setPackageSize(e.target.value)}
                required
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Rate per class (AED) *</label>
              <input 
                type="number" 
                value={ratePerClass} 
                onChange={e => setRatePerClass(e.target.value)}
                required
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Discount</label>
              <select 
                value={discount} 
                onChange={e => setDiscount(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              >
                <option value="None">None</option>
                <option value="Sibling (10%)">Sibling (10%)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Payment method *</label>
              <select 
                value={paymentMethod} 
                onChange={e => setPaymentMethod(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              >
                <option value="cash">Cash</option>
                <option value="bank transfer">Bank transfer</option>
                <option value="online">Online</option>
                <option value="center(POS)">Center(POS)</option>
                <option value="tabby">Tabby</option>
                <option value="others">Others</option>
              </select>
            </div>

            {paymentMethod === 'others' && (
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-bold text-ink">Payment method remarks</label>
                <textarea 
                  value={paymentRemarks} 
                  onChange={e => setPaymentRemarks(e.target.value)}
                  rows={2}
                  placeholder="Enter remarks for payment method..."
                  className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none w-full"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Payment date</label>
              <input 
                type="date" 
                value={paymentDate} 
                onChange={e => setPaymentDate(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Expiry date</label>
              <input 
                type="date" 
                value={expiryDate} 
                onChange={e => setExpiryDate(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              />
              <span className="text-[10px] text-muted-custom">Optional — drives the renewal trigger</span>
            </div>
          </div>

          {selectedStudentId && (
            <div className="mt-6 border-t border-line pt-4 space-y-2">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <span>📅</span> Class Timings / Days Selection (Upfront)
              </label>
              <p className="text-[10px] text-muted-custom">
                Choose the days and timings for this student. The schedule will automatically generate sessions for the entire duration of the package.
              </p>
              {(() => {
                const selectedStudent = students.find(s => s.id === selectedStudentId);
                const studentCentreId = selectedStudent ? selectedStudent.centre_id : '';
                const availableSlots = slots.filter(s => 
                  s.centre_id === studentCentreId && 
                  (!selectedStudent?.coach_id || s.coach_id === selectedStudent.coach_id)
                );
                
                if (availableSlots.length === 0) {
                  return (
                    <p className="text-xs italic text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      ⚠️ No slots available for the student's centre. Create slots in the Schedule panel first.
                    </p>
                  );
                }
                
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1.5">
                    {availableSlots.map(slot => {
                      const slotCoach = coaches.find(c => c.id === slot.coach_id);
                      const coachName = slotCoach ? slotCoach.name : 'Unknown';
                      const isChecked = selectedSlotIds.includes(slot.id);
                      return (
                        <label 
                          key={slot.id}
                          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer select-none transition-all ${
                            isChecked 
                              ? 'bg-forest/5 border-forest text-ink' 
                              : 'bg-white border-line hover:bg-canvas text-ink'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSlot(slot.id)}
                            className="rounded border-line text-forest focus:ring-forest mt-0.5 w-4 h-4 cursor-pointer"
                          />
                          <div className="text-xs space-y-0.5">
                            <div className="font-bold flex items-center gap-1.5 text-ink">
                              <span>{slot.day}</span>
                              <span className="font-mono text-[10px] bg-canvas px-1.5 py-0.2 rounded border border-line">{slot.time.split('::')[0]}</span>
                            </div>
                            <div className="text-[9px] text-muted-custom">Level: {slot.level}</div>
                            <div className="text-[9px] text-muted-custom">Coach: {coachName}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex items-center gap-2 py-2 px-1">
            <input
              type="checkbox"
              id="isFamilyShared"
              checked={isFamilyShared}
              onChange={(e) => setIsFamilyShared(e.target.checked)}
              className="rounded border-line text-forest focus:ring-forest w-4 h-4 cursor-pointer"
            />
            <label htmlFor="isFamilyShared" className="text-xs font-bold text-ink cursor-pointer select-none flex items-center gap-1.5">
              <span>👪</span> Share package with siblings (Family Package)
            </label>
          </div>

          {/* Pricing Calc Box */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 border-l-4 border-l-[#C4A249] text-xs font-semibold text-ink/90">
            {calculatedDetails.text}
          </div>
        </div>

        {/* SIBLING TAGGING & SPLIT ALLOCATION SECTION */}
        {discount === 'Sibling (10%)' && (
          <div className="space-y-4 p-5 rounded-xl bg-amber-50/40 border border-amber-200/80">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-amber-200 pb-3">
              <div>
                <h3 className="text-xs font-bold text-amber-900 tracking-wider uppercase flex items-center gap-2">
                  <span>👨‍👩‍👧‍👦</span> Sibling Package Allocation & Split
                </h3>
                <p className="text-[11px] text-ink/70 mt-0.5">
                  Tag multiple sibling students under this package and split the classes & amount accordingly.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoSplitEvenly}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                ⚖️ Auto-Split Evenly
              </button>
            </div>

            {/* Tagged Siblings List */}
            <div className="space-y-3">
              {siblingAllocations.map((alloc) => {
                const student = db.getStudents().find(s => s.id === alloc.studentId);
                return (
                  <div key={alloc.studentId} className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-line shadow-xs">
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-semibold text-xs text-ink">{student?.name?.toUpperCase() || 'STUDENT'}</div>
                      <div className="text-[10px] text-muted-custom">
                        Level: {student?.level || 'Beginner'} · Centre: {getCentreName(student?.centre_id)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-medium text-ink/70">Classes:</label>
                      <input 
                        type="number" 
                        min="0"
                        value={alloc.classes}
                        onChange={e => handleUpdateAllocation(alloc.studentId, 'classes', parseInt(e.target.value) || 0)}
                        className="w-20 bg-canvas border border-line rounded px-2.5 py-1 text-xs text-ink text-center font-mono outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-medium text-ink/70">Amount (AED):</label>
                      <input 
                        type="number" 
                        min="0"
                        value={alloc.amount}
                        onChange={e => handleUpdateAllocation(alloc.studentId, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-canvas border border-line rounded px-2.5 py-1 text-xs text-ink text-center font-mono outline-none"
                      />
                    </div>

                    {siblingAllocations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSibling(alloc.studentId)}
                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 cursor-pointer font-bold"
                        title="Remove student from package"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Sibling Selector */}
            <div className="flex items-center gap-2 pt-2">
              <select
                value={siblingSelectId}
                onChange={e => setSiblingSelectId(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none flex-1 max-w-sm"
              >
                <option value="">+ Add Sibling Student...</option>
                {db.getStudents()
                  .filter(s => !siblingAllocations.some(a => a.studentId === s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name.toUpperCase()} ({s.parent_name ? `Parent: ${s.parent_name}` : getCentreName(s.centre_id)})
                    </option>
                  ))}
              </select>

              <button
                type="button"
                disabled={!siblingSelectId}
                onClick={() => handleAddSibling(siblingSelectId)}
                className="bg-forest hover:bg-forest/90 disabled:opacity-50 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                + Tag Student
              </button>
            </div>

            {/* Split Summary Footer */}
            <div className="flex flex-wrap items-center justify-between text-xs font-semibold pt-2 border-t border-amber-200/80 text-amber-950">
              <div className="flex items-center gap-2">
                <span>Classes Split:</span>
                <span className={`px-2 py-0.5 rounded ${totalAllocatedClasses === calculatedDetails.classes ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-900'}`}>
                  {totalAllocatedClasses} / {calculatedDetails.classes} classes {totalAllocatedClasses === calculatedDetails.classes ? '✓' : '⚠️'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span>Amount Split:</span>
                <span className={`px-2 py-0.5 rounded ${totalAllocatedAmount === Math.round(calculatedDetails.total) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-900'}`}>
                  AED {totalAllocatedAmount.toLocaleString()} / AED {Math.round(calculatedDetails.total).toLocaleString()} {totalAllocatedAmount === Math.round(calculatedDetails.total) ? '✓' : '⚠️'}
                </span>
              </div>
            </div>
          </div>
        )}



        {/* Action Buttons Row */}
        <div className="flex justify-end gap-3 pt-4 border-t border-line">
          <button 
            type="button" 
            onClick={() => {
              setSelectedStudentId('');
              setSiblingAllocations([]);
            }}
            className="bg-white border border-line hover:bg-canvas text-ink font-semibold text-xs px-5 py-2.5 rounded-lg transition-all"
          >
            Cancel
          </button>
          
          <button 
            type="submit" 
            disabled={isSubmitting || !selectedStudentId} 
            className="bg-forest hover:bg-forest/90 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow transition-all cursor-pointer"
          >
            {isSubmitting ? 'Processing...' : 'Create package'}
          </button>
        </div>

      </form>
    </div>
  );
};

