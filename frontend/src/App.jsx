import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { SocketProvider, useSocket } from './store/SocketContext';
import { useEffect } from 'react';

import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LiveLogsPage from './pages/LiveLogsPage';
import AnomaliesPage from './pages/AnomaliesPage';
import ServerHealthPage from './pages/ServerHealthPage';
import InvestigationsPage from './pages/InvestigationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ReportsPage from './pages/ReportsPage';
import ModelPerformancePage from './pages/ModelPerformancePage';
import ModelRegistryPage from './pages/ModelRegistryPage';
import LogSourcesPage from './pages/LogSourcesPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogsPage from './pages/AuditLogsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-app)',
        fontSize: 14, color: 'var(--text-secondary)',
      }}>
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function SocketConnector({ children }) {
  const { user } = useAuth();
  const { connect, disconnect } = useSocket();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('accessToken');
      if (token) connect(token);
    }
    return () => disconnect();
  }, [user, connect, disconnect]);

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <SocketConnector>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/live-logs" element={<LiveLogsPage />} />
                <Route path="/anomalies" element={<AnomaliesPage />} />
                <Route path="/server-health" element={<ServerHealthPage />} />
                <Route path="/investigations" element={<InvestigationsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/model-performance" element={<ModelPerformancePage />} />
                <Route path="/model-registry" element={<ModelRegistryPage />} />
                <Route path="/log-sources" element={<LogSourcesPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
                <Route path="/audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </SocketConnector>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  );
}
