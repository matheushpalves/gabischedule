import { useState } from 'react';
import { Link } from 'react-router-dom';
import { THEMES, THEME_IDS, type ThemeId } from '@gabi/shared';
import { errorMessage } from '../lib/api';
import { isIOS, isStandalone, useInstallPrompt } from '../lib/pwa';
import { useTheme } from '../lib/theme';
import { Icon } from '../components/Icon';
import { toast } from '../components/ui';

/** Explica o que acontece com o ícone do app instalado depois de trocar o tema. */
function iconNote(): string {
  if (isIOS() && isStandalone())
    return 'No iPhone o ícone da Tela de Início não muda sozinho: apague o Gabi da tela e adicione de novo pelo Safari (Compartilhar → Adicionar à Tela de Início). Seus dados continuam salvos; só vai pedir o código e reativar as notificações.';
  if (isIOS()) return 'Ao adicionar o Gabi à Tela de Início, o ícone já vem com a cor nova.';
  if (isStandalone()) return 'O ícone do app instalado se atualiza sozinho em até 1 dia (o sistema pode pedir para confirmar).';
  return 'O ícone da aba já mudou; se instalar o app, ele vem com a cor nova.';
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const [changed, setChanged] = useState(false);

  const choose = async (id: ThemeId) => {
    if (id === theme.id) return;
    try {
      await setTheme(id);
      setChanged(true);
      toast(`Tema ${THEMES[id].name} aplicado`);
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  return (
    <section className="card stack-12">
      <h2 className="h2">Aparência</h2>
      <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
        Escolha as cores do app. Vale para todos os aparelhos.
      </p>
      <div className="theme-grid" role="radiogroup" aria-label="Tema de cores">
        {THEME_IDS.map((id) => {
          const t = THEMES[id];
          const c = t.colors;
          const on = id === theme.id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} className="theme-option" onClick={() => void choose(id)}>
              <span className="theme-preview" style={{ background: c.bg, borderColor: c.line }} aria-hidden="true">
                <span className="theme-icon" style={{ background: c.accent }}>
                  G
                </span>
                <span className="theme-bars">
                  <span style={{ background: c.accent, width: '80%' }} />
                  <span style={{ background: c.heroDark, width: '60%' }} />
                  <span className="row" style={{ gap: 3 }}>
                    {[c.tagRosaBg, c.tagVerdeBg, c.tagPessegoBg, c.tagLilasBg].map((x, i) => (
                      <i key={i} style={{ background: x }} />
                    ))}
                  </span>
                </span>
              </span>
              <span className="theme-text">
                <strong>{t.name}</strong>
                <span className="muted">{t.description}</span>
              </span>
              <span className={`theme-check${on ? ' on' : ''}`} aria-hidden="true">
                {on && <Icon name="check" size={14} strokeWidth={3.5} />}
              </span>
            </button>
          );
        })}
      </div>
      {changed && (
        <p className="install" role="status" style={{ fontSize: 14 }}>
          <Icon name="share" size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>{iconNote()}</span>
        </p>
      )}
    </section>
  );
}

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

      <Appearance />

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
