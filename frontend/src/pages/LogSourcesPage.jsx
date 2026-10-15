import { useState, useEffect } from 'react';
import { getLogSources } from '../services/api';
import { Plug, RefreshCw, Database } from 'lucide-react';
import { format } from 'date-fns';

export default function LogSourcesPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchSources() {
    setLoading(true);
    try {
      const { data } = await getLogSources({ limit: 100 });
      setSources(data.data || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchSources(); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Log Sources</h1>
          <p className="page-subtitle">{sources.length} configured log sources</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchSources}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Source ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Environment</th>
                <th>Service</th>
                <th>Hostname</th>
                <th>IP Address</th>
                <th>Team</th>
                <th>Events</th>
                <th>Rate/min</th>
                <th>Errors</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => <tr key={i}><td colSpan={13}><div className="skeleton skeleton-text" /></td></tr>)
              ) : sources.length === 0 ? (
                <tr><td colSpan={13}>
                  <div className="empty-state" style={{ padding: 48 }}>
                    <Plug size={40} className="empty-state-icon" />
                    <h3>No log sources</h3>
                    <p>Run the seed script to create demo log sources.</p>
                  </div>
                </td></tr>
              ) : sources.map(s => (
                <tr key={s._id}>
                  <td>
                    <span className={`status-dot ${s.status === 'active' ? 'healthy' : s.status === 'error' ? 'unhealthy' : 'degraded'}`} />
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.sourceId}</td>
                  <td style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                  <td><span className="badge badge-neutral">{s.sourceType}</span></td>
                  <td style={{ fontSize: 12 }}>{s.environment}</td>
                  <td style={{ fontSize: 12 }}>{s.serviceName || '—'}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.hostname}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.ipAddress || '—'}</td>
                  <td style={{ fontSize: 12 }}>{s.teamOwner || '—'}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{(s.totalEventsReceived || 0).toLocaleString()}</td>
                  <td style={{ fontSize: 12 }}>{s.ingestionRatePerMinute || 0}</td>
                  <td style={{ fontSize: 12, color: s.errorCount > 0 ? '#ef4444' : 'var(--text-tertiary)' }}>{s.errorCount || 0}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.lastSeenAt ? format(new Date(s.lastSeenAt), 'MM-dd HH:mm') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
