import { useState, useEffect } from 'react';
import {
  getDashboardSummary, getLogVolume, getAnomalyDistribution,
  getAnomalyTypes, getServerHealthSummary, getAnomalies
} from '../services/api';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Server, Activity, AlertTriangle, Zap, Brain, TrendingUp,
  CheckCircle, Clock, RefreshCw, Eye, ChevronRight, Database,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSocket } from '../store/SocketContext';

const SEVERITY_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b',
  low: '#3b82f6', info: '#8b5cf6',
};

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#64748b'];

function MetricCard({ label, value, icon: Icon, accentColor = '#3b82f6', sub, isDemo, tooltip, onClick }) {
  return (
    <div className="metric-card" style={{ '--metric-accent': accentColor }} onClick={onClick} title={tooltip}>
      <div className="metric-card-top">
        <span className="metric-card-label">{label}</span>
        <div className="metric-card-icon" style={{ background: `${accentColor}18` }}>
          <Icon size={15} color={accentColor} />
        </div>
      </div>
      <div className="metric-card-value">
        {value === null || value === undefined ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>N/A</span> : value}
      </div>
      {sub && <div className="metric-card-change neutral">{sub}</div>}
      {isDemo && <span className="badge badge-demo" style={{ fontSize: 9, marginTop: 2, alignSelf: 'flex-start' }}>DEMO</span>}
    </div>
  );
}

