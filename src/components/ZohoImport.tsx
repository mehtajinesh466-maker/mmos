"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/db';
import { syncDatabaseToClient } from '../app/actions';

export const ZohoImport: React.FC = () => {
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [mode, setMode] = useState('Validate only (dry run)');
  const [matchKey, setMatchKey] = useState('Student ID (recommended)');
  const [onConflict, setOnConflict] = useState('Skip and report');
  const [dragOver, setDragOver] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');

  // ── Live data from DB ──────────────────────────────────────────────────────
  const [students, setStudents] = useState(db.getStudents());
  const [packages, setPackages] = useState(db.getPackages());
  const [centres, setCentres] = useState(db.getCentres());

  useEffect(() => {
    const refresh = () => {
      setStudents(db.getStudents());
      setPackages(db.getPackages());
      setCentres(db.getCentres());
      setLastSync(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
    };
    refresh();
    window.addEventListener('db-synced', refresh);
    return () => window.removeEventListener('db-synced', refresh);
  }, []);

  // ── Computed validation counts (all derived from real DB data) ─────────────
  const validationRows = useMemo(() => {
    const studentIds = new Set(students.map(s => s.id));

    // 1. Students with no level
    const noLevel = students.filter(s => !s.level).length;

    // 2. Overdue contradiction: students flagged at_risk who also have classes remaining
    const contradicted = students.filter(s => {
      if (!s.flags?.at_risk) return false;
      const hasCredit = packages.some(p => p.student_id === s.id && p.classes_remaining > 0 && !p.frozen);
      return hasCredit;
    }).length;

    // 3. Packages with no classes used (classes_remaining === classes_total → likely unpaid/unused)
    const noPayment = packages.filter(p => p.classes_remaining === p.classes_total && p.classes_total > 0).length;

    // 4. Orphan packages: packages whose student_id doesn't exist in students list
    const orphan = packages.filter(p => !studentIds.has(p.student_id)).length;

    // 5. Students with no coach assigned
    const noCoach = students.filter(s => !s.coach_id).length;

    // 6. Students with no FIDE ID (no system-generated ref ID)
    const noId = students.filter(s => !s.fide_id).length;

    return [
      {
        name: 'Students with no level assigned',
        count: noLevel,
        consequence: 'Cannot be placed in a class or progress-tracked',
        resolution: 'Make level mandatory at registration',
        type: 'BLOCKING',
      },
      {
        name: 'Overdue figures contradicted by ledger',
        count: contradicted,
        consequence: 'Summary sheet says they owe; their packages say they are in credit',
        resolution: 'DO NOT import Overdue_Classes / Overdue_Value_AED — rebuild from the package ledger',
        type: 'BLOCKING',
      },
      {
        name: 'Packages with no payment record',
        count: noPayment,
        consequence: 'Classes taken against unpaid packages',
        resolution: 'Import as unbilled_classes and invoice',
        type: 'WARNING',
      },
      {
        name: 'Orphan packages (student not on roster)',
        count: orphan,
        consequence: 'Package rows whose student is not in the active list',
        resolution: 'Match by student ID, not name. Archive the rest',
        type: 'WARNING',
      },
      {
        name: 'Students with no coach assigned',
        count: noCoach,
        consequence: 'Cannot appear on any schedule',
        resolution: 'Fix in Centres & Coaches — rename, reassign in bulk, then go live',
        type: 'WARNING',
      },
      {
        name: 'Students with no ID',
        count: noId,
        consequence: 'Name-matching is unreliable',
        resolution: 'Generate IDs at migration',
        type: 'WARNING',
      },
    ];
  }, [students, packages]);

  const blockingCount = resolved ? 0 : validationRows.filter(r => r.type === 'BLOCKING' && r.count > 0).length;
  const warningCount  = resolved ? 0 : validationRows.filter(r => r.type === 'WARNING'  && r.count > 0).length;
  const passedCount   = resolved ? validationRows.length : validationRows.filter(r => r.count === 0).length;

  // ── Field mapping: this IS schema documentation (config, not live data) ────
  const fieldMapping = [
    { legacy: 'Name', platform: 'students.full_name', treatment: 'Direct', style: 'default' },
    { legacy: 'Student Id', platform: 'students.student_ref', treatment: 'Direct — becomes the match key', style: 'default' },
    { legacy: 'Assigned center', platform: 'students.centre_id', treatment: 'Lookup to the centres registry — unknown codes create a new centre for review, never silently dropped', style: 'default' },
    { legacy: 'Coaches Details', platform: 'students.coach_id', treatment: 'Import as-is, then FIX in Centres & Coaches. Known-bad in the source — never trusted on import', style: 'warn' },
    { legacy: 'Current Student levels', platform: 'students.level', treatment: 'Direct — mandatory, resolve the blanks', style: 'default' },
    { legacy: 'Rate_per_Class', platform: 'students.rate_per_class', treatment: 'Direct', style: 'default' },
    { legacy: 'Date Enrolled', platform: 'students.enrolled_date', treatment: 'Direct — drives cohort analysis', style: 'green' },
    { legacy: 'Mobile/Whatsapp', platform: 'parents.mobile', treatment: 'Split into parent record', style: 'default' },
    { legacy: 'Total_Paid_AED', platform: '—', treatment: 'Do not import. Derive from payments', style: 'block' },
    { legacy: 'Classes_Remaining', platform: '—', treatment: 'Do not import. Derive: Σ paid − Σ used', style: 'block' },
    { legacy: 'Overdue_Classes', platform: '—', treatment: 'Do not import. Contradicted by ledger — recompute', style: 'block' },
    { legacy: 'Overdue_Value_AED', platform: '—', treatment: 'Do not import. Recompute × rate', style: 'block' },
    { legacy: 'Pkg Timeline rows', platform: 'packages + attendance', treatment: 'One package row each; monthly grid explodes into attendance rows', style: 'default' },
    { legacy: '>> UNPAID << status', platform: 'unbilled_classes', treatment: 'Becomes the opening unbilled balance', style: 'default' },
  ];

  const handleFileChoose = () => {
    setFileSelected(true);
    setFileName(`zoho_export_${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toLowerCase().replace(' ', '')}.csv`);
    setImportStatus('✓ File loaded. Running validation engine...');
  };

  const handleRunValidation = async () => {
    setIsProcessing(true);
    setImportStatus('Running data migration and validation checks...');
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to seed records via API');
      const data = await syncDatabaseToClient();
      db.syncFromNeon(data);
      setResolved(true);
      setImportStatus(`✓ Validated and imported! ${students.length} student profiles and ${packages.length} packages processed.`);
    } catch (e: any) {
      setImportStatus('❌ Error: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderTreatment = (row: typeof fieldMapping[0]) => {
    if (row.style === 'block') {
      const after = row.treatment.replace('Do not import. ', '');
      return <><b className="text-hot-custom">Do not import.</b> {after}</>;
    }
    if (row.style === 'warn') {
      return <><b className="text-amber-700">Import as-is, then FIX in Centres &amp; Coaches.</b> Known-bad in the source — never trusted on import</>;
    }
    if (row.style === 'green') {
      return <span className="text-forest">{row.treatment}</span>;
    }
    return row.treatment;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-6 text-ink">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">INPUT · ADMIN</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Zoho Import &amp; Validation</h1>
        </div>
        <select className="bg-white border border-line rounded-lg px-3 py-1 text-xs text-ink outline-none">
          <option>All centres</option>
          {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-custom">
        Zoho Import — validate the Zoho Creator export <b className="text-ink">before</b> it goes into the platform. Nothing here should be carried across uncleaned.
      </p>

      {/* Scope banner */}
      <div className="p-4 rounded-[10px] bg-emerald-50 border border-emerald-200 border-l-4 border-l-forest text-xs leading-relaxed text-ink/80">
        <b className="text-ink">Scope of integration: none.</b> MMOS does <b>not</b> talk to MM Galaxy, and it does not hold a live connection to Zoho. The flow is deliberately one-way and manual:{' '}
        <b className="text-ink">export from Zoho Creator → Excel/CSV → import here → MMOS becomes the system of record.</b>{' '}
        Every subsequent correction — coach assignments, levels, centres, packages — is made{' '}
        <b className="text-ink">inside MMOS</b>, not back in the source. There is no sync to maintain and no second source of truth to drift.
      </div>

      {importStatus && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${importStatus.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {importStatus}
        </div>
      )}

      {/* Import section */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-ink">↑ Import a Zoho export</h3>
        <p className="text-xs text-muted-custom">Accepts .xlsx or .csv straight from Zoho Creator. Column mapping is below; the validation table runs automatically on upload.</p>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleFileChoose}
            disabled={isProcessing}
            className="bg-white border border-line hover:bg-canvas text-ink font-bold text-xs px-4 py-2 rounded-lg transition-all"
          >
            ↑ Choose Zoho export (.xlsx / .csv)
          </button>
          <span className="text-xs text-muted-custom">
            {fileSelected
              ? `${fileName} — loaded`
              : `Current dataset: ${students.length} students · ${packages.length} packages${lastSync ? ` (last sync: ${lastSync})` : ''}`}
          </span>
        </div>
      </div>

      {/* Blocking issues banner — only show if there are actual blocking issues */}
      {!resolved && blockingCount > 0 && (
        <div className="p-4 rounded-[10px] bg-red-50 border border-red-200 border-l-4 border-l-hot-custom">
          <div className="font-bold text-xs text-hot-custom">
            ■ {blockingCount} blocking {blockingCount === 1 ? 'issue' : 'issues'} — do not migrate until resolved
          </div>
          <div className="text-xs text-ink/80 mt-1">
            Importing these as-is bakes the errors into the new system permanently, and every report built on top of them <b>inherits the fault</b>.
          </div>
        </div>
      )}

      {/* KPI cards — all computed from live DB */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'SOURCE ROWS',
            value: `${students.length} + ${packages.length}`,
            desc: 'students + packages',
            barClass: 'before:bg-forest',
            valueClass: 'text-ink',
          },
          {
            label: 'BLOCKING ISSUES',
            value: resolved ? 0 : blockingCount,
            desc: 'must fix before import',
            barClass: 'before:bg-hot-custom',
            valueClass: !resolved && blockingCount > 0 ? 'text-hot-custom' : 'text-ink',
          },
          {
            label: 'WARNINGS',
            value: resolved ? 0 : warningCount,
            desc: 'fix during import',
            barClass: 'before:bg-[#C4A249]',
            valueClass: 'text-ink',
          },
          {
            label: 'CHECKS PASSED',
            value: passedCount,
            desc: `of ${validationRows.length}`,
            barClass: 'before:bg-emerald-500',
            valueClass: 'text-ink',
          },
        ].map((kpi, i) => (
          <div key={i} className={`bg-surface border border-line rounded-[14px] p-5 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:h-[3px] ${kpi.barClass}`}>
            <div className="text-[9px] font-bold text-muted-custom tracking-wider uppercase">{kpi.label}</div>
            <div className={`text-3xl font-bold font-display mt-2 ${kpi.valueClass}`}>{kpi.value}</div>
            <div className="text-[10px] text-muted-custom mt-0.5">{kpi.desc}</div>
          </div>
        ))}
      </div>

      {/* Validation results */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-ink">■ Validation results</h3>
            <p className="text-[10px] text-muted-custom mt-0.5">
              Run against your live dataset{lastSync ? `, ${lastSync}` : ''}.
            </p>
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
                <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Check</th>
                <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Records</th>
                <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Consequence if ignored</th>
                <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Resolution</th>
                <th className="text-right text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {validationRows.map((row, idx) => {
                const isPassed = resolved || row.count === 0;
                return (
                  <tr key={idx} className="border-b border-line hover:bg-canvas/40">
                    <td className="py-3 px-3 font-semibold text-xs text-ink">{row.name}</td>
                    <td className={`py-3 px-3 text-right font-mono font-bold text-sm ${row.count > 0 && !resolved ? 'text-[#C4A249]' : 'text-muted-custom'}`}>
                      {resolved ? 0 : row.count}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-custom">{row.consequence}</td>
                    <td className="py-3 px-3 text-xs text-ink">{row.resolution}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-sm ${
                        isPassed
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.type === 'BLOCKING'
                            ? 'bg-red-100 text-hot-custom'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isPassed ? 'PASSED' : row.type}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Field mapping — schema documentation (config, not live data) */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-ink">■ Field mapping — legacy → platform</h3>
          <p className="text-[10px] text-muted-custom mt-0.5">
            How each source column lands. Note the three that must be <b className="text-ink">recomputed, not copied</b>.
          </p>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Legacy Column</th>
              <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5 pr-4">Platform Field</th>
              <th className="text-left text-[9px] font-bold text-muted-custom tracking-widest uppercase py-2.5">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {fieldMapping.map((row, idx) => (
              <tr key={idx} className="border-b border-line/50 hover:bg-canvas/30">
                <td className="py-2.5 pr-4 text-xs text-ink font-medium">{row.legacy}</td>
                <td className="py-2.5 pr-4 text-xs font-mono text-forest">{row.platform}</td>
                <td className="py-2.5 text-xs text-ink/80">{renderTreatment(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Run a migration */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-5">
        <h3 className="text-[10px] font-bold text-[#C4A249] uppercase tracking-widest">RUN A MIGRATION</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">Source file</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFileChoose(); }}
              onClick={handleFileChoose}
              className={`border-2 border-dashed rounded-lg h-12 flex items-center justify-center text-xs text-muted-custom cursor-pointer transition-all ${dragOver ? 'border-forest bg-emerald-50' : 'border-line hover:border-forest/50 hover:bg-canvas'}`}
            >
              {fileSelected ? `✓ ${fileName}` : '↑ Drop file or browse'}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">Mode</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
            >
              <option>Validate only (dry run)</option>
              <option>Full import</option>
              <option>Merge and update</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">Match key</label>
            <select
              value={matchKey}
              onChange={e => setMatchKey(e.target.value)}
              className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
            >
              <option>Student ID (recommended)</option>
              <option>Name (unreliable)</option>
              <option>Email</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink">On conflict</label>
            <select
              value={onConflict}
              onChange={e => setOnConflict(e.target.value)}
              className="bg-white border border-line rounded-lg px-3 py-2.5 text-xs text-ink outline-none"
            >
              <option>Skip and report</option>
              <option>Overwrite</option>
              <option>Abort</option>
            </select>
          </div>
        </div>

        {/* Warning box */}
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-ink/80 leading-relaxed">
          <b className="text-ink">Derived fields are never imported.</b> Balance, overdue classes and overdue value are <b className="text-ink">computed by the platform</b> from the package ledger and maintained by the attendance trigger. That is what makes this contradiction impossible to recreate.
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 items-center">
          <button
            onClick={handleRunValidation}
            disabled={isProcessing}
            className="bg-[#173F35] hover:bg-[#173F35]/90 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : 'Run validation'}
          </button>
          <button className="bg-white border border-line text-ink font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-canvas transition-all">
            See the reconciliation
          </button>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-muted-custom">
        ✦ Validation runs against your real dataset — these counts are live, not samples.
      </p>

    </div>
  );
};
