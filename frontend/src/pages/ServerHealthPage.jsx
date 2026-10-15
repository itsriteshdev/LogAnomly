import { useState, useEffect } from 'react';
import { getServers, getServerMetrics } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Server, Activity, Cpu, HardDrive, Wifi, X, RefreshCw, Database } from 'lucide-react';
import { format } from 'date-fns';

function ServerDetailModal({ server, onClose }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const { data } = await getServerMetrics(server._id, { limit: 24 });
        setMetrics((data.data || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      } catch {} finally { setLoading(false); }
    }
    fetch();
  }, [server._id]);

  const chartData = metrics.map(m => ({
    time: format(new Date(m.timestamp), 'HH:mm'),
    cpu: m.cpu?.utilization ?? 0,
    memory: m.memory?.usedPercent ?? 0,
    disk: m.disk?.usedPercent ?? 0,
    errorRate: m.errorRate ?? 0,
    logRate: m.logIngestionRate ?? 0,
  }));

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{server.name || server.hostname}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{server.sourceId}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Key info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              ['Type', server.sourceType], ['Environment', server.environment],
              ['IP', server.ipAddress || '—'], ['Team', server.teamOwner || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : chartData.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}><p>No metrics data available</p></div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>CPU & Memory Utilization</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" fill="url(#cpuGrad)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="memory" name="Memory %" stroke="#8b5cf6" fill="url(#memGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Error Rate & Log Ingestion</div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line yAxisId="left" type="monotone" dataKey="errorRate" name="Error Rate %" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="logRate" name="Log/min" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
          <div className="alert-box demo" style={{ fontSize: 11 }}>
            <Database size={12} style={{ flexShrink: 0 }} />
            <span>Metrics shown are <strong>DEMO/simulated</strong> data from the seed script.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServerHealthPage() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function fetchServers() {
    setLoading(true);
    try {
      const { data } = await getServers({ limit: 50 });
      setServers(data.data || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchServers(); }, []);

  const healthGroups = {
    healthy: servers.filter(s => s.health === 'healthy' || s.status === 'active'),
    degraded: servers.filter(s => s.health === 'degraded' || s.status === 'inactive'),
    unhealthy: servers.filter(s => s.health === 'unhealthy' || s.status === 'error'),
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Server Health</h1>
          <p className="page-subtitle">{servers.length} log sources monitored</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchServers}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-3 mb-6">
        {[
          { label: 'Healthy', count: healthGroups.healthy.length, icon: Activity, color: '#22c55e', dot: 'healthy' },
          { label: 'Degraded', count: healthGroups.degraded.length, icon: Server, color: '#f59e0b', dot: 'degraded' },
          { label: 'Unhealthy', count: healthGroups.unhealthy.length, icon: Server, color: '#ef4444', dot: 'unhealthy' },
        ].map(({ label, count, icon: Icon, color, dot }) => (
          <div key={label} className="metric-card" style={{ '--metric-accent': color }}>
            <div className="metric-card-top">
              <span className="metric-card-label">{label} Sources</span>
              <div className="metric-card-icon" style={{ background: `${color}18` }}><Icon size={15} color={color} /></div>
            </div>
            <div className="metric-card-value">{count}</div>
          </div>
        ))}
      </div>

      {/* Server grid */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Sources</span>
        </div>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Source ID</th>
                <th>Type</th>
                <th>Environment</th>
                <th>Hostname</th>
                <th>Team</th>
                <th>Events</th>
                <th>Rate</th>
                <th>Errors</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => <tr key={i}><td colSpan={11}><div className="skeleton skeleton-text" /></td></tr>)
              ) : servers.map(s => (
                <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => setSelected(s)}>
                  <td>
                    <span className={`status-dot ${s.health || (s.status === 'active' ? 'healthy' : s.status === 'error' ? 'unhealthy' : 'degraded')}`} />
                  </td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.sourceId}</td>
                  <td><span className="badge badge-neutral">{s.sourceType}</span></td>
                  <td style={{ fontSize: 12 }}>{s.environment}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.hostname}</td>
                  <td style={{ fontSize: 12 }}>{s.teamOwner || '—'}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{(s.totalEventsReceived || 0).toLocaleString()}</td>
                  <td style={{ fontSize: 12 }}>{s.ingestionRatePerMinute || 0}/min</td>
                  <td style={{ fontSize: 12, color: (s.errorCount || 0) > 0 ? '#ef4444' : 'var(--text-tertiary)' }}>{s.errorCount || 0}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {s.lastSeenAt ? format(new Date(s.lastSeenAt), 'MM-dd HH:mm') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <ServerDetailModal server={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