function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity}`}>{severity}</span>;
}

function AnomalyTable({ anomalies, loading }) {
  if (loading) return (
    <div style={{ padding: 20 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 12, width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );

  if (!anomalies.length) return (
    <div className="empty-state" style={{ padding: 48 }}>
      <CheckCircle size={40} className="empty-state-icon" />
      <h3>No anomalies in period</h3>
      <p>Great news! No anomalies detected in the selected time range.</p>
    </div>
  );

  return (
    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Severity</th>
            <th>Source</th>
            <th>Service</th>
            <th>Category</th>
            <th>Score</th>
            <th>Method</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map(a => (
            <tr key={a._id}>
              <td className="mono">{format(new Date(a.firstSeenAt), 'MM-dd HH:mm:ss')}</td>
              <td><SeverityBadge severity={a.severity} /></td>
              <td className="truncate" style={{ maxWidth: 120 }}>{a.sourceId}</td>
              <td className="truncate" style={{ maxWidth: 120 }}>{a.serviceName || '—'}</td>
              <td>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {a.category?.replace('-', ' ')}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                  <div className="score-bar" style={{ width: 40, flexShrink: 0 }}>
                    <div className="score-bar-fill" style={{
                      width: `${a.score * 100}%`,
                      background: a.score > 0.8 ? '#ef4444' : a.score > 0.6 ? '#f97316' : '#f59e0b',
                    }} />
                  </div>
                  <span className="mono" style={{ fontSize: 11 }}>{(a.score * 100).toFixed(0)}%</span>
                </div>
              </td>
              <td><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.detectionMethod}</span></td>
              <td>
                <span className={`badge ${
                  a.status === 'resolved' ? 'badge-success' :
                  a.status === 'investigating' ? 'badge-low' :
                  a.status === 'acknowledged' ? 'badge-medium' :
                  'badge-critical'
                }`}>{a.status}</span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-xs" title="View details">
                    <Eye size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { getSocket } = useSocket();
  const [summary, setSummary] = useState(null);
  const [logVolume, setLogVolume] = useState([]);
  const [anomalyTypes, setAnomalyTypes] = useState([]);
  const [anomalyDist, setAnomalyDist] = useState([]);
  const [serverHealth, setServerHealth] = useState([]);
  const [recentAnomalies, setRecentAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dateRange, setDateRange] = useState('24h');

  const dateRanges = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };

  async function fetchData() {
    setLoading(true);
    const ms = dateRanges[dateRange] || dateRanges['24h'];
    const to = new Date();
    const from = new Date(to - ms);

    try {
      const [sumRes, volRes, typeRes, distRes, healthRes, anomRes] = await Promise.allSettled([
        getDashboardSummary({ from: from.toISOString(), to: to.toISOString() }),
        getLogVolume({ from: from.toISOString(), to: to.toISOString() }),
        getAnomalyTypes({ from: from.toISOString(), to: to.toISOString() }),
        getAnomalyDistribution({ from: from.toISOString(), to: to.toISOString() }),
        getServerHealthSummary(),
        getAnomalies({ limit: 20, sortBy: 'firstSeenAt', sortDir: 'desc' }),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data.data);
      if (volRes.status === 'fulfilled') {
        // Transform log volume data
        const raw = volRes.value.data.data || [];
        const map = {};
        raw.forEach(({ _id, count }) => {
          const time = _id.time;
          if (!map[time]) map[time] = { time, normal: 0, anomalous: 0 };
          if (_id.isAnomaly) map[time].anomalous += count;
          else map[time].normal += count;
        });
        setLogVolume(Object.values(map).sort((a, b) => a.time.localeCompare(b.time)));
      }
      if (typeRes.status === 'fulfilled') setAnomalyTypes(typeRes.value.data.data || []);
      if (distRes.status === 'fulfilled') setAnomalyDist(distRes.value.data.data || []);
      if (healthRes.status === 'fulfilled') setServerHealth(healthRes.value.data.data || []);
      if (anomRes.status === 'fulfilled') setRecentAnomalies(anomRes.value.data.data || []);

      setLastUpdated(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => fetchData();
    socket.on('metrics:update', handler);
    socket.on('anomaly:new', () => {
      getAnomalies({ limit: 20, sortBy: 'firstSeenAt', sortDir: 'desc' })
        .then(r => setRecentAnomalies(r.data.data || []));
    });
    return () => {
      socket.off('metrics:update', handler);
      socket.off('anomaly:new');
    };
  }, [getSocket]);

  const s = summary;

  const logVolumeFormatted = logVolume.map(d => ({
    ...d,
    timeLabel: d.time ? d.time.slice(11, 16) || d.time.slice(5, 10) : d.time,
  }));

  return (
    <div>
      {/* ── PAGE HEADER ─────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Observability Dashboard</h1>
          <p className="page-subtitle">
            Hybrid Deep Learning Anomaly Detection · {lastUpdated ? `Last updated ${format(lastUpdated, 'HH:mm:ss')}` : 'Loading...'}
          </p>
        </div>
        <div className="page-actions">
          {/* Date range selector */}
          {['1h', '6h', '24h', '7d'].map(r => (
            <button
              key={r}
              className={`btn ${dateRange === r ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setDateRange(r)}
            >{r}</button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── DEMO NOTICE ─────────────── */}
      <div className="alert-box demo mb-4">
        <Database size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>[DEMO DATA]</strong> Metrics are computed from seeded demonstration records, not production systems.
          Anomaly scores use the <strong>baseline-statistical</strong> method, not the trained hybrid model.
          Run <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>npm run seed</code> in the backend to reset data.
        </span>
      </div>

      {/* ── KPI CARDS ─────────────── */}
      {loading && !summary ? (
        <div className="grid-4 mb-6">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}
        </div>
      ) : (
        <div className="grid-4 mb-6">
          <MetricCard label="Total Sources" value={s?.sources?.total ?? 0} icon={Server} accentColor="#3b82f6" sub="log sources" />
          <MetricCard label="Active Sources" value={s?.sources?.active ?? 0} icon={Activity} accentColor="#22c55e" sub="connected" />
          <MetricCard label="Down / Error" value={s?.sources?.down ?? 0} icon={AlertTriangle} accentColor="#ef4444" sub="unhealthy" />
          <MetricCard label="Logs Ingested" value={(s?.logs?.total ?? 0).toLocaleString()} icon={Database} accentColor="#8b5cf6" sub={`${s?.logs?.logsPerSecond ?? 0} /sec`} isDemo />
          <MetricCard label="Total Anomalies" value={s?.anomalies?.total ?? 0} icon={Zap} accentColor="#f97316" sub="in period" isDemo />
          <MetricCard label="Critical Anomalies" value={s?.anomalies?.critical ?? 0} icon={AlertTriangle} accentColor="#ef4444" sub="requires action" isDemo />
          <MetricCard label="Open Anomalies" value={s?.anomalies?.open ?? 0} icon={Clock} accentColor="#f59e0b" sub="awaiting review" isDemo />
          <MetricCard
            label="Model Version"
            value={s?.model?.version ? <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}>{s.model.version}</span> : 'None'}
            icon={Brain}
            accentColor="#14b8a6"
            sub={s?.model?.architecture || 'No model deployed'}
            isDemo={s?.model?.isDemo}
            tooltip="Production model version from Model Registry"
          />
          {s?.model?.f1Score !== null && s?.model?.f1Score !== undefined ? (
            <MetricCard label="Model F1 Score" value={(s.model.f1Score * 100).toFixed(1) + '%'} icon={TrendingUp} accentColor="#14b8a6" isDemo={s?.model?.isDemo} />
          ) : (
            <MetricCard label="Model F1 Score" value={null} icon={TrendingUp} accentColor="#14b8a6" sub="Run evaluation first" />
          )}
          <MetricCard
            label="Server Health"
            value={`${s?.serverHealth?.healthy ?? 0}/${(s?.sources?.total ?? 0)}`}
            icon={Server}
            accentColor={s?.serverHealth?.unhealthy > 0 ? '#ef4444' : '#22c55e'}
            sub={`${s?.serverHealth?.degraded ?? 0} degraded, ${s?.serverHealth?.unhealthy ?? 0} down`}
            isDemo
          />
          <MetricCard label="Healthy" value={s?.serverHealth?.healthy ?? 0} icon={CheckCircle} accentColor="#22c55e" isDemo />
          <MetricCard label="Degraded" value={s?.serverHealth?.degraded ?? 0} icon={AlertTriangle} accentColor="#f59e0b" isDemo />
        </div>
      )}

      {/* ── CHARTS ROW 1 ─────────────── */}
      <div className="grid-2 mb-4">
        {/* Log Volume Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Log Volume Over Time</span>
            <span className="badge badge-demo">DEMO DATA</span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: 240 }}>
              {logVolumeFormatted.length === 0 ? (
                <div className="empty-state" style={{ height: '100%' }}>
                  <Activity size={32} className="empty-state-icon" />
                  <p>No log data in selected period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={logVolumeFormatted} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="anomGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="timeLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="normal" name="Normal" stroke="#3b82f6" fill="url(#normalGrad)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="anomalous" name="Anomalous" stroke="#ef4444" fill="url(#anomGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Anomaly Types Donut */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Anomaly Types</span>
            <span className="badge badge-demo">DEMO DATA</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: 240 }}>
              {anomalyTypes.length === 0 ? (
                <div className="empty-state" style={{ flex: 1 }}>
                  <CheckCircle size={32} className="empty-state-icon" />
                  <p>No anomaly types detected</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie data={anomalyTypes} dataKey="count" nameKey="_id" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {anomalyTypes.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {anomalyTypes.slice(0, 7).map((t, i) => (
                      <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[i % CATEGORY_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t._id?.replace(/-/g, ' ') || 'Unknown'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 2 ─────────────── */}
      <div className="grid-3 mb-4">
        {/* Severity Distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Anomaly Severity</span>
            <span className="badge badge-demo">DEMO</span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: 200 }}>
              {anomalyDist.length === 0 ? (
                <div className="empty-state" style={{ height: '100%' }}><p>No data</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={anomalyDist} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" name="Anomalies" radius={[4, 4, 0, 0]}>
                      {anomalyDist.map((d, i) => <Cell key={i} fill={SEVERITY_COLORS[d._id] || '#64748b'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Server Health distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Server Health</span>
            <span className="badge badge-demo">SIMULATED</span>
          </div>
          <div className="card-body">
            {s && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                {[
                  { label: 'Healthy', count: s.serverHealth?.healthy ?? 0, color: '#22c55e' },
                  { label: 'Degraded', count: s.serverHealth?.degraded ?? 0, color: '#f59e0b' },
                  { label: 'Unhealthy', count: s.serverHealth?.unhealthy ?? 0, color: '#ef4444' },
                  { label: 'Unknown', count: s.serverHealth?.unknown ?? 0, color: '#94a3b8' },
                ].map(({ label, count, color }) => {
                  const total = (s.sources?.total || 1);
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                        <span style={{ fontWeight: 600 }}>{count}</span>
                      </div>
                      <div className="score-bar">
                        <div className="score-bar-fill" style={{ width: `${(count / total * 100).toFixed(0)}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Pipeline Status</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Ingestion Pipeline', value: 'Operational', color: '#22c55e' },
              { label: 'Preprocessing Mode', value: 'Parser-free Semantic', color: '#3b82f6' },
              { label: 'Active Model', value: s?.model?.version || 'baseline-v1', color: '#8b5cf6' },
              { label: 'AI Service', value: 'Demo Mode (no LLM key)', color: '#f59e0b' },
              { label: 'Real-time Events', value: 'Socket.IO Active', color: '#14b8a6' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 600, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RECENT ANOMALIES TABLE ─────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Anomalies</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-demo">DEMO DATA</span>
            <a href="/anomalies" className="btn btn-ghost btn-sm">
              View All <ChevronRight size={13} />
            </a>
          </div>
        </div>
        <AnomalyTable anomalies={recentAnomalies} loading={loading} />
      </div>
    </div>
  );
}
