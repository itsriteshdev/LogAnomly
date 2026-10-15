import { useState } from 'react';
import { generateReport } from '../services/api';
import { FileText, Download, Loader2, Database } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('7d');

  async function handleGenerate() {
    setLoading(true);
    const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[range] || 604800000;
    const to = new Date();
    const from = new Date(to - ms);
    try {
      const { data } = await generateReport({ type: 'anomaly-summary', from: from.toISOString(), to: to.toISOString() });
      setReport(data.data);
      toast.success('Report generated');
    } catch (e) { toast.error('Failed to generate report'); } finally { setLoading(false); }
  }

  function downloadJSON() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report_${report.reportId}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const s = report?.summary;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate anomaly summary reports from database data</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-demo">DEMO DATA</span>
          {['24h', '7d', '30d'].map(r => (
            <button key={r} className={`btn ${range === r ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setRange(r)}>{r}</button>
          ))}
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 size={13} /> : <FileText size={13} />} Generate Report
          </button>
        </div>
      </div>

      {!report ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 80 }}>
            <FileText size={48} className="empty-state-icon" />
            <h3>No Report Generated</h3>
            <p>Select a time range and click "Generate Report" to create an anomaly summary computed from actual database data.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Report: {report.reportId}</span>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {format(new Date(report.period.from), 'yyyy-MM-dd')} — {format(new Date(report.period.to), 'yyyy-MM-dd')}
                  {' · '}Generated {format(new Date(report.generatedAt), 'yyyy-MM-dd HH:mm:ss')}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={downloadJSON}><Download size={13} /> Export JSON</button>
            </div>
            <div className="card-body">
              <div className="grid-4" style={{ marginBottom: 20 }}>
                {[
                  ['Total Logs', s?.totalLogs?.toLocaleString() || '0', '#3b82f6'],
                  ['Total Anomalies', s?.totalAnomalies || 0, '#f97316'],
                  ['Critical', s?.severityBreakdown?.critical || 0, '#ef4444'],
                  ['Resolved', s?.statusBreakdown?.resolved || 0, '#22c55e'],
                ].map(([label, val, color]) => (
                  <div key={label} className="metric-card" style={{ '--metric-accent': color }}>
                    <span className="metric-card-label">{label}</span>
                    <div className="metric-card-value">{val}</div>
                  </div>
                ))}
              </div>

              {/* Severity breakdown */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Severity Breakdown</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  {Object.entries(s?.severityBreakdown || {}).map(([sev, count]) => (
                    <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`badge badge-${sev}`}>{sev}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status breakdown */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Status Breakdown</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  {Object.entries(s?.statusBreakdown || {}).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="badge badge-neutral">{status}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="alert-box demo">
            <Database size={13} style={{ flexShrink: 0 }} />
            <span>This report is computed from actual database records. Records marked [DEMO] are from the seed script.</span>
          </div>
        </div>
      )}
    </div>
  );
}
