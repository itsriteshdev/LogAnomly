import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser } from '../services/api';
import { Users, Plus, X, Edit2, Loader2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ROLE_BADGE = { admin: 'badge-critical', analyst: 'badge-low', viewer: 'badge-info' };

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try { const { data } = await getUsers(); setUsers(data.data || []); } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchUsers(); }, []);

  function CreateUserModal() {
    const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'viewer' });
    const [saving, setSaving] = useState(false);

    async function handleCreate(e) {
      e.preventDefault();
      setSaving(true);
      try {
        await createUser(form);
        toast.success('User created');
        setShowCreate(false);
        fetchUsers();
      } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setSaving(false); }
    }

    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Create User</span>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowCreate(false)}><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="input" required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="input" required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="input" type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {['viewer', 'analyst', 'admin'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <Loader2 size={13} /> : <Plus size={13} />} Create
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
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} registered users</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> Add User
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last Login</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i}><td colSpan={6}><div className="skeleton skeleton-text" /></td></tr>)
              ) : users.map(u => (
                <tr key={u._id}>
                  <td><span className={`status-dot ${u.isActive ? 'active' : 'offline'}`} /></td>
                  <td style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</td>
                  <td style={{ fontSize: 12 }}>{u.email}</td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-neutral'}`}>{u.role}</span></td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MM-dd HH:mm') : 'Never'}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{format(new Date(u.createdAt), 'yyyy-MM-dd')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateUserModal />}
    </div>
  );
}
