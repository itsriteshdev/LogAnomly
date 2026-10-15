import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Brain, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role) {
    const creds = {
      admin: ['admin@demo.local', 'Admin1234!'],
      analyst: ['analyst@demo.local', 'Analyst1234!'],
      viewer: ['viewer@demo.local', 'Viewer1234!'],
    };
    setEmail(creds[role][0]);
    setPassword(creds[role][1]);
    setError('');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon"><Brain size={22} color="white" /></div>
          <div>
            <div className="login-title">Log Anomaly</div>
            <div className="login-subtitle">Detection Dashboard</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div className="alert-box error" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="input" type="email" placeholder="admin@demo.local" value={email}
              onChange={e => setEmail(e.target.value)} autoFocus autoComplete="email" />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary w-full" type="submit" disabled={loading}
            style={{ height: 42, fontSize: 14, fontWeight: 600, borderRadius: 10 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</> : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials quick-fill */}
        <div style={{ marginTop: 28, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>
            Demo Accounts
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { role: 'admin', label: 'Admin', color: '#ef4444' },
              { role: 'analyst', label: 'Analyst', color: '#3b82f6' },
              { role: 'viewer', label: 'Viewer', color: '#8b5cf6' },
            ].map(({ role, label, color }) => (
              <button key={role} className="btn btn-sm" onClick={() => fillDemo(role)}
                style={{ flex: 1, background: `${color}20`, color, border: `1px solid ${color}40`, fontSize: 12, fontWeight: 600 }}>
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10, lineHeight: 1.5 }}>
            Click a role above to auto-fill credentials. Run <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>npm run seed</code> in the backend first.
          </p>
        </div>
      </div>

      {/* Background animated dots */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
