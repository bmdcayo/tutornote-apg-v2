import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { EvaluationsPage } from './pages/EvaluationsPage';
import { IndividualEvaluationPage } from './pages/IndividualEvaluationPage';
import { StudentsPage } from './pages/StudentsPage';
import { ClassesGroupsPage } from './pages/ClassesGroupsPage';
import { TableCompositionPage } from './pages/TableCompositionPage';
import { CasesPage } from './pages/CasesPage';
import { ReportsPage } from './pages/ReportsPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SystemUnavailableScreen } from './components/common/SystemUnavailableScreen';
import { ProfileNotFoundScreen } from './components/common/ProfileNotFoundScreen';
import { UserInactiveScreen } from './components/common/UserInactiveScreen';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    isAuthenticated,
    profile,
    loading,
    error,
    isSystemUnavailable,
    isCheckingConnection,
    checkSystemHealth,
    refreshProfile,
    signOut,
  } = useAuth();
  const location = useLocation();

  // 1. Initial health/auth check spinner
  if (isCheckingConnection || loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-slate-300 font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-semibold tracking-wide">
          Verificando integridade da conexão e perfil...
        </p>
      </div>
    );
  }

  // 2. Production unavailable screen when database is missing or fails to respond
  if (isSystemUnavailable) {
    return <SystemUnavailableScreen onRetry={checkSystemHealth} />;
  }

  // 3. Password recovery is a public route because the Supabase e-mail link
  // establishes a short-lived recovery session only after opening this URL.
  if (location.pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }

  // 4. Unauthenticated users MUST strictly see ONLY the login page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // 5. Authenticated, but Profile NOT FOUND in public.profiles
  if (!profile) {
    return (
      <ProfileNotFoundScreen
        onRetry={refreshProfile}
        onSignOut={signOut}
        errorMsg={error || 'Perfil não encontrado no banco de dados.'}
      />
    );
  }

  // 6. Authenticated, but Profile is INACTIVE
  if (profile.ativo === false) {
    return <UserInactiveScreen onSignOut={signOut} />;
  }

  // 7. Authenticated & Active Profile -> Application Routes
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/avaliacoes" element={<EvaluationsPage />} />
        <Route path="/avaliar/:studentId/:weekStr" element={<IndividualEvaluationPage />} />
        <Route path="/alunos" element={<StudentsPage />} />
        <Route path="/turmas-grupos" element={<ClassesGroupsPage />} />
        <Route path="/composicao-mesas" element={<TableCompositionPage />} />
        <Route path="/casos-apg" element={<CasesPage />} />
        <Route path="/relatorios" element={<ReportsPage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
