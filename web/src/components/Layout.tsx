import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { ToastHost } from './ui';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Tarefas', icon: 'tasks' },
  { to: '/agenda', label: 'Agenda', icon: 'calendar' },
  { to: '/lembretes', label: 'Lembretes', icon: 'bell' },
  { to: '/kanban', label: 'Kanban', icon: 'kanban' },
  { to: '/financas', label: 'Finanças', icon: 'wallet' },
];

const cls = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

export function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <div className="avatar" aria-hidden="true">
            G
          </div>
          <div>
            <p className="h2">Gabi</p>
            <p className="muted" style={{ fontSize: 13 }}>
              Oi, Gabriela
            </p>
          </div>
        </div>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={cls}>
            <Icon name={t.icon} />
            {t.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <NavLink to="/ajustes" className={cls}>
          <Icon name="settings" />
          Ajustes
        </NavLink>
        <button type="button" className="nav-link" style={{ border: 'none', background: 'none' }} onClick={onLogout}>
          <Icon name="logout" />
          Sair
        </button>
      </nav>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={cls}>
            <Icon name={t.icon} />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <ToastHost />
    </div>
  );
}
