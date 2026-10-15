import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useSocket } from '../../store/SocketContext';
import {
  Activity, Search, Bell, ChevronDown, ChevronRight, ChevronLeft,
  LayoutDashboard, ScrollText, AlertTriangle, Server, BarChart3,
  FileText, Brain, Plug, Database, Zap, ClipboardList, Settings,
  Users, LogOut, User, Shield, Wifi, WifiOff, Loader2, Menu,
} from 'lucide-react';
import { getNotifications, markAllRead } from '../../services/api';
import { format } from 'date-fns';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', exact: true },
  { label: 'Live Logs', icon: ScrollText, path: '/live-logs' },
  { label: 'Anomalies', icon: AlertTriangle, path: '/anomalies' },
  { label: 'Server Health', icon: Server, path: '/server-health' },
  { label: 'Investigations', icon: ClipboardList, path: '/investigations' },
  { section: 'Analytics' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Reports', icon: FileText, path: '/reports' },
  { section: 'AI & Models' },
  { label: 'Model Performance', icon: Activity, path: '/model-performance' },
  { label: 'Model Registry', icon: Database, path: '/model-registry' },
  { section: 'Configuration' },
  { label: 'Log Sources', icon: Plug, path: '/log-sources' },
  { label: 'Alerts & Rules', icon: Zap, path: '/alerts' },
  { label: 'Settings', icon: Settings, path: '/settings' },
  { section: 'Admin', adminOnly: true },
  { label: 'User Management', icon: Users, path: '/users', adminOnly: true },
  { label: 'Audit Logs', icon: Shield, path: '/audit-logs', adminOnly: true },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { connected, connecting } = useSocket();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifications() {
    try {
      const { data } = await getNotifications({ limit: 10 });
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  }

  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '?';

  return (
    <div className="app-shell">
      {/* ── HEADER ─────────────────────────────── */}
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-icon">
            <Brain size={18} color="white" />
          </div>
          {!collapsed && (
            <div>
              <div className="header-logo-text">Log Anomaly</div>
              <div className="header-logo-sub">Detection Dashboard</div>
            </div>
          )}
        </div>

        <div className="header-search">
          <Search size={14} className="header-search-icon" />
          <input type="text" placeholder="Search logs, anomalies, incidents..." />
        </div>

        <div className="header-spacer" />

        <div className="header-actions">
          {/* Connection indicator */}
          <div className="connection-indicator">
            {connecting ? (
              <><Loader2 size={10} className="connection-dot" style={{ animation: 'spin 1s linear infinite' }} /> Connecting</>
            ) : connected ? (
              <><span className="connection-dot" /> Live</>
            ) : (
              <><span className="connection-dot disconnected" /> Offline</>
            )}
          </div>

          {/* Notifications */}
          <div className="dropdown" ref={notifRef}>
            <button className="header-icon-btn" onClick={() => setNotifOpen(v => !v)}>
              <Bell size={16} />
              {unreadCount > 0 && <span className="badge-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="dropdown-menu" style={{ minWidth: 320, right: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button className="btn btn-ghost btn-xs" onClick={handleMarkAllRead}>Mark all read</button>
                  )}
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No notifications</div>
                  ) : notifications.map(n => (
                    <div key={n._id} className="dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, background: n.isRead ? 'transparent' : 'rgba(59,130,246,0.04)' }}>
                      <span style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 12 }}>{n.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{n.message?.slice(0, 80)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="dropdown" ref={userMenuRef}>
            <button className="user-menu-btn" onClick={() => setUserMenuOpen(v => !v)}>
              <div className="user-avatar">{initials}</div>
              <span className="user-name">{user?.firstName} {user?.lastName}</span>
              <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 2 }} />
            </button>
            {userMenuOpen && (
              <div className="dropdown-menu">
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.firstName} {user?.lastName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{user?.email}</div>
                  <div style={{ marginTop: 4 }}><span className="badge badge-neutral" style={{ fontSize: 10 }}>{user?.role}</span></div>
                </div>
                <button className="dropdown-item" onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}>
                  <User size={14} /> Profile & Settings
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-item danger" onClick={handleLogout}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* ── SIDEBAR ─────────────────────────────── */}
        <nav className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-nav">
            {navItems.map((item, i) => {
              if (item.section) {
                if (item.adminOnly && user?.role !== 'admin') return null;
                return collapsed ? null : (
                  <div key={i} className="sidebar-section-label">{item.section}</div>
                );
              }
              if (item.adminOnly && user?.role !== 'admin') return null;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={16} className="sidebar-nav-icon" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
          <div className="sidebar-collapse-btn">
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setCollapsed(v => !v)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </nav>

        {/* ── MAIN CONTENT ─────────────────────────── */}
        <main className={`app-main ${collapsed ? 'collapsed' : ''}`} style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
