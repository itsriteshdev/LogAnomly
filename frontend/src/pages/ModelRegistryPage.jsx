import { useState, useEffect } from 'react';
import { getModels, trainModel, evaluateModel, promoteModel } from '../services/api';
import { Database as DbIcon, Brain, Zap, CheckCircle, Clock, Loader2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_BADGE = { production: 'badge-success', draft: 'badge-neutral', archived: 'badge-neutral', training: 'badge-low', evaluating: 'badge-medium' };

export default function ModelRegistryPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(null);

  async function fetchModels() {
    setLoading(true);
    try {
      const { data } = await getModels();
      setModels(data.data || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchModels(); }, []);

  async function handlePromote(id) {
    setPromoting(id);
    try {
      await promoteModel(id);
      toast.success('Model promoted to production');
      fetchModels();
    } catch (err) { toast.error(err.response?.data?.error || 'Promotion failed'); } finally { setPromoting(null); }
  }

  async function handleEvaluate(id) {
    try {
      const { data } = await evaluateModel(id);
      toast.success('Evaluation started');
      fetchModels();
    } catch (err) { toast.error(err.response?.data?.error || 'Evaluation failed'); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Model Registry</h1>
          <p className="page-subtitle">Manage model versions, training, evaluation, and deployment</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
        </div>
      </div>

      <div className="alert-box demo mb-4">
        <DbIcon size={13} style={{ flexShrink: 0 }} />
        <span>
          Model training and evaluation require the <strong>AI service</strong> to be running. The baseline model uses heuristics and cannot be retrained.
          The hybrid CNN+LSTM+Transformer model requires training data and compute resources.
        </span>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Registered Models ({models.length})</span>
        </div>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Model ID</th>
                <th>Version</th>
                <th>Architecture</th>
                <th>Status</th>
                <th>F1 Score</th>
                <th>P50 Latency</th>
                <th>P95 Latency</th>
                <th>Promoted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => <tr key={i}><td colSpan={9}><div className="skeleton skeleton-text" /></td></tr>)
              ) : models.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state" style={{ padding: 48 }}>
                    <Brain size={40} className="empty-state-icon" />
                    <h3>No models registered</h3>
                    <p>Register a model through the AI service or seed script.</p>
                  </div>
                </td></tr>
              ) : models.map(m => {
                const er = m.evaluationResult;
                return (
                  <tr key={m._id}>
                    <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.modelId}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{m.version}</td>
                    <td style={{ fontSize: 12 }}>{m.architecture}</td>
                    <td><span className={`badge ${STATUS_BADGE[m.status] || 'badge-neutral'}`}>{m.status}</span></td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {er?.f1Score != null ? `${(er.f1Score * 100).toFixed(1)}%` : <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{m.inferenceLatencyP50Ms ? `${m.inferenceLatencyP50Ms}ms` : '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{m.inferenceLatencyP95Ms ? `${m.inferenceLatencyP95Ms}ms` : '—'}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.promotedAt ? format(new Date(m.promotedAt), 'MM-dd HH:mm') : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => handleEvaluate(m._id)} title="Evaluate">
                          <Zap size={11} /> Eval
                        </button>
                        {m.status !== 'production' && (
                          <button className="btn btn-primary btn-xs" onClick={() => handlePromote(m._id)} disabled={promoting === m._id}>
                            {promoting === m._id ? <Loader2 size={11} /> : <CheckCircle size={11} />} Promote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
