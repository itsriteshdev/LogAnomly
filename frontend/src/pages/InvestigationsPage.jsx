import { useState, useEffect } from 'react';
import { getIncidents, createIncident, updateIncident, addIncidentNote } from '../services/api';
import { format } from 'date-fns';
import { ClipboardList, Plus, Eye, X, MessageSquare, CheckCircle, Loader2, Database } from 'lucide-react';
import toast from 'react-hot-toast';

const SEV_CLASSES = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
const STATUS_CLASSES = { open: 'badge-critical', investigating: 'badge-low', resolved: 'badge-success', closed: 'badge-neutral' };

function IncidentDetailDrawer({ incident, onClose, onUpdate }) {
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSaving(true);
    try {
      await addIncidentNote(incident._id, noteContent, false);
      toast.success('Note added');
      setNoteContent('');
      onUpdate();
    } catch { toast.error('Failed to add note'); } finally { setSaving(false); }
  }

  async function handleStatusChange(status) {
    try {
      await updateIncident(incident._id, { status });
      toast.success(`Status changed to ${status}`);
      onUpdate();
    } catch { toast.error('Failed to update'); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.7)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 540, background: 'white', height: '100%', overflow: 'auto', padding: 24, boxShadow: '-10px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{incident.incidentId}</div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{incident.title}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${SEV_CLASSES[incident.severity]}`}>{incident.severity}</span>
          <span className={`badge ${STATUS_CLASSES[incident.status] || 'badge-neutral'}`}>{incident.status}</span>
          {incident.isDemo && <span className="badge badge-demo">DEMO</span>}
        </div>

        {incident.description && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{incident.description}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Created', incident.createdAt ? format(new Date(incident.createdAt), 'yyyy-MM-dd HH:mm') : '—'],
            ['Assigned', incident.assignedTo ? `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}` : 'Unassigned'],
            ['Services', (incident.affectedServices || []).join(', ') || '—'],
            ['Environment', incident.environment || '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13 }}>{val}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Actions</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['open', 'investigating', 'resolved', 'closed'].map(s => (
              <button key={s} className="btn btn-secondary btn-sm" disabled={incident.status === s}
                onClick={() => handleStatusChange(s)}>{s}</button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {incident.timeline?.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incident.timeline.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, borderLeft: '2px solid var(--border-color)', paddingLeft: 12 }}>
                  <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>{t.at ? format(new Date(t.at), 'MM-dd HH:mm') : ''}</span>
                  <span>{t.event}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Notes ({incident.notes?.length || 0})</div>
          {incident.notes?.map((n, i) => (
            <div key={i} style={{ background: 'var(--bg-input)', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 8 }}>
              <div>{n.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{n.createdAt ? format(new Date(n.createdAt), 'MM-dd HH:mm') : ''}</div>
            </div>
          ))}
          <textarea className="input" style={{ height: 70 }} placeholder="Add investigation note..." value={noteContent} onChange={e => setNoteContent(e.target.value)} />
          <button className="btn btn-primary btn-sm mt-2" onClick={handleAddNote} disabled={!noteContent.trim() || saving}>
            {saving ? <Loader2 size={12} /> : <MessageSquare size={12} />} Add Note
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateIncidentModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium', affectedServices: '' });
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createIncident({ ...form, affectedServices: form.affectedServices.split(',').map(s => s.trim()).filter(Boolean) });
      toast.success('Incident created');
      onCreate();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Create Incident</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleCreate}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief incident summary" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="input" style={{ height: 80 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Severity</label>
              <select className="select" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Affected Services (comma separated)</label>
              <input className="input" value={form.affectedServices} onChange={e => setForm(f => ({ ...f, affectedServices: e.target.value }))} placeholder="auth-service, api-gateway" />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <Loader2 size={13} /> : <Plus size={13} />} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvestigationsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function fetchIncidents() {
    setLoading(true);
    try {
      const { data } = await getIncidents({ page, limit: 20, status: statusFilter || undefined });
      setIncidents(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchIncidents(); }, [page, statusFilter]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Investigations</h1>
          <p className="page-subtitle">Incident management & response tracking</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New Incident
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filters-bar">
          <select className="select" style={{ width: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['open', 'investigating', 'resolved', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Services</th>
                <th>Assigned To</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8}><div className="skeleton skeleton-text" /></td></tr>)
              ) : incidents.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state" style={{ padding: 48 }}>
                    <ClipboardList size={40} className="empty-state-icon" />
                    <h3>No incidents found</h3>
                    <p>Create a new incident to begin tracking an investigation.</p>
                  </div>
                </td></tr>
              ) : incidents.map(inc => (
                <tr key={inc._id} style={{ cursor: 'pointer' }} onClick={() => setSelected(inc)}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--color-blue-500)' }}>{inc.incidentId}</td>
                  <td style={{ fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</td>
                  <td><span className={`badge ${SEV_CLASSES[inc.severity]}`}>{inc.severity}</span></td>
                  <td><span className={`badge ${STATUS_CLASSES[inc.status] || 'badge-neutral'}`}>{inc.status}</span></td>
                  <td style={{ fontSize: 12 }}>{(inc.affectedServices || []).join(', ') || '—'}</td>
                  <td style={{ fontSize: 12 }}>{inc.assignedTo ? `${inc.assignedTo.firstName} ${inc.assignedTo.lastName}` : <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{inc.createdAt ? format(new Date(inc.createdAt), 'MM-dd HH:mm') : '—'}</td>
                  <td><button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); setSelected(inc); }}><Eye size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>{total} incidents</span>
          <div className="pagination-controls">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span style={{ fontSize: 12, padding: '0 8px' }}>Page {page}</span>
            <button className="pagination-btn" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {selected && <IncidentDetailDrawer incident={selected} onClose={() => setSelected(null)} onUpdate={() => { fetchIncidents(); setSelected(null); }} />}
      {showCreate && <CreateIncidentModal onClose={() => setShowCreate(false)} onCreate={() => { setShowCreate(false); fetchIncidents(); }} />}
    </div>
  );
}
