import { useState, useEffect } from 'react';
import { getSettings, updateSettings, updateProfile } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { Settings as SettingsIcon, Save, Loader2, User, Shield, Database } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '' });
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setProfile({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '' });
    fetchSettings();
  }, [user]);

  async function fetchSettings() {
    setLoading(true);
    try { const { data } = await getSettings(); setSettings(data.data || []); } catch {} finally { setLoading(false); }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        ...(password.new && { currentPassword: password.current, newPassword: password.new }),
      });
      setUser(prev => ({ ...prev, firstName: profile.firstName, lastName: profile.lastName }));
      setPassword({ current: '', new: '', confirm: '' });
      toast.success('Profile updated');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setSaving(false); }
  }

  async function handleSaveSettings(key, value) {
    try {
      await updateSettings([{ key, value }]);
      toast.success('Setting updated');
      fetchSettings();
    } catch { toast.error('Failed'); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Profile, system configuration, and preferences</p>
        </div>
      </div>

      <div className="tabs mb-4">
        <button className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}><User size={14} /> Profile</button>
        <button className={`tab-btn ${tab === 'system' ? 'active' : ''}`} onClick={() => setTab('system')}><SettingsIcon size={14} /> System</button>
      </div>

      {tab === 'profile' ? (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header"><span className="card-title">Profile Settings</span></div>
          <div className="card-body">
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="input" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="input" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" value={profile.email} disabled style={{ opacity: 0.6 }} />
                <span className="form-hint">Email cannot be changed</span>
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <input className="input" value={user?.role || ''} disabled style={{ opacity: 0.6 }} />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Change Password</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input className="input" type="password" value={password.current} onChange={e => setPassword(p => ({ ...p, current: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input className="input" type="password" value={password.new} onChange={e => setPassword(p => ({ ...p, new: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? <Loader2 size={13} /> : <Save size={13} />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">System Settings</span>
            <span className="badge badge-demo">DEMO DEFAULTS</span>
          </div>
          <div className="card-body">
            {loading ? (
              [...Array(5)].map((_, i) => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 12 }} />)
            ) : settings.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <SettingsIcon size={32} className="empty-state-icon" />
                <p>No settings found. Run seed to create defaults.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {settings.map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.key}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.description}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{String(s.value)}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
