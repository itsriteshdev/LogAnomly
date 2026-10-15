import { useState, useEffect } from 'react';
import { getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, testAlertRule, getAlertEvents } from '../services/api';
import { Zap, Plus, X, Trash2, Play, Edit2, Bell, CheckCircle, Loader2, Database } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AlertsPage() {
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('rules');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [rulesRes, eventsRes] = await Promise.allSettled([getAlertRules(), getAlertEvents({ limit: 50 })]);
      if (rulesRes.status === 'fulfilled') setRules(rulesRes.value.data.data || []);
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.data.data || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  async function handleToggle(rule) {
    try {
      await updateAlertRule(rule._id, { enabled: !rule.enabled });
      toast.success(`Rule ${!rule.enabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch { toast.error('Failed'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this alert rule?')) return;
    try { await deleteAlertRule(id); toast.success('Deleted'); fetchData(); } catch { toast.error('Failed'); }
  }

  async function handleTest(id) {
    try {
      const { data } = await testAlertRule(id);
      toast.success(`Test: ${data.data?.matched || 0} matching anomalies`);
    } catch { toast.error('Test failed'); }
  }

  function CreateRuleModal() {
    const [form, setForm] = useState({ name: '', description: '', severityThreshold: 'critical', anomalyScoreThreshold: 0.85, cooldownMinutes: 15 });
    const [saving, setSaving] = useState(false);

    async function handleCreate(e) {
      e.preventDefault();
      setSaving(true);
      try {
        await createAlertRule({
          name: form.name,
          description: form.description,
          conditions: { severityThreshold: form.severityThreshold, anomalyScoreThreshold: parseFloat(form.anomalyScoreThreshold) },
          cooldownMinutes: parseInt(form.cooldownMinutes),
          notifications: [{ channel: 'in-app', enabled: true }],
        });
        toast.success('Rule created');
        setShowCreate(false);
        fetchData();
      } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setSaving(false); }
    }

    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Create Alert Rule</span>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Rule Name</label>
                <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Critical Anomaly Alert" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Min Severity</label>
                  <select className="select" value={form.severityThreshold} onChange={e => setForm(f => ({ ...f, severityThreshold: e.target.value }))}>
                    {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Score Threshold</label>
                  <input className="input" type="number" step="0.05" min="0" max="1" value={form.anomalyScoreThreshold}
                    onChange={e => setForm(f => ({ ...f, anomalyScoreThreshold: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cooldown (min)</label>
                  <input className="input" type="number" min="1" value={form.cooldownMinutes}
                    onChange={e => setForm(f => ({ ...f, cooldownMinutes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <Loader2 size={13} /> : <Plus size={13} />} Create Rule
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts & Rules</h1>
          <p className="page-subtitle">Configure alert rules and view triggered events</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New Rule
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-4">
        <button className={`tab-btn ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>
          <Zap size={14} /> Rules ({rules.length})
        </button>
        <button className={`tab-btn ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
          <Bell size={14} /> Events ({events.length})
        </button>
      </div>

      {tab === 'rules' ? (
        <div className="card">
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>Name</th>
                  <th>Severity ≥</th>
                  <th>Score ≥</th>
                  <th>Cooldown</th>
                  <th>Notifications</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(3)].map((_, i) => <tr key={i}><td colSpan={7}><div className="skeleton skeleton-text" /></td></tr>)
                ) : rules.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state" style={{ padding: 48 }}>
                      <Zap size={40} className="empty-state-icon" />
                      <h3>No alert rules</h3>
                      <p>Create your first alert rule to receive notifications.</p>
                    </div>
                  </td></tr>
                ) : rules.map(r => (
                  <tr key={r._id}>
                    <td>
                      <button onClick={() => handleToggle(r)} style={{
                        width: 36, height: 20, borderRadius: 10, background: r.enabled ? '#22c55e' : '#e2e8f0',
                        position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s',
                      }}>
                        <span style={{
                          position: 'absolute', top: 2, left: r.enabled ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </td>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td><span className={`badge badge-${r.conditions?.severityThreshold || 'info'}`}>{r.conditions?.severityThreshold || '—'}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.conditions?.anomalyScoreThreshold ? `${(r.conditions.anomalyScoreThreshold * 100).toFixed(0)}%` : '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.cooldownMinutes}min</td>
                    <td style={{ fontSize: 12 }}>{(r.notifications || []).filter(n => n.enabled).map(n => n.channel).join(', ') || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => handleTest(r._id)} title="Test"><Play size={11} /></button>
                        <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(r._id)} title="Delete"><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Rule</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr><td colSpan={5}>
                    <div className="empty-state" style={{ padding: 48 }}>
                      <Bell size={40} className="empty-state-icon" />
                      <h3>No alert events</h3>
                      <p>Events appear here when alert rules are triggered by detected anomalies.</p>
                    </div>
                  </td></tr>
                ) : events.map(ev => (
                  <tr key={ev._id}>
                    <td className="mono" style={{ fontSize: 11 }}>{ev.firedAt ? format(new Date(ev.firedAt), 'MM-dd HH:mm:ss') : '—'}</td>
                    <td style={{ fontSize: 12 }}>{ev.ruleName || '—'}</td>
                    <td><span className={`badge badge-${ev.severity || 'info'}`}>{ev.severity || '—'}</span></td>
                    <td><span className={`badge ${ev.acknowledged ? 'badge-success' : 'badge-critical'}`}>{ev.acknowledged ? 'Ack' : 'Active'}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.summary || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateRuleModal />}
    </div>
  );
}
