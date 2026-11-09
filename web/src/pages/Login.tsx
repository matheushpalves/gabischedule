import { useCallback, useEffect, useState } from 'react';
import { ApiError, post } from '../lib/api';
import { Icon } from '../components/Icon';

const MAX_LEN = 8;

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(async () => {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      await post('/auth/login', { code });
      onSuccess();
    } catch (err) {
      setCode('');
      setShake(true);
      setTimeout(() => setShake(false), 450);
      if (err instanceof ApiError && err.status === 429) {
        const min = Math.max(1, Math.ceil((err.retryAfter ?? 900) / 60));
        setError(`Muitas tentativas. Tente de novo em ${min} min.`);
      } else if (err instanceof ApiError && err.status === 0) {
        setError(err.message);
      } else {
        setError('Código incorreto');
      }
    } finally {
      setBusy(false);
    }
  }, [code, busy, onSuccess]);

  const press = (d: string) => {
    setError(null);
    setCode((c) => (c.length < MAX_LEN ? c + d : c));
  };
  const back = () => setCode((c) => c.slice(0, -1));

  // Teclado físico (computador)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') void submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit]);

  return (
    <main className="login">
      <div className="stack-4" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="avatar" aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 32, fontSize: 30, marginBottom: 12 }}>
          G
        </div>
        <h1 className="h1">Oi, Gabriela</h1>
        <p className="muted">Digite o código para entrar</p>
      </div>

      <div className={`pin-dots${shake ? ' shake' : ''}`} aria-hidden="true">
        {Array.from({ length: Math.max(4, code.length) }, (_, i) => (
          <span key={i} className={i < code.length ? 'on' : ''} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {code.length} dígitos digitados
      </p>
      <p className="error-text" role="alert" style={{ minHeight: 20 }}>
        {error}
      </p>

      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="key" onClick={() => press(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <button type="button" className="key ghost" aria-label="Apagar" onClick={back} disabled={busy || !code}>
          <Icon name="chevronLeft" size={28} />
        </button>
        <button type="button" className="key" onClick={() => press('0')} disabled={busy}>
          0
        </button>
        <button type="button" className="key go" aria-label="Entrar" onClick={() => void submit()} disabled={busy || !code}>
          <Icon name="check" size={30} strokeWidth={3} />
        </button>
      </div>
    </main>
  );
}
