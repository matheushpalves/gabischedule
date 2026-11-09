import { useLocalState } from '../lib/hooks';
import { isIOS, isStandalone, useInstallPrompt } from '../lib/pwa';
import { Icon } from './Icon';

/** Aviso discreto: passo a passo no iPhone/iPad; botão nativo nos demais. */
export function InstallBanner() {
  const [dismissed, setDismissed] = useLocalState('gabi:install-dismissed', false);
  const { canInstall, install } = useInstallPrompt();
  if (dismissed || isStandalone()) return null;

  if (isIOS()) {
    return (
      <aside className="install" aria-label="Instalar o app">
        <Icon name="share" size={22} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 15 }}>Instale o Gabi no seu iPhone</p>
          <ol>
            <li>
              Toque em <strong>Compartilhar</strong> na barra do Safari
            </li>
            <li>
              Escolha <strong>“Adicionar à Tela de Início”</strong>
            </li>
            <li>Abra o Gabi pelo ícone para receber notificações</li>
          </ol>
        </div>
        <button type="button" className="icon-btn ghost" aria-label="Dispensar aviso" onClick={() => setDismissed(true)}>
          <Icon name="x" size={20} />
        </button>
      </aside>
    );
  }

  if (!canInstall) return null;
  return (
    <aside className="install" aria-label="Instalar o app" style={{ alignItems: 'center' }}>
      <Icon name="download" size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <p style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Instale o Gabi para abrir mais rápido</p>
      <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => void install()}>
        Instalar
      </button>
      <button type="button" className="icon-btn ghost" aria-label="Dispensar aviso" onClick={() => setDismissed(true)}>
        <Icon name="x" size={20} />
      </button>
    </aside>
  );
}
