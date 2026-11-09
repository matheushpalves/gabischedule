import { useEffect, useId, useState, type ReactNode } from 'react';
import { COLORS, COLOR_STYLES, type ColorName } from '@gabi/shared';
import { Icon, type IconName } from './Icon';

/* ---------- Estados de carregando / vazio / erro ---------- */

export function Loading({ rows = 3, height = 72 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" role="status" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function Empty({ title, text, icon = 'heart', action }: { title: string; text?: string; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="state">
      <Icon name={icon} size={36} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
      <p className="state-title">{title}</p>
      {text && <p className="state-text">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <Icon name="wifiOff" size={36} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
      <p className="state-title">Não foi possível carregar</p>
      <p className="state-text">{error.message}</p>
      {onRetry && (
        <button type="button" className="btn secondary" onClick={onRetry}>
          <Icon name="refresh" size={18} /> Tentar de novo
        </button>
      )}
    </div>
  );
}

/* ---------- Botão flutuante ---------- */

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="fab" aria-label={label} onClick={onClick}>
      <Icon name="plus" size={26} strokeWidth={2.5} />
    </button>
  );
}

/* ---------- Formulário ---------- */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ColorPicker({ value, onChange, label = 'Cor' }: { value: ColorName; onChange: (c: ColorName) => void; label?: string }) {
  const id = useId();
  return (
    <div className="field">
      <span className="label" id={id}>
        {label}
      </span>
      <div className="swatches" role="radiogroup" aria-labelledby={id}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={COLOR_STYLES[c].label}
            className="swatch"
            style={{ background: COLOR_STYLES[c].bg, color: COLOR_STYLES[c].fg }}
            onClick={() => onChange(c)}
          >
            {value === c && <Icon name="check" size={18} strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onToggle}>
      <span className="track">
        <span className="knob" />
      </span>
    </button>
  );
}

export function Tag({ color, children }: { color: ColorName; children: ReactNode }) {
  const s = COLOR_STYLES[color];
  return (
    <span className="tag" style={{ background: s.bg, color: s.fg }}>
      {children}
    </span>
  );
}

/** Rodapé padrão das folhas de edição: salvar + excluir (com confirmação). */
export function SheetActions({
  saving,
  onDelete,
  saveLabel = 'Salvar',
}: {
  saving: boolean;
  onDelete?: () => void | Promise<void>;
  saveLabel?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="sheet-actions">
      {onDelete &&
        (confirm ? (
          <button type="button" className="btn danger" onClick={() => void onDelete()} disabled={saving}>
            <Icon name="trash" size={18} /> Confirmar exclusão
          </button>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirm(true)} disabled={saving}>
            <Icon name="trash" size={18} /> Excluir
          </button>
        ))}
      <button type="submit" className="btn" disabled={saving}>
        {saving ? 'Salvando…' : saveLabel}
      </button>
    </div>
  );
}

/* ---------- Aviso rápido ---------- */

let pushToast: ((msg: string) => void) | null = null;
export function toast(msg: string) {
  pushToast?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 3200);
    };
    return () => {
      pushToast = null;
      clearTimeout(t);
    };
  }, []);
  return (
    <div aria-live="polite" role="status">
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
