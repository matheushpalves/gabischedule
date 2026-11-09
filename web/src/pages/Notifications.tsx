import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage, post } from '../lib/api';
import { getPushState, isIOS, subscribePush, unsubscribePush, type PushState } from '../lib/pwa';
import { Icon } from '../components/Icon';
import { Loading } from '../components/ui';

export function NotificationsPage() {
  const [state, setState] = useState<PushState | null>(null);
  const [server, setServer] = useState<{ enabled: boolean; publicKey: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getPushState().then(setState, () => setState('unsupported'));
    api<{ enabled: boolean; publicKey: string | null }>('/push/config').then(setServer, () => setServer({ enabled: false, publicKey: null }));
  }, []);

  const enable = async () => {
    if (!server?.publicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const sub = await subscribePush(server.publicKey);
      await post('/push/subscribe', sub);
      setState('on');
      await post('/push/test');
      setMsg({ ok: true, text: 'Pronto! Enviamos uma notificação de teste.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) await post('/push/unsubscribe', { endpoint });
      setState('off');
      setMsg({ ok: true, text: 'Notificações desativadas neste aparelho.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await post<{ sent: number }>('/push/test');
      setMsg({ ok: r.sent > 0, text: r.sent > 0 ? 'Notificação de teste enviada.' : 'Nenhum aparelho inscrito.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <header className="page-header">
        <div className="stack-4">
          <Link to="/lembretes" className="eyebrow" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
            <Icon name="chevronLeft" size={16} strokeWidth={2.5} /> Lembretes
          </Link>
          <h1 className="h1">Notificações</h1>
        </div>
      </header>

      <div className="hero plum" style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="bell" />
        </div>
        <p style={{ fontSize: 15 }}>Receba seus lembretes na hora certa, mesmo com o app fechado.</p>
      </div>

      {state === null || server === null ? (
        <Loading rows={2} />
      ) : (
        <>
          {isIOS() && (
            <section className="card stack-12">
              <h2 className="h2">No iPhone e no iPad</h2>
              <p className="muted" style={{ fontSize: 15 }}>
                A Apple só permite notificações para apps <strong>instalados na Tela de Início</strong> (iOS 16.4 ou mais recente). No Safari comum elas não funcionam.
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>
                <li>
                  Abra este site no <strong>Safari</strong>.
                </li>
                <li>
                  Toque em <strong>Compartilhar</strong> <Icon name="share" size={16} style={{ verticalAlign: '-3px' }} />.
                </li>
                <li>
                  Escolha <strong>“Adicionar à Tela de Início”</strong> e confirme.
                </li>
                <li>Abra o Gabi pelo novo ícone, volte a esta tela e toque em “Ativar notificações”.</li>
              </ol>
            </section>
          )}

          <section className="card stack-12">
            <h2 className="h2">Este aparelho</h2>
            <p className="muted" style={{ fontSize: 15 }}>
              {!server.enabled
                ? 'As notificações ainda não foram configuradas no servidor (chaves VAPID).'
                : state === 'on'
                  ? 'Notificações ativadas.'
                  : state === 'needs-install'
                    ? 'Instale o app na Tela de Início para ativar.'
                    : state === 'denied'
                      ? 'As notificações foram bloqueadas. Libere nas configurações do navegador ou do sistema.'
                      : state === 'unsupported'
                        ? 'Este navegador não suporta notificações push.'
                        : 'Notificações desativadas.'}
            </p>
            {state === 'on' ? (
              <div className="sheet-actions">
                <button type="button" className="btn secondary" onClick={() => void disable()} disabled={busy}>
                  Desativar
                </button>
                <button type="button" className="btn" onClick={() => void test()} disabled={busy || !server.enabled}>
                  Enviar teste
                </button>
              </div>
            ) : (
              <button type="button" className="btn block" onClick={() => void enable()} disabled={busy || !server.enabled || state !== 'off'}>
                <Icon name="bell" size={18} /> Ativar notificações
              </button>
            )}
            {msg && (
              <p role="status" style={{ fontSize: 14, fontWeight: 700, color: msg.ok ? 'var(--ok)' : 'var(--danger)' }}>
                {msg.text}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
