import { useEffect, useMemo, useState } from 'react';
import './App.css';
import Header from './components/Header';
import NavBar from './components/NavBar';
import Button from './components/Button';
import Spinner from './components/Spinner';
import ConfigPage from './ui/ConfigPage';
import ProfessoresPage from './ui/ProfessoresPage';
import ProfessorFormPage from './ui/ProfessorFormPage';
import GradePage from './ui/GradePage';
import LoginPage from './ui/LoginPage';
import UsersPage from './ui/UsersPage';
import ScheduleViewerPage from './ui/ScheduleViewerPage';
import { apiFetch, apiJson } from './api';

const ADMIN_NAV_ITEMS = [
  { key: 'config', label: 'Configurações' },
  { key: 'professores', label: 'Disponibilidade' },
  { key: 'grade', label: 'Grade Horária' },
  { key: 'usuarios', label: 'Perfis' },
];

const USER_NAV_ITEMS = [
  { key: 'grades', label: 'Horários' },
];

function parseHash() {
  const raw = window.location.hash.slice(1);
  if (raw.startsWith('form/')) {
    return { kind: 'form', token: raw.replace('form/', '') };
  }
  if (raw === 'login') {
    return { kind: 'login' };
  }
  if (raw.startsWith('admin/')) {
    return { kind: 'app', scope: 'admin', page: raw.split('/')[1] || 'config' };
  }
  if (raw.startsWith('viewer/')) {
    return { kind: 'app', scope: 'viewer', page: raw.split('/')[1] || 'grades' };
  }
  if (raw === 'professores' || raw === 'grade' || raw === 'usuarios' || raw === 'config') {
    return { kind: 'app', scope: 'admin', page: raw };
  }
  if (raw === 'grades') {
    return { kind: 'app', scope: 'viewer', page: 'grades' };
  }
  return { kind: 'default' };
}

function defaultRouteForRole(role) {
  return role === 'admin' ? 'admin/config' : 'viewer/grades';
}

const ROLE_LABELS = {
  admin: 'Administrador',
  aluno: 'Aluno',
  professor: 'Professor',
};

function App() {
  const [route, setRoute] = useState(parseHash());
  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [formToken, setFormToken] = useState(null);

  useEffect(() => {
    const handleHash = () => {
      setRoute(parseHash());
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const data = await apiJson('/api/auth/me');
        setAuth(data.user);
      } catch {
        setAuth(null);
      } finally {
        setAuthLoading(false);
      }
    };

    loadAuth();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (route.kind === 'form') return;

    if (!auth && route.kind !== 'login') {
      window.location.hash = 'login';
      return;
    }

    if (auth && route.kind === 'login') {
      window.location.hash = defaultRouteForRole(auth.role);
      return;
    }

    if (auth && route.kind === 'app') {
      const expectedScope = auth.role === 'admin' ? 'admin' : 'viewer';
      if (route.scope !== expectedScope) {
        window.location.hash = defaultRouteForRole(auth.role);
      }
    }

  }, [auth, authLoading, route]);

  useEffect(() => {
    if (route.kind === 'form') {
      setFormToken(route.token);
    }
  }, [route]);

  const handleNavChange = (key) => {
    const nextHash = auth?.role === 'admin' ? `admin/${key}` : `viewer/${key}`;
    window.location.hash = nextHash;
  };

  const handleLoginSuccess = (user) => {
    setAuth(user);
    window.location.hash = defaultRouteForRole(user.role);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuth(null);
      window.location.hash = 'login';
    }
  };

  const activePage = useMemo(() => {
    if (route.kind === 'app') return route.page;
    return auth?.role === 'admin' ? 'config' : 'grades';
  }, [auth?.role, route]);

  if (route.kind === 'form' && formToken) {
    return <ProfessorFormPage token={formToken} />;
  }

  if (authLoading) {
    return (
      <div className="app-loading">
        <Spinner />
      </div>
    );
  }

  if (!auth) {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  const navItems = auth.role === 'admin' ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;

  return (
    <div className="auth-shell">
      <Header
        title="Grade Horária Escolar"
        subtitle={auth.role === 'admin' ? 'Painel do administrador' : 'Painel de consulta'}
        rightContent={(
          <div className="auth-session">
            <div className="auth-session-text">
              <span className="auth-session-name">{auth.nome}</span>
              <span className="auth-session-role">{ROLE_LABELS[auth.role] || auth.role}</span>
            </div>
            <button className="auth-logout-btn" onClick={handleLogout}>Sair</button>
          </div>
        )}
      />
      <NavBar items={navItems} active={activePage} onChange={handleNavChange} />
      <main className="app-main-content">
        {auth.role === 'admin' && activePage === 'config' && <ConfigPage />}
        {auth.role === 'admin' && activePage === 'professores' && <ProfessoresPage />}
        {auth.role === 'admin' && activePage === 'grade' && <GradePage />}
        {auth.role === 'admin' && activePage === 'usuarios' && <UsersPage />}
        {(auth.role === 'aluno' || auth.role === 'professor') && activePage === 'grades' && <ScheduleViewerPage />}
      </main>
    </div>
  );
}

export default App;
