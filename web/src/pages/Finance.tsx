import { useMemo, useState, type FormEvent } from 'react';
import {
  COLOR_STYLES,
  centsToInput,
  formatBRL,
  parseBRL,
  type ColorName,
  type FinCategory,
  type FinanceSummary,
  type Goal,
  type Transaction,
  type TransactionInput,
} from '@gabi/shared';
import { del, errorMessage, patch, post, put } from '../lib/api';
import { addMonths, monthLabel, monthOf, shortDate, todaySP } from '../lib/date';
import { useApi, useLocalState } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { ColorPicker, Empty, ErrorState, Fab, Field, Loading, SheetActions } from '../components/ui';

type Filter = 'all' | 'in' | 'out';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'in', label: 'Entradas' },
  { id: 'out', label: 'Saídas' },
];

export function FinancePage() {
  const [month, setMonth] = useState(() => monthOf(todaySP()));
  const [hide, setHide] = useLocalState('gabi:hide-values', false);
  const [filter, setFilter] = useState<Filter>('all');
  const summary = useApi<FinanceSummary>(`/finance/summary?month=${month}`);
  const txs = useApi<Transaction[]>(`/finance/transactions?month=${month}`);
  const cats = useApi<FinCategory[]>('/finance/categories');
  const goals = useApi<Goal[]>('/finance/goals');
  const [editingTx, setEditingTx] = useState<Transaction | 'new' | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | 'new' | null>(null);
  const [managingCats, setManagingCats] = useState(false);

  const brl = (c: number) => (hide ? 'R$ ••••' : formatBRL(c));
  const catById = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);
  const shown = (txs.data ?? []).filter((t) => filter === 'all' || t.type === filter);

  const refresh = () => {
    void summary.reload();
    void txs.reload();
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="stack-4">
          <div className="row" style={{ gap: 2, marginLeft: -12 }}>
            <button type="button" className="icon-btn ghost" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
              <Icon name="chevronLeft" size={16} strokeWidth={2.5} />
            </button>
            <p className="eyebrow" aria-live="polite" style={{ minWidth: 120, textAlign: 'center' }}>
              {monthLabel(month)}
            </p>
            <button type="button" className="icon-btn ghost" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>
              <Icon name="chevronRight" size={16} strokeWidth={2.5} />
            </button>
          </div>
          <h1 className="h1">Finanças</h1>
        </div>
        <button type="button" className="icon-btn" aria-label={hide ? 'Mostrar valores' : 'Esconder valores'} aria-pressed={hide} onClick={() => setHide(!hide)}>
          <Icon name={hide ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </header>

      <div className="finance-grid">
        <div className="stack" style={{ gap: 22 }}>
          {/* Saldo */}
          <div className="hero plum" style={{ borderRadius: 26, padding: 22, gap: 18 }}>
            {summary.error ? (
              <div className="row-between">
                <p>Não foi possível carregar o saldo.</p>
                <button type="button" className="btn secondary" onClick={() => void summary.reload()}>
                  Tentar de novo
                </button>
              </div>
            ) : (
              <>
                <div className="stack-4">
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-dark-soft)' }}>Saldo do mês</p>
                  <p style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 600, lineHeight: 1.1 }}>
                    {summary.data ? brl(summary.data.balanceCents) : '…'}
                  </p>
                </div>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="mini">
                    <div className="row" style={{ gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--income-label)' }}>
                      <Icon name="arrowUp" size={14} strokeWidth={2.5} /> Entradas
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 800 }}>{summary.data ? brl(summary.data.incomeCents) : '…'}</p>
                  </div>
                  <div className="mini">
                    <div className="row" style={{ gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--on-dark-soft)' }}>
                      <Icon name="arrowDown" size={14} strokeWidth={2.5} /> Saídas
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 800 }}>{summary.data ? brl(summary.data.expenseCents) : '…'}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Metas */}
          {goals.error ? (
            <ErrorState error={goals.error} onRetry={() => void goals.reload()} />
          ) : goals.loading && !goals.data ? (
            <Loading rows={1} height={96} />
          ) : (
            <div className="stack">
              {(goals.data ?? []).map((g) => {
                const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
                return (
                  <button key={g.id} type="button" className="card stack-12" style={{ border: 'none', textAlign: 'left' }} onClick={() => setEditingGoal(g)} aria-label={`Editar meta ${g.name}`}>
                    <div className="row-between">
                      <div className="row" style={{ gap: 10, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--goal-icon-bg)', color: 'var(--goal-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name="plane" size={20} />
                        </div>
                        <div className="stack-4" style={{ gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 16, fontWeight: 800 }}>Meta: {g.name}</span>
                          <span className="muted" style={{ fontSize: 13 }}>
                            {brl(g.savedCents)} de {brl(g.targetCents)}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--goal-fg)' }}>{pct}%</span>
                    </div>
                    <div className="bar" style={{ background: 'var(--goal-track)' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso da meta ${g.name}`}>
                      <span style={{ width: `${pct}%`, background: 'var(--goal-bar)' }} />
                    </div>
                  </button>
                );
              })}
              <button type="button" className="add-card" onClick={() => setEditingGoal('new')}>
                + Nova meta de economia
              </button>
            </div>
          )}

          {/* Orçamento */}
          <section className="stack-12">
            <div className="row-between">
              <h2 className="h2">Orçamento por categoria</h2>
              <button type="button" className="link-btn" onClick={() => setManagingCats(true)}>
                Categorias
              </button>
            </div>
            {summary.loading && !summary.data ? (
              <Loading rows={1} height={160} />
            ) : !summary.data || summary.data.budgets.length === 0 ? (
              <Empty icon="wallet" title="Sem orçamento" text="Defina limites mensais nas categorias." />
            ) : (
              <div className="card" style={{ padding: '6px 18px' }}>
                {summary.data.budgets.map((b) => {
                  const ratio = b.spentCents / b.limitCents;
                  const warn = ratio >= 0.85;
                  const pct = Math.min(100, Math.round(ratio * 100));
                  return (
                    <div key={b.categoryId} className="budget-row">
                      <div className="row-between" style={{ alignItems: 'baseline' }}>
                        <p style={{ fontSize: 15, fontWeight: 700 }}>{b.name}</p>
                        <p className="muted" style={{ fontSize: 13 }}>
                          <strong style={{ color: warn ? 'var(--danger)' : 'var(--ink)' }}>{brl(b.spentCents)}</strong> de {brl(b.limitCents)}
                        </p>
                      </div>
                      <div className="bar" style={{ height: 8, background: 'var(--line-soft)' }} role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Orçamento de ${b.name}`}>
                        <span style={{ width: `${pct}%`, background: warn ? 'var(--accent)' : 'var(--bar-soft)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Movimentações */}
        <section className="stack-12">
          <h2 className="h2">Movimentações</h2>
          <div className="row" role="group" aria-label="Filtrar movimentações">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          {txs.loading && !txs.data ? (
            <Loading rows={4} height={68} />
          ) : txs.error ? (
            <ErrorState error={txs.error} onRetry={() => void txs.reload()} />
          ) : shown.length === 0 ? (
            <Empty icon="wallet" title="Nenhuma movimentação" text={`Nada registrado em ${monthLabel(month).toLowerCase()}.`} />
          ) : (
            shown.map((t) => {
              const c = t.categoryId ? catById.get(t.categoryId) : undefined;
              const s = COLOR_STYLES[c?.color ?? (t.type === 'in' ? 'verde' : 'rosa')];
              return (
                <button key={t.id} type="button" className="item" style={{ border: 'none', textAlign: 'left', padding: '12px 14px' }} onClick={() => setEditingTx(t)} aria-label={`Editar ${t.title}`}>
                  <span className="tx-icon" style={{ background: s.bg, color: s.fg }} aria-hidden="true">
                    {t.title.charAt(0).toUpperCase()}
                  </span>
                  <span className="stack-4" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>{t.title}</span>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {c?.name ?? 'Sem categoria'} · {shortDate(t.date)}
                    </span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, flexShrink: 0, color: t.type === 'in' ? 'var(--ok)' : 'var(--ink)' }}>
                    {t.type === 'in' ? '+ ' : '− '}
                    {brl(t.amountCents)}
                  </span>
                </button>
              );
            })
          )}
        </section>
      </div>

      <Fab label="Nova movimentação" onClick={() => setEditingTx('new')} />

      {editingTx && (
        <TransactionSheet
          tx={editingTx === 'new' ? null : editingTx}
          categories={cats.data ?? []}
          defaultDate={month === monthOf(todaySP()) ? todaySP() : `${month}-01`}
          onClose={() => setEditingTx(null)}
          onDone={() => {
            setEditingTx(null);
            refresh();
          }}
        />
      )}
      {editingGoal && (
        <GoalSheet
          goal={editingGoal === 'new' ? null : editingGoal}
          onClose={() => setEditingGoal(null)}
          onDone={() => {
            setEditingGoal(null);
            void goals.reload();
          }}
        />
      )}
      {managingCats && (
        <FinCategoriesSheet
          categories={cats.data ?? []}
          onClose={() => setManagingCats(false)}
          onChange={() => {
            void cats.reload();
            refresh();
          }}
        />
      )}
    </div>
  );
}

function MoneyInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <input className="input" inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} />
    </Field>
  );
}

function TransactionSheet({
  tx,
  categories,
  defaultDate,
  onClose,
  onDone,
}: {
  tx: Transaction | null;
  categories: FinCategory[];
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<'in' | 'out'>(tx?.type ?? 'out');
  const [title, setTitle] = useState(tx?.title ?? '');
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amountCents) : '');
  const [categoryId, setCategoryId] = useState<number | null>(tx?.categoryId ?? null);
  const [date, setDate] = useState(tx?.date ?? defaultDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseBRL(amount);
    if (!cents) {
      setError('Informe um valor válido, ex.: 1.234,56');
      return;
    }
    setSaving(true);
    setError(null);
    const body: TransactionInput = { type, title, amountCents: cents, categoryId, date };
    try {
      if (tx) await patch(`/finance/transactions/${tx.id}`, body);
      else await post('/finance/transactions', body);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!tx) return;
    setSaving(true);
    try {
      await del(`/finance/transactions/${tx.id}`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet title={tx ? 'Editar movimentação' : 'Nova movimentação'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <div className="row" role="radiogroup" aria-label="Tipo">
          {(['out', 'in'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} className={`chip${type === t ? ' on' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setType(t)}>
              <Icon name={t === 'in' ? 'arrowUp' : 'arrowDown'} size={16} strokeWidth={2.5} />
              {t === 'in' ? 'Entrada' : 'Saída'}
            </button>
          ))}
        </div>
        <Field label="Descrição">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <div className="grid-2">
          <MoneyInput label="Valor (R$)" value={amount} onChange={setAmount} />
          <Field label="Data">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="Categoria">
          <select className="input" value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <SheetActions saving={saving} onDelete={tx ? remove : undefined} />
      </form>
    </Sheet>
  );
}

function GoalSheet({ goal, onClose, onDone }: { goal: Goal | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [saved, setSaved] = useState(goal ? centsToInput(goal.savedCents) : '0,00');
  const [target, setTarget] = useState(goal ? centsToInput(goal.targetCents) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const savedCents = parseBRL(saved || '0');
    const targetCents = parseBRL(target);
    if (savedCents === null || !targetCents) {
      setError('Informe valores válidos, ex.: 5.000,00');
      return;
    }
    setSaving(true);
    try {
      const body = { name, savedCents, targetCents };
      if (goal) await put(`/finance/goals/${goal.id}`, body);
      else await post('/finance/goals', body);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!goal) return;
    setSaving(true);
    try {
      await del(`/finance/goals/${goal.id}`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet title={goal ? 'Editar meta' : 'Nova meta'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <Field label="Nome da meta">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Ex.: Viagem de férias" />
        </Field>
        <div className="grid-2">
          <MoneyInput label="Guardado (R$)" value={saved} onChange={setSaved} />
          <MoneyInput label="Objetivo (R$)" value={target} onChange={setTarget} />
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <SheetActions saving={saving} onDelete={goal ? remove : undefined} />
      </form>
    </Sheet>
  );
}

function FinCategoriesSheet({ categories, onClose, onChange }: { categories: FinCategory[]; onClose: () => void; onChange: () => void }) {
  const [editing, setEditing] = useState<{ id: number | null; name: string; color: ColorName; limit: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const limitCents = editing.limit.trim() ? parseBRL(editing.limit) : null;
    if (editing.limit.trim() && limitCents === null) {
      setError('Limite inválido');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name: editing.name, color: editing.color, limitCents };
      if (editing.id) await put(`/finance/categories/${editing.id}`, body);
      else await post('/finance/categories', body);
      setEditing(null);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!editing?.id) return;
    try {
      await del(`/finance/categories/${editing.id}`);
      setEditing(null);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet title="Categorias e limites" onClose={onClose}>
      {editing ? (
        <form className="form" onSubmit={(e) => void save(e)}>
          <Field label="Nome">
            <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required maxLength={40} />
          </Field>
          <MoneyInput label="Limite mensal (R$, opcional)" value={editing.limit} onChange={(limit) => setEditing({ ...editing, limit })} />
          <ColorPicker value={editing.color} onChange={(color) => setEditing({ ...editing, color })} />
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <SheetActions saving={saving} onDelete={editing.id ? remove : undefined} />
          <button type="button" className="link-btn" onClick={() => setEditing(null)}>
            Voltar
          </button>
        </form>
      ) : (
        <div className="stack">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="item"
              style={{ border: 'none', textAlign: 'left' }}
              onClick={() => setEditing({ id: c.id, name: c.name, color: c.color, limit: c.limitCents ? centsToInput(c.limitCents) : '' })}
            >
              <span className="tag" style={{ background: COLOR_STYLES[c.color].bg, color: COLOR_STYLES[c.color].fg }}>
                {c.name}
              </span>
              <span className="muted" style={{ flex: 1, fontSize: 14 }}>
                {c.limitCents ? `Limite ${formatBRL(c.limitCents)}` : 'Sem limite'}
              </span>
              <Icon name="edit" size={18} />
            </button>
          ))}
          <button type="button" className="add-card" onClick={() => setEditing({ id: null, name: '', color: 'lilas', limit: '' })}>
            + Nova categoria
          </button>
        </div>
      )}
    </Sheet>
  );
}
