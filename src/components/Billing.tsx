"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { User, Student, Invoice } from '../lib/db';
import { updateInvoiceDB, syncDatabaseToClient } from '../app/actions';

interface BillingProps {
  currentUser: User;
  activeCentre: string;
}

export const Billing: React.FC<BillingProps> = ({ currentUser, activeCentre }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    const invs = db.get<Invoice>('invoices') || [];
    const stds = db.getStudents();
    setInvoices(invs);
    setStudents(stds);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('db-synced', loadData);
    return () => window.removeEventListener('db-synced', loadData);
  }, []);

  const getStudentName = (studentId: string) => {
    const s = students.find(st => st.id === studentId);
    return s ? s.name : 'Unknown Student';
  };

  const getStudentCentre = (studentId: string) => {
    const s = students.find(st => st.id === studentId);
    if (!s) return 'Unknown Centre';
    return s.centre_id === 'c-2' || s.centre_id === 'JLT' ? 'JLT' : 'Bay Avenue';
  };

  const handleMarkPaid = async (invId: string) => {
    const invs = db.get<Invoice>('invoices') || [];
    const idx = invs.findIndex(i => i.id === invId);
    if (idx !== -1) {
      invs[idx].status = 'paid';
      db.save('invoices', invs);
      db.logAudit('invoice_payment', 'invoices', { id: invId, status: 'unpaid' }, invs[idx]);
      window.dispatchEvent(new Event('db-synced'));
      if (selectedInvoice && selectedInvoice.id === invId) {
        setSelectedInvoice(invs[idx]);
      }

      try {
        await updateInvoiceDB(invId, 'paid');
        const freshData = await syncDatabaseToClient();
        db.syncFromNeon(freshData);
        loadData();
      } catch (err) {
        console.error("Failed to sync invoice payment to server:", err);
      }
    }
  };

  const filteredInvoices = invoices.filter(i => {
    const s = students.find(st => st.id === i.student_id);
    if (!s) return true;
    if (activeCentre !== 'All' && s.centre_id !== activeCentre) return false;
    return true;
  });

  if (loading) {
    return <div className="p-10 text-center text-muted-custom">Loading Billing Register...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 text-ink">
      {/* Head */}
      <div>
        <div className="text-xs font-bold tracking-widest text-forest uppercase">MEMBERSHIP &amp; LEDGER</div>
        <h1 className="text-3xl font-bold font-display text-ink mt-1">Payment &amp; Unbilled</h1>
        <p className="text-sm text-muted-custom mt-1">Review transaction registers, payment settlement references, and print invoices.</p>
      </div>

      <div className={`grid gap-6 ${selectedInvoice ? 'grid-cols-1 lg:grid-cols-[1.4fr_1fr]' : 'grid-cols-1'}`}>
        
        {/* Left - Invoice Register */}
        <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold font-display text-ink flex items-center gap-2">
            <span className="text-forest">✚</span> Invoices Register
          </h3>
          <p className="text-xs text-muted-custom">Chronological invoice database and payment statuses.</p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Invoice ID</th>
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Student</th>
                  <th className="text-left text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Centre</th>
                  <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Amount</th>
                  <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">VAT (5%)</th>
                  <th className="text-right text-xs font-bold text-muted-custom tracking-wider uppercase py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-custom py-8">
                      No invoice transactions recorded in database.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr 
                      key={inv.id} 
                      onClick={() => setSelectedInvoice(inv)}
                      className="border-b border-line hover:bg-canvas/50 cursor-pointer transition-all"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-forest">{inv.id.substring(0, 8).toUpperCase()}</td>
                      <td className="py-4 px-4 font-semibold text-ink">{getStudentName(inv.student_id)}</td>
                      <td className="py-4 px-4 text-ink">{getStudentCentre(inv.student_id)}</td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-ink">AED {inv.amount.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right font-mono text-muted-custom">AED {(inv.vat || inv.amount * 0.05).toLocaleString()}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          inv.status === 'paid' 
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                            : 'bg-red-50 border border-red-200 text-hot-custom'
                        }`}>
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right - Printable Invoice details */}
        {selectedInvoice && (
          <div className="bg-surface border border-line rounded-[14px] overflow-hidden shadow-sm self-start">
            {/* Header banner */}
            <div className="p-6 bg-fd relative">
              <div className="text-sm font-bold tracking-widest text-brass uppercase font-display">Master Moves OS</div>
              <h2 className="text-2xl font-bold text-white mt-1">Tax Invoice</h2>
              <p className="text-[10px] text-mint mt-1 uppercase tracking-widest">Official Receipt</p>
              <span className={`absolute top-6 right-6 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                selectedInvoice.status === 'paid' 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-mint' 
                  : 'bg-hot-custom/20 border-hot-custom/40 text-brass2'
              }`}>
                {selectedInvoice.status.toUpperCase()}
              </span>
            </div>

            {/* Document Body */}
            <div className="p-6 space-y-4 text-sm text-ink/80">
              <div className="flex justify-between border-b border-line pb-3">
                <span className="text-[10px] font-bold tracking-wider text-muted-custom uppercase">BILL TO:</span>
                <span className="font-mono font-bold text-ink">INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</span>
              </div>
              
              <div className="space-y-1">
                <div><span className="text-muted-custom font-semibold">Name:</span> <span className="text-ink font-medium">{getStudentName(selectedInvoice.student_id)}</span></div>
                <div><span className="text-muted-custom font-semibold">Centre:</span> <span className="text-ink font-medium">{getStudentCentre(selectedInvoice.student_id)}</span></div>
                <div><span className="text-muted-custom font-semibold">Date:</span> <span className="text-ink font-medium">{new Date().toLocaleDateString()}</span></div>
                <div><span className="text-muted-custom font-semibold">TRN:</span> <span className="text-ink font-medium">100259837</span></div>
              </div>

              <div className="pt-4 border-t border-line">
                <div className="text-xs font-bold text-muted-custom uppercase tracking-wider mb-2">Item Breakdown</div>
                <div className="flex justify-between text-ink text-xs py-1">
                  <span>Standard Chess Coaching Package</span>
                  <span className="font-mono">AED {selectedInvoice.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-custom text-xs py-1 border-b border-line pb-2 font-sans">
                  <span>VAT @ 5%</span>
                  <span className="font-mono">AED {Number(selectedInvoice.vat || Number(selectedInvoice.amount) * 0.05).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-ink font-bold text-sm pt-3 font-sans">
                  <span>Total Paid</span>
                  <span className="font-mono text-forest">AED {(Number(selectedInvoice.amount) + Number(selectedInvoice.vat || Number(selectedInvoice.amount) * 0.05)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedInvoice.status !== 'paid' && (
                  <button 
                    onClick={() => handleMarkPaid(selectedInvoice.id)}
                    className="flex-1 bg-forest hover:bg-forest/90 text-white font-bold text-xs py-2 rounded-lg text-center"
                  >
                    Mark Paid
                  </button>
                )}
                <button 
                  onClick={() => window.print()}
                  className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-3 py-2 rounded-lg"
                >
                  Print
                </button>
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-3 py-2 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
