import { useState, useEffect } from 'react';
import { getAnomalies, updateAnomalyStatus, assignAnomaly, addAnomalyNote, analyzeAnomaly } from '../services/api';
import { format } from 'date-fns';
import { AlertTriangle, Search, Filter, Eye, CheckCircle, User, MessageSquare, Zap, ChevronDown, X, Database, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const SEVERITY_CLASSES = {
  critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium',
  low: 'badge-low', info: 'badge-info',
};

function AnomalyDetailPanel({ anomaly, onClose, onStatusChange }) {
  const [notes, setNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(anomaly.explanation || null);

  async function handleStatusChange(status) {
    try {
      await updateAnomalyStatus(anomaly._id, { status });
      toast.success(`Status changed to ${status}`);
      onStatusChange();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleAddNote() {
    if (!notes.trim()) return;
    try {
      await addAnomalyNote(anomaly._id, notes);
      toast.success('Note added');
      setNotes('');
    } catch {
      toast.error('Failed to add note');
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const { data } = await analyzeAnomaly(anomaly._id);
      if (data.data?.data?.summary) {
        setAnalysis(data.data.data);
        toast.success('AI analysis complete');
      } else if (data.data?.error) {
        toast(data.data.error, { icon: 'ℹ️' });
        setAnalysis({ summary: data.data.note || 'AI service not available. Start the AI service for LangChain analysis.' });
      }
    } catch {
      toast.error('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.7)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 520, background: 'white', height: '100%', overflow: 'auto', padding: 24, boxShadow: '-10px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{anomaly.anomalyId}</div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{anomaly.category?.replace(/-/g, ' ') || 'Unknown Anomaly'}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Status + Severity */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${SEVERITY_CLASSES[anomaly.severity]}`}>{anomaly.severity}</span>
          <span className={`badge ${anomaly.status === 'resolved' ? 'badge-success' : 'badge-neutral'}`}>{anomaly.status}</span>
          {anomaly.isDemo && <span className="badge badge-demo">DEMO</span>}
        </div>

        {/* Key fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Source', anomaly.sourceId], ['Service', anomaly.serviceName || '—'],
            ['Environment', anomaly.environment], ['Score', `${(anomaly.score * 100).toFixed(1)}%`],
            ['Threshold', `${(anomaly.threshold * 100).toFixed(0)}%`], ['Method', anomaly.detectionMethod],
            ['First Seen', format(new Date(anomaly.firstSeenAt), 'yyyy-MM-dd HH:mm:ss')],
            ['Last Seen', format(new Date(anomaly.lastSeenAt), 'yyyy-MM-dd HH:mm:ss')],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontFamily: typeof value === 'string' && ['Source', 'Score', 'Threshold', 'Method'].includes(label) ? 'var(--font-mono)' : 'inherit' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Score bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Anomaly Score</span>
            <span style={{ fontWeight: 700, color: anomaly.score > 0.7 ? '#ef4444' : '#f59e0b' }}>{(anomaly.score * 100).toFixed(1)}%</span>
          </div>
          <div className="score-bar" style={{ height: 10 }}>
            <div className="score-bar-fill" style={{
              width: `${anomaly.score * 100}%`,
              background: anomaly.score > 0.8 ? '#ef4444' : anomaly.score > 0.6 ? '#f97316' : '#f59e0b',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Threshold: {(anomaly.threshold * 100)}%</div>
        </div>

        {/* AI Explanation */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>AI Analysis</div>
            <button className="btn btn-secondary btn-xs" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? <Loader2 size={11} /> : <Zap size={11} />}
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {analysis ? (
            <div className="alert-box info" style={{ fontSize: 12 }}>
              {analysis.isAIGenerated && <div style={{ fontSize: 10, color: '#1d4ed8', marginBottom: 4, fontWeight: 600 }}>AI-GENERATED HYPOTHESIS — verify with evidence</div>}
              <div>{analysis.summary}</div>
              {analysis.suggestedSteps?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested Steps:</div>
                  <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {analysis.suggestedSteps.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px', background: 'var(--bg-input)', borderRadius: 8, textAlign: 'center' }}>
              Click "Analyze" to request AI-generated explanation.<br />
              Requires running AI service with LLM provider configured.
            </div>
          )}
        </div>

        {/* Actions */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Actions</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['acknowledged', 'investigating', 'resolved', 'false-positive'].map(s => (
              <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(s)}
                disabled={anomaly.status === s}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Investigation Notes</div>
          {anomaly.notes?.map((note, i) => (
            <div key={i} style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 8 }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{note.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{format(new Date(note.createdAt), 'yyyy-MM-dd HH:mm')}</div>
            </div>
          ))}
          <textarea className="input" style={{ height: 80 }} placeholder="Add investigation notes..." value={notes} onChange={e => setNotes(e.target.value)} />
          <button className="btn btn-primary btn-sm mt-2" onClick={handleAddNote} disabled={!notes.trim()}>
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ severity: '', status: '', search: '' });

  async function fetchAnomalies() {
    setLoading(true);
    try {
      const { data } = await getAnomalies({
        page, limit: 25,
        severity: filters.severity || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      setAnomalies(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { fetchAnomalies(); }, [page, filters]);

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Anomalies</h1>
          <p className="page-subtitle">{total.toLocaleString()} total · Click a row to investigate</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge-demo">DEMO DATA</span>
        </div>
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="filter-search" style={{ flex: 1 }}>
            <Search size={13} className="filter-search-icon" />
            <input className="input" placeholder="Search anomalies..." value={filters.search}
              onChange={e => setFilter('search', e.target.value)} style={{ paddingLeft: 34 }} />
          </div>
          <select className="select" style={{ width: 130 }} value={filters.severity} onChange={e => setFilter('severity', e.target.value)}>
            <option value="">All Severities</option>
            {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" style={{ width: 140 }} value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            {['open', 'acknowledged', 'investigating', 'resolved', 'suppressed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Source</th>
                <th>Service</th>
                <th>Env</th>
                <th>Score</th>
                <th>Method</th>
                <th>Model</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}><td colSpan={12}><div className="skeleton skeleton-text" /></td></tr>
                ))
              ) : anomalies.length === 0 ? (
                <tr><td colSpan={12}>
                  <div className="empty-state" style={{ padding: 48 }}>
                    <CheckCircle size={40} className="empty-state-icon" />
                    <h3>No anomalies found</h3>
                    <p>Try adjusting your filters or wait for new detections.</p>
                  </div>
                </td></tr>
              ) : anomalies.map(a => (
                <tr key={a._id} style={{ cursor: 'pointer' }} onClick={() => setSelected(a)}>
                  <td className="mono">{format(new Date(a.firstSeenAt), 'MM-dd HH:mm:ss')}</td>
                  <td><span className={`badge ${SEVERITY_CLASSES[a.severity] || 'badge-neutral'}`}>{a.severity}</span></td>
                  <td><span style={{ fontSize: 11 }}>{a.category?.replace(/-/g, ' ')}</span></td>
                  <td className="truncate" style={{ maxWidth: 120, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.sourceId}</td>
                  <td className="truncate" style={{ maxWidth: 120 }}>{a.serviceName || '—'}</td>
                  <td><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.environment}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div className="score-bar" style={{ width: 36, flexShrink: 0 }}>
                        <div className="score-bar-fill" style={{ width: `${a.score * 100}%`, background: a.score > 0.8 ? '#ef4444' : '#f59e0b' }} />
                      </div>
                      <span className="mono" style={{ fontSize: 11 }}>{(a.score * 100).toFixed(0)}</span>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.detectionMethod}</span></td>
                  <td className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{a.modelVersion}</td>
                  <td>
                    <span className={`badge ${a.status === 'resolved' ? 'badge-success' : a.status === 'open' ? 'badge-critical' : 'badge-neutral'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); setSelected(a); }}>
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>{total.toLocaleString()} total anomalies</span>
          <div className="pagination-controls">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span style={{ fontSize: 12, padding: '0 8px' }}>Page {page} of {Math.ceil(total / 25) || 1}</span>
            <button className="pagination-btn" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {selected && (
        <AnomalyDetailPanel
          anomaly={selected}
          onClose={() => setSelected(null)}
          onStatusChange={() => { fetchAnomalies(); setSelected(null); }}
        />
      )}
    </div>
  );
}
