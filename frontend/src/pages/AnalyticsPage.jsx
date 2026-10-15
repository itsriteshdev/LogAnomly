import { useState, useEffect } from 'react';
import { getAnalyticsOverview, getAnalyticsTrends } from '../services/api';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, TrendingUp, Database, RefreshCw } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444'];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');

  async function fetchData() {
    setLoading(true);
    const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[range] || 604800000;
    const to = new Date();
    const from = new Date(to - ms);
    try {
      const [ovRes, trRes] = await Promise.allSettled([
        getAnalyticsOverview({ from: from.toISOString(), to: to.toISOString() }),
        getAnalyticsTrends({ from: from.toISOString(), to: to.toISOString() }),
      ]);
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data.data);
      if (trRes.status === 'fulfilled') setTrends(trRes.value.data.data || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [range]);

  const trendData = trends.map(t => ({
    date: t._id?.date || t._id,
    anomalies: t.count || 0,
    avgScore: parseFloat(((t.avgScore || 0) * 100).toFixed(1)),
  }));

  const sevData = overview?.severityBreakdown ? Object.entries(overview.severityBreakdown).map(([k, v]) => ({ severity: k, count: v })) : [];
  const catData = overview?.categoryBreakdown ? Object.entries(overview.categoryBreakdown).map(([k, v]) => ({ category: k.replace(/-/g, ' '), count: v })) : [];
  const svcData = overview?.serviceBreakdown ? Object.entries(overview.serviceBreakdown).map(([k, v]) => ({ service: k, count: v })).sort((a, b) => b.count - a.count).slice(0, 10) : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Anomaly trends, breakdowns, and system insights</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
          {['24h', '7d', '30d'].map(r => (
            <button key={r} className={`btn ${range === r ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setRange(r)}>{r}</button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={fetchData}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Summary row */}
      {overview && (
        <div className="grid-4 mb-6">
          <div className="metric-card" style={{ '--metric-accent': '#3b82f6' }}>
            <span className="metric-card-label">Total Anomalies</span>
            <div className="metric-card-value">{overview.totalAnomalies || 0}</div>
          </div>
          <div className="metric-card" style={{ '--metric-accent': '#f59e0b' }}>
            <span className="metric-card-label">Avg Score</span>
            <div className="metric-card-value">{overview.avgScore ? (overview.avgScore * 100).toFixed(1) + '%' : 'N/A'}</div>
          </div>
          <div className="metric-card" style={{ '--metric-accent': '#ef4444' }}>
            <span className="metric-card-label">Critical</span>
            <div className="metric-card-value">{overview.severityBreakdown?.critical || 0}</div>
          </div>
          <div className="metric-card" style={{ '--metric-accent': '#22c55e' }}>
            <span className="metric-card-label">Resolved</span>
            <div className="metric-card-value">{overview.statusBreakdown?.resolved || 0}</div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-header"><span className="card-title">Anomaly Trend</span></div>
          <div className="card-body">
            <div style={{ height: 260 }}>
              {trendData.length === 0 ? (
                <div className="empty-state" style={{ height: '100%' }}><p>No trend data</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="anomalies" name="Anomalies" stroke="#3b82f6" fill="url(#trendGrad)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="avgScore" name="Avg Score %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">By Severity</span></div>
          <div className="card-body">
            <div style={{ height: 260 }}>
              {sevData.length === 0 ? (
                <div className="empty-state" style={{ height: '100%' }}><p>No data</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sevData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="severity" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {sevData.map((d, i) => (
                        <Cell key={i} fill={{ critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#8b5cf6' }[d.severity] || '#64748b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-header"><span className="card-title">By Category</span></div>
          <div className="card-body">
            <div style={{ height: 260 }}>
              {catData.length === 0 ? (
                <div className="empty-state" style={{ height: '100%' }}><p>No data</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Top Affected Services</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
              {svcData.length === 0 ? (
                <div className="empty-state"><p>No service data</p></div>
              ) : svcData.map((s, i) => {
                const max = svcData[0].count || 1;
                return (
                  <div key={s.service}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ fontWeight: 500 }}>{s.service}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{s.count}</span>
                    </div>
                    <div className="score-bar">
                      <div className="score-bar-fill" style={{ width: `${(s.count / max * 100).toFixed(0)}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
