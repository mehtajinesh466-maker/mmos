import React, { useState } from 'react';
import { db } from '../lib/db';
import type { User } from '../lib/db';

interface AuditLogViewProps {
  currentUser: User;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUser }) => {
  const [filter, setFilter] = useState<string>('');
  const logs = db.getAuditLog();

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return log.action.toLowerCase().includes(term) || log.entity.toLowerCase().includes(term);
  });

  if (currentUser.role !== 'owner') {
    return (
      <div className="view">
        <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ color: 'var(--hot)' }}>Access Denied</h2>
          <div className="desc">Only Owners can view the security audit log.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="row-head">
        <div>
          <div className="eyebrow">Security & Compliance</div>
          <h1>Platform Audit Log</h1>
          <div className="sub">
            Trace of automated triggers, record modifications, and system events.
          </div>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Filter by action or entity (e.g. trigger, package)..."
            className="role-select"
            style={{ background: '#fff', color: 'var(--ink)', borderColor: 'var(--line)', maxWidth: '400px' }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
            No audit records found matching your filter.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity / Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td className="mono" style={{ fontSize: '12px' }}>
                    {new Date(log.at).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: '500' }}>{log.actor}</td>
                  <td>
                    <span className="pill" style={{ background: '#F0F6F4', color: 'var(--forest)' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '11.5px' }}>
                    <div style={{ fontWeight: '600' }}>Entity: {log.entity}</div>
                    {log.after && (
                      <div style={{ color: 'var(--muted)', marginTop: '4px' }}>
                        {typeof log.after === 'string' ? log.after : JSON.stringify(log.after).substring(0, 80) + '...'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
