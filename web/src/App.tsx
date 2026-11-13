import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api, post, UNAUTHORIZED_EVENT } from './lib/api';
import { Layout } from './components/Layout';
import { ThemeProvider } from './lib/theme';
import { Loading } from './components/ui';
import { Login } from './pages/Login';
import { TasksPage } from './pages/Tasks';
import { AgendaPage } from './pages/Agenda';
import { RemindersPage } from './pages/Reminders';
import { KanbanPage } from './pages/Kanban';
import { FinancePage } from './pages/Finance';
import { SettingsPage } from './pages/Settings';
import { NotificationsPage } from './pages/Notifications';

type AuthState = 'checking' | 'in' | 'out';

export function App() {
  const [auth, setAuth] = useState<AuthState>('checking');

  useEffect(() => {
    api('/auth/me')
      .then(() => setAuth('in'))
      // Sem conexão: abre o app mesmo assim (as telas mostram o erro e permitem tentar de novo).
      .catch((err: { status?: number }) => setAuth(err.status === 0 ? 'in' : 'out'));
    const onUnauthorized = () => setAuth('out');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      setAuth('out');
    }
  }, []);

  if (auth === 'checking') {
    return (
      <div className="page" style={{ maxWidth: 480 }}>
        <Loading rows={4} />
      </div>
    );
  }
  if (auth === 'out') return <Login onSuccess={() => setAuth('in')} />;

  return (
    <ThemeProvider>
    <Routes>
      <Route element={<Layout onLogout={() => void logout()} />}>
        <Route index element={<TasksPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="lembretes" element={<RemindersPage />} />
        <Route path="kanban" element={<KanbanPage />} />
        <Route path="financas" element={<FinancePage />} />
        <Route path="ajustes" element={<SettingsPage onLogout={() => void logout()} />} />
        <Route path="notificacoes" element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ThemeProvider>
  );
}
