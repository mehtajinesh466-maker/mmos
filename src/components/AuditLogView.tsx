"use client";

import React, { useState } from 'react';
import { db } from '../lib/db';
import type { User } from '../lib/db';
import { generateOnlineBackup } from '../app/actions';

interface AuditLogViewProps {
  currentUser: User;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUser }) => {
  const [filter, setFilter] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupMsg, setBackupMsg] = useState<string>('');

  const logs = db.getAuditLog();

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    const actorStr = String(log.actor || '').toLowerCase();
    const actionStr = String(log.action || '').toLowerCase();
    const entityStr = String(log.entity || '').toLowerCase();
    return actionStr.includes(term) || entityStr.includes(term) || actorStr.includes(term);
  });

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    setBackupMsg('');
    try {
      const backupData = await generateOnlineBackup();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `master_moves_os_server_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMsg(`✓ Daily online server backup generated! ${backupData.counts.students} students, ${backupData.counts.attendance} attendance records & ${backupData.counts.packages} packages safeguarded.`);
    } catch (err: any) {
      setBackupMsg('❌ Backup failed: ' + err.message);
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setBackupMsg(''), 6000);
    }
  };

  if (currentUser.role !== 'owner' && currentUser.role !== 'front_desk') {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-hot-custom">
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-xs text-ink/70 mt-1">Only Authorized Admin and Office team can view security audit logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-6 text-ink">
      
      {/* Top Header Row */}
      <div className="flex flex-wrap justify-between items-start gap-4 pb-2 border-b border-line">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-[#C4A249] uppercase">SECURITY & COMPLIANCE</div>
          <h1 className="text-3xl font-bold font-display text-ink mt-0.5">Platform Audit Log & Backups</h1>
          <p className="text-xs text-muted-custom mt-1">
            Complete trace of user modifications (edits & deletions) and daily automated online server backups.
          </p>
        </div>

        <button
          onClick={handleTriggerBackup}
          disabled={isBackingUp}
          className="bg-forest hover:bg-forest/90 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>☁️</span>
          <span>{isBackingUp ? 'Generating Backup...' : 'Generate Online Server Backup'}</span>
        </button>
      </div>

      {backupMsg && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${backupMsg.startsWith('❌') ? 'bg-red-50 border-red-200 text-hot-custom' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {backupMsg}
        </div>
      )}

      {/* Audit Log Card */}
      <div className="bg-surface border border-line rounded-[14px] p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <input
            type="text"
            placeholder="Filter by action, actor, or entity (e.g. attendance, update, delete)..."
            className="bg-white border border-line rounded-lg px-3 py-2 text-xs text-ink outline-none w-full max-w-md"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />

          <span className="text-xs font-semibold text-muted-custom">{filteredLogs.length} audit entries</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-custom border border-dashed border-line rounded-lg">
            No audit records found matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="border-b border-line bg-canvas">
                <tr className="text-left text-[10px] font-bold text-muted-custom uppercase tracking-wider">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Actor / User</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Entity</th>
                  <th className="py-3 px-3">Change Details (Before / After)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredLogs.map(log => {
                  const actionUpper = String(log.action || '').toUpperCase();
                  const isDelete = actionUpper.includes('DELETE');
                  const isUpdate = actionUpper.includes('UPDATE');
                  const isCreate = actionUpper.includes('CREATE') || actionUpper.includes('SAVE');
                  
                  const badgeClass = isDelete 
                    ? 'bg-red-100 text-red-800 border-red-200' 
                    : isUpdate 
                    ? 'bg-amber-100 text-amber-900 border-amber-200' 
                    : isCreate 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                    : 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <tr key={log.id} className="hover:bg-canvas/50 transition-all">
                      <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap text-muted-custom">
                        {new Date(log.at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-ink whitespace-nowrap">
                        {log.actor || 'System'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${badgeClass}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs font-semibold text-ink">
                        {log.entity}
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        {log.before && (
                          <div className="text-red-700 font-mono text-[10px] truncate max-w-md">
                            <span className="font-bold uppercase">Before:</span> {typeof log.before === 'string' ? log.before : JSON.stringify(log.before).substring(0, 100)}
                          </div>
                        )}
                        {log.after && (
                          <div className="text-emerald-800 font-mono text-[10px] truncate max-w-md mt-0.5">
                            <span className="font-bold uppercase">After:</span> {typeof log.after === 'string' ? log.after : JSON.stringify(log.after).substring(0, 100)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

