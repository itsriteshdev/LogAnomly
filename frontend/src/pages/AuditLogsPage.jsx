import { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api';
import { Shield, Search, Database } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data } = await getAuditLogs({ page, limit: 30, search: search || undefined });
      setLogs(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchLogs(); }, [page]);
  useEffect(() => { const t = setTimeout(fetchLogs, 400); return () => clearTimeout(t); }, [search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">System activity and security event audit trail</p>
        </div>
        <span className="badge badge-demo">DEMO DATA</span>
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="filter-search" style={{ flex: 1 }}>
            <Search size={13} className="filter-search-icon" />
            <input className="input" placeholder="Search by action, actor, or target..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target Type</th>
                <th>Target ID</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => <tr key={i}><td colSpan={6}><div className="skeleton skeleton-text" /></td></tr>)
              ) : logs.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state" style={{ padding: 48 }}>
                    <Shield size={40} className="empty-state-icon" />
                    <h3>No audit logs</h3>
                    <p>Audit events appear here as users interact with the system.</p>
                  </div>
                </td></tr>
              ) : logs.map(log => (
                <tr key={log._id}>
                  <td className="mono" style={{ fontSize: 11 }}>{format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}</td>
                  <td><span className="badge badge-neutral">{log.action}</span></td>
                  <td style={{ fontSize: 12 }}>{log.actorEmail || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.targetType || '—'}</td>
                  <td className="mono" style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.targetId || '—'}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{log.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>{total} audit events</span>
          <div className="pagination-controls">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span style={{ fontSize: 12, padding: '0 8px' }}>Page {page}</span>
            <button className="pagination-btn" disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
