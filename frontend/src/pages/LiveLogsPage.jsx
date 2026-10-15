import { useState, useEffect, useRef } from 'react';
import { getLogs } from '../services/api';
import { useSocket } from '../store/SocketContext';
import { format } from 'date-fns';
import { ScrollText, Search, Filter, Pause, Play, Download, Database } from 'lucide-react';

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444', ERROR: '#f97316', WARNING: '#f59e0b',
  INFO: '#3b82f6', DEBUG: '#8b5cf6', TRACE: '#94a3b8',
};

function LogLine({ log, highlight }) {
  const isAnom = log.anomalyResult?.isAnomaly;
  return (
    <div className={`log-line ${isAnom ? 'anomaly' : ''}`} style={{ background: highlight ? 'rgba(59,130,246,0.08)' : undefined }}>
      <span className="log-line-time">{format(new Date(log.timestamp), 'HH:mm:ss.SSS')}</span>
      <span className="log-line-severity">
        <span style={{ color: SEVERITY_COLORS[log.severity] || '#94a3b8', fontWeight: 600, fontSize: 11 }}>{log.severity?.slice(0, 4)}</span>
      </span>
      <span className="log-line-service" title={log.serviceName}>{log.serviceName || log.sourceId}</span>
      <span className="log-line-msg">{log.message}</span>
      {isAnom && (
        <span className="badge badge-critical" style={{ fontSize: 9, flexShrink: 0 }}>
          ANO {(log.anomalyResult.score * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

export default function LiveLogsPage() {
  const { getSocket } = useSocket();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [newLogIds, setNewLogIds] = useState(new Set());
  const bottomRef = useRef(null);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data } = await getLogs({ page, limit: 100, severity: severity || undefined, search: search || undefined });
      setLogs(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, [page, severity]);

  useEffect(() => {
    const t = setTimeout(fetchLogs, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Real-time new logs via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket || paused) return;
    const handler = (log) => {
      setLogs(prev => [log, ...prev.slice(0, 199)]);
      setNewLogIds(prev => new Set([...prev, log._id || log.eventId]));
      setTimeout(() => {
        setNewLogIds(prev => {
          const next = new Set(prev);
          next.delete(log._id || log.eventId);
          return next;
        });
      }, 3000);
    };
    socket.on('log:new', handler);
    return () => socket.off('log:new', handler);
  }, [getSocket, paused]);

  const displayed = logs.filter(l => {
    if (search && !l.message?.toLowerCase().includes(search.toLowerCase())) return false;
    if (severity && l.severity !== severity) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Logs</h1>
          <p className="page-subtitle">Real-time log stream from all connected sources · {total.toLocaleString()} total</p>
        </div>
        <div className="page-actions">
          <button className={`btn ${paused ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setPaused(v => !v)}>
            {paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
          </button>
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-search" style={{ flex: 1 }}>
            <Search size={13} className="filter-search-icon" />
            <input className="input" placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
          </div>
          <select className="select" style={{ width: 130 }} value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="">All Levels</option>
            {['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'TRACE'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <Database size={12} />
            <span className="badge badge-demo">DEMO DATA</span>
          </div>
          {paused && <span style={{ fontSize: 12, color: 'var(--color-amber-500)', fontWeight: 600 }}>⏸ Paused</span>}
        </div>

        {/* Log stream */}
        <div style={{ height: 600, overflowY: 'auto', background: '#fafbfc', fontFamily: 'var(--font-mono)' }}>
          {loading && !logs.length ? (
            <div className="empty-state"><p>Loading logs...</p></div>
          ) : displayed.length === 0 ? (
            <div className="empty-state">
              <ScrollText size={40} className="empty-state-icon" />
              <h3>No logs found</h3>
              <p>Adjust filters or ingest logs via the API</p>
            </div>
          ) : (
            displayed.map(log => (
              <LogLine
                key={log._id || log.eventId}
                log={log}
                highlight={newLogIds.has(log._id || log.eventId)}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span>Showing {Math.min(100, total)} of {total.toLocaleString()} logs</span>
          <div className="pagination-controls">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span style={{ fontSize: 12, padding: '0 8px' }}>Page {page}</span>
            <button className="pagination-btn" disabled={page * 100 >= total} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
