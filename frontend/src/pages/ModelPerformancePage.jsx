import { useState, useEffect } from 'react';
import { getModels, getActiveModel, getModelEvaluations } from '../services/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Brain, Database, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ModelPerformancePage() {
  const [activeModel, setActiveModel] = useState(null);
  const [models, setModels] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const [activeRes, modelsRes] = await Promise.allSettled([
        getActiveModel(),
        getModels(),
      ]);
      if (activeRes.status === 'fulfilled') {
        setActiveModel(activeRes.value.data.data);
        if (activeRes.value.data.data?._id) {
          const evalRes = await getModelEvaluations(activeRes.value.data.data._id);
          setEvaluations(evalRes.data.data || []);
        }
      }
      if (modelsRes.status === 'fulfilled') setModels(modelsRes.value.data.data || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  const am = activeModel;
  const er = am?.evaluationResult;
  const hasMetrics = er?.precision !== null && er?.precision !== undefined;

  const perfData = hasMetrics ? [
    { metric: 'Precision', value: parseFloat((er.precision * 100).toFixed(1)) },
    { metric: 'Recall', value: parseFloat((er.recall * 100).toFixed(1)) },
    { metric: 'F1 Score', value: parseFloat((er.f1Score * 100).toFixed(1)) },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Model Performance</h1>
          <p className="page-subtitle">Evaluation metrics, latency, and drift monitoring</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Active model card */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Active Production Model</span>
          {am && <span className={`badge ${am.status === 'production' ? 'badge-success' : 'badge-neutral'}`}>{am.status}</span>}
        </div>
        <div className="card-body">
          {loading ? (
            <div className="skeleton" style={{ height: 100 }} />
          ) : !am ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <Brain size={40} className="empty-state-icon" />
              <h3>No Model Deployed</h3>
              <p>Register and promote a model from the Model Registry to see performance metrics here.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
                {[
                  ['Model ID', am.modelId, '#3b82f6'],
                  ['Version', am.version, '#8b5cf6'],
                  ['Architecture', am.architecture, '#14b8a6'],
                  ['P50 Latency', am.inferenceLatencyP50Ms ? `${am.inferenceLatencyP50Ms}ms` : 'N/A', '#f59e0b'],
                  ['P95 Latency', am.inferenceLatencyP95Ms ? `${am.inferenceLatencyP95Ms}ms` : 'N/A', '#f97316'],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Eval metrics */}
              {hasMetrics ? (
                <div className="grid-2">
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Classification Metrics</h3>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={perfData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="metric" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => `${v}%`} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            <Cell fill="#3b82f6" />
                            <Cell fill="#8b5cf6" />
                            <Cell fill="#14b8a6" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Evaluation Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        ['Precision', er.precision],
                        ['Recall', er.recall],
                        ['F1 Score', er.f1Score],
                        ['Threshold', er.threshold],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{val !== null && val !== undefined ? (val * 100).toFixed(2) + '%' : 'N/A'}</span>
                        </div>
                      ))}
                      {er.evaluatedAt && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                          Evaluated: {new Date(er.evaluatedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert-box warning">
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>No evaluation metrics available.</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {am.architecture === 'baseline-statistical'
                        ? 'The baseline-statistical scorer uses heuristics and does not have trained evaluation metrics. Precision/Recall/F1 require running an evaluation with a labeled test dataset.'
                        : 'Run an evaluation job from the Model Registry to compute precision, recall, and F1 score.'}
                    </div>
                    {er?.note && <div style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>{er.note}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Evaluation history */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Evaluation History</span>
        </div>
        <div className="card-body">
          {evaluations.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <Activity size={32} className="empty-state-icon" />
              <h3>No evaluations yet</h3>
              <p>Trigger an evaluation run from the Model Registry to see historical performance data.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Status</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>Threshold</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map(ev => (
                    <tr key={ev._id}>
                      <td className="mono" style={{ fontSize: 11 }}>{ev.runId || ev._id}</td>
                      <td><span className={`badge ${ev.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}>{ev.status}</span></td>
                      <td className="mono">{ev.metrics?.precision != null ? (ev.metrics.precision * 100).toFixed(2) + '%' : '—'}</td>
                      <td className="mono">{ev.metrics?.recall != null ? (ev.metrics.recall * 100).toFixed(2) + '%' : '—'}</td>
                      <td className="mono">{ev.metrics?.f1Score != null ? (ev.metrics.f1Score * 100).toFixed(2) + '%' : '—'}</td>
                      <td className="mono">{ev.metrics?.threshold ?? '—'}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
