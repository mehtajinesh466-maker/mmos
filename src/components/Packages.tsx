"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { renewPackage, renewSiblingPackage, syncDatabaseToClient } from '../app/actions';
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
  const [selectedStudentId, setSelectedStudentId] = useState(studentIdParam);
  const [packageType, setPackageType] = useState('Renewal');
  const [packageSize, setPackageSize] = useState('12 classes');
  const [ratePerClass, setRatePerClass] = useState('100');
  const [discount, setDiscount] = useState('None');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Sibling tagging and class/amount split state
  const [siblingAllocations, setSiblingAllocations] = useState<Array<{ studentId: string; classes: number; amount: number }>>([]);
  const [siblingSelectId, setSiblingSelectId] = useState('');

  // Fetch active students and tiers on mount
  useEffect(() => {
    let list = db.getStudents().filter(s => s.status === 'active');
    if (activeCentre !== 'All') {
      list = list.filter(s => s.centre_id === activeCentre || s.id === studentIdParam);
    }
    setStudents(list);
    if (studentIdParam && list.some(s => s.id === studentIdParam)) {
      setSelectedStudentId(studentIdParam);
    } else if (list.length > 0) {
      setSelectedStudentId(list[0].id);
    }
    setTiers(db.getTiers());
  }, [activeCentre, studentIdParam]);

  // Dynamically calculate total
  const getPackageTotal = () => {
    const classes = parseInt(packageSize) || 12;
    const rate = parseFloat(ratePerClass) || 100;
    const baseTotal = classes * rate;
    const discountPct = discount === 'Sibling (10%)' ? 0.1 : 0;
    const total = baseTotal * (1 - discountPct);
    return {
      classes,
      total,
      text: `Total: AED ${total.toLocaleString()} · ${classes} × AED ${rate} · VAT tracked separately`
    };
  };

  const calculatedDetails = getPackageTotal();

  // Detect siblings and auto-populate when student or discount changes
  useEffect(() => {
    if (!selectedStudentId) return;

    if (discount === 'Sibling (10%)') {
      const primary = students.find(s => s.id === selectedStudentId);
      if (!primary) return;

      // Find siblings by family_id or parent_name
      const siblingsInFamily = students.filter(s => 
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
    setSiblingAllocations(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return { ...item, [field]: Math.max(0, val) };
      }
      return item;
    }));
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

        const freshData = await syncDatabaseToClient();
        db.syncFromNeon(freshData);

        const taggedNames = siblingAllocations
          .map(a => students.find(s => s.id === a.studentId)?.name || 'Student')
          .join(', ');

        setSaveStatus(`✓ Sibling package created! Split ${calculatedDetails.classes} classes & AED ${Math.round(calculatedDetails.total)} across tagged siblings: ${taggedNames}.`);
      } else {
        await renewPackage(selectedStudentId, tierId, packageType.toLowerCase() as any);
        const freshData = await syncDatabaseToClient();
        db.syncFromNeon(freshData);
        setSaveStatus('✓ Package created and saved to database! Ledger records updated.');
      }
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
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">New / Renew Package</h1>
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
        ✍ <b className="text-ink">New / renew package.</b> Price and discounts compute automatically. On save the balance is topped up and the renewal alert clears.
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-[14px] p-8 shadow-sm space-y-8">
        
        {/* PACKAGE SECTION */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">PACKAGE</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Primary Student *</label>
              <select 
                value={selectedStudentId} 
                onChange={e => setSelectedStudentId(e.target.value)}
                required
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              >
                <option value="">Select Student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Type *</label>
              <select 
                value={packageType} 
                onChange={e => setPackageType(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
              >
                <option value="Renewal">Renewal</option>
                <option value="New">New</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">Package size *</label>
              <select 
                value={packageSize} 
                onChange={e => setPackageSize(e.target.value)}
                className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
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
                const student = students.find(s => s.id === alloc.studentId);
                return (
                  <div key={alloc.studentId} className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-line shadow-xs">
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-semibold text-xs text-ink">{student?.name?.toUpperCase() || 'STUDENT'}</div>
                      <div className="text-[10px] text-muted-custom">
                        Level: {student?.level || 'Beginner'} · Centre: {student?.centre_id || 'Main'}
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
                {students
                  .filter(s => !siblingAllocations.some(a => a.studentId === s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name.toUpperCase()} ({s.parent_name ? `Parent: ${s.parent_name}` : s.centre_id})
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

        {/* OUTSTANDING CHECK SECTION */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#C4A249] tracking-wider uppercase border-b border-line pb-2">OUTSTANDING CHECK</h3>
          
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 border-l-4 border-l-hot-custom text-xs leading-relaxed text-ink/90">
            <b className="text-hot-custom">Blocked if unpaid.</b> If this student has unbilled classes, the platform adds them to this invoice — it will not start a fresh package on top of an unpaid balance. That rule is what closes the unbilled-class leak (defensible range AED 62–76K from the package ledger).
          </div>
        </div>

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

