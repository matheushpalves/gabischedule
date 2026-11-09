import { Link } from 'react-router-dom';
import { isIOS, isStandalone, useInstallPrompt } from '../lib/pwa';
import { Icon } from '../components/Icon';

export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const { canInstall, install } = useInstallPrompt();
  const installed = isStandalone();

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <header className="page-header">
        <div className="stack-4">
          <p className="eyebrow">Gabi</p>
          <h1 className="h1">Ajustes</h1>
        </div>
      </header>

      <Link to="/notificacoes" className="item" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Icon name="bell" style={{ color: 'var(--accent)' }} />
        <span className="item-main">
          <span className="item-title">Notificações</span>
          <span className="item-sub">Ativar lembretes neste aparelho</span>
        </span>
        <Icon name="chevronRight" size={20} />
      </Link>

      <section className="card stack-12">
        <h2 className="h2">Instalar o app</h2>
        {installed ? (
          <p className="muted">O Gabi já está instalado neste aparelho.</p>
        ) : isIOS() ? (
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>
              No Safari, toque em <strong>Compartilhar</strong> <Icon name="share" size={16} style={{ verticalAlign: '-3px' }} />.
            </li>
            <li>
              Escolha <strong>“Adicionar à Tela de Início”</strong>.
            </li>
          </ol>
        ) : canInstall ? (
          <button type="button" className="btn" onClick={() => void install()}>
            <Icon name="download" size={18} /> Instalar o Gabi
          </button>
        ) : (
          <p className="muted">Use a opção “Instalar app” no menu do navegador (Chrome ou Edge).</p>
        )}
      </section>

      <button type="button" className="btn danger block" onClick={onLogout}>
        <Icon name="logout" size={18} /> Sair
      </button>
    </div>
  );
}
