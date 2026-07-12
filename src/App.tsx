import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ActiveDashboardsProvider } from './contexts/ActiveDashboardsContext';
import { ProjectsProvider } from './contexts/ProjectsContext';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ActivityLogsLayout from './pages/ActivityLogs/ActivityLogsLayout';
import DashboardLogs from './pages/ActivityLogs/DashboardLogs';
import PulseLogs from './pages/ActivityLogs/PulseLogs';
import QueryManager from './pages/QueryManager';
import SettingsLayout from './pages/Settings/SettingsLayout';
import CompanySettings from './pages/Settings/CompanySettings';
import TeamMembers from './pages/Settings/TeamMembers';
import ApiSettings from './pages/Settings/ApiSettings';
import EmailSettings from './pages/Settings/EmailSettings';
import ScheduleManager from './pages/Settings/ScheduleManager';
import Branding from './pages/Settings/Branding';
import Applications from './pages/Settings/Applications';
import Functions from './pages/Settings/Functions';
import InviteCallback from './pages/InviteCallback';
import SsoCallback from './pages/SsoCallback';

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invite-callback" element={<InviteCallback />} />
      <Route path="/auth/sso" element={<SsoCallback />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard/:dashboardId" element={<Dashboard />} />
        <Route path="/queries" element={<QueryManager />} />
        <Route path="/logs" element={<ActivityLogsLayout />}>
          <Route index element={<DashboardLogs />} />
          <Route path="pulse" element={<PulseLogs />} />
        </Route>
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<CompanySettings />} />
          <Route path="members" element={<TeamMembers />} />
          <Route path="api" element={<ApiSettings />} />
          <Route path="functions" element={<Functions />} />
          <Route path="email" element={<EmailSettings />} />
          <Route path="schedule" element={<ScheduleManager />} />
          <Route path="branding" element={<Branding />} />
          <Route path="applications" element={<Applications />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <ProjectsProvider>
              <SidebarProvider>
                <ActiveDashboardsProvider>
                  <AppRoutes />
                </ActiveDashboardsProvider>
              </SidebarProvider>
            </ProjectsProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
