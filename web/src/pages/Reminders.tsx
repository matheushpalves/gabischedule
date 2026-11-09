import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { REPEATS, REPEAT_LABELS, repeatLabel, type Reminder, type ReminderCompletion, type ReminderInput, type Repeat } from '@gabi/shared';
import { del, errorMessage, patch, post } from '../lib/api';
import { WEEKDAYS_SHORT, addDays, dateOfInstantSP, dayNum, nowTimeSP, relativeDate, shortDate, timeOfInstantSP, todaySP, weekday } from '../lib/date';
import { useApi, useToday } from '../lib/hooks';
import { getPushState, type PushState } from '../lib/pwa';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Empty, ErrorState, Fab, Field, Loading, SheetActions, Switch, toast } from '../components/ui';

/** Data/hora que o lembrete exibe: a ocorrência da vez (ou o próximo disparo, ou a data configurada). */
function display(r: Reminder): { date: string; time: string } {
  const at = r.currentAt ?? r.nextAt;
  if (at) return { date: dateOfInstantSP(at), time: timeOfInstantSP(at) };
  return { date: r.date, time: r.time };
}

const COMPLETED_PREVIEW = 5;

export function RemindersPage() {
  const today = useToday(todaySP);
  const reminders = useApi<Reminder[]>('/reminders');
  const completions = useApi<ReminderCompletion[]>('/reminder-completions');
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [showAllDone, setShowAllDone] = useState(false);

  useEffect(() => {
    getPushState().then(setPush, () => setPush('unsupported'));
  }, []);

  const list = reminders.data ?? [];
  const active = list.filter((r) => r.active).length;
  const next = list
    .filter((r) => r.active && r.nextAt)
    .sort((a, b) => a.nextAt!.localeCompare(b.nextAt!))[0];

  // "Uma vez" já concluídos saem das listas (ficam só em Concluídos).
  const open = list.filter((r) => !(r.repeat === 'once' && r.currentAt === null));
  const sorted = [...open].sort((a, b) => {
    const da = display(a);
    const db = display(b);
    return (da.date + da.time).localeCompare(db.date + db.time);
  });
  const todayList = sorted.filter((r) => display(r).date === today);
  const later = sorted.filter((r) => display(r).date > today);
  const ended = sorted.filter((r) => display(r).date < today);
  const doneList = completions.data ?? [];

  const setBusyFor = (id: number, on: boolean) =>
    setBusy((b) => {
      const n = new Set(b);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const toggle = async (r: Reminder) => {
    reminders.setData((l) => l?.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
    try {
      const updated = await patch<Reminder>(`/reminders/${r.id}`, { active: !r.active });
      reminders.setData((l) => l?.map((x) => (x.id === r.id ? updated : x)));
    } catch (err) {
      toast(errorMessage(err));
      void reminders.reload();
    }
  };

  const markDone = async (r: Reminder) => {
    setBusyFor(r.id, true);
    try {
      const updated = await post<Reminder>(`/reminders/${r.id}/done`);
      reminders.setData((l) => l?.map((x) => (x.id === r.id ? updated : x)));
      toast(r.repeat === 'once' ? 'Feito! Está em Concluídos.' : 'Feito! Volta no próximo horário.');
      void completions.reload();
    } catch (err) {
      toast(errorMessage(err));
      void reminders.reload();
    } finally {
      setBusyFor(r.id, false);
    }
  };

  const undo = async (c: ReminderCompletion) => {
    completions.setData((l) => l?.filter((x) => x.id !== c.id));
    try {
      await del(`/reminder-completions/${c.id}`);
      void reminders.reload();
    } catch (err) {
      toast(errorMessage(err));
      void completions.reload();
    }
  };

  const nowIso = new Date().toISOString();
  const row = (r: Reminder, withDay: boolean) => {
    const d = display(r);
    const late = r.currentAt !== null && r.currentAt <= nowIso;
    const chip = !r.active && !late
      ? { background: '#F1EAEE', color: '#6E5563' }
      : late
        ? { background: '#C2336A', color: '#FFFFFF' }
        : { background: '#FBE3EC', color: '#8E1F4C' };
    const canDone = r.currentAt !== null;
    return (
      <div key={r.id} className="item" style={{ padding: '12px 12px 12px 6px', gap: 8 }}>
        <button
          type="button"
          className="check"
          aria-label={`Marcar ${r.title} como feito`}
          onClick={() => void markDone(r)}
          disabled={!canDone || busy.has(r.id)}
        >
          <span className="box" />
        </button>
        <div className="tx-icon" style={{ ...chip, flexDirection: 'column', fontSize: withDay ? undefined : 13 }} aria-hidden="true">
          {withDay ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{WEEKDAYS_SHORT[weekday(d.date)]}</span>
              <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{dayNum(d.date)}</span>
            </>
          ) : (
            d.time
          )}
        </div>
        <button type="button" className="item-main" onClick={() => setEditing(r)} aria-label={`Editar ${r.title}`}>
          <span className="item-title">{r.title}</span>
          <span className="item-sub" style={late ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>
            {late ? (withDay ? `Pendente · ${shortDate(d.date)} · ` : 'Pendente · ') : withDay ? `${d.time} · ` : ''}
            {repeatLabel(r.repeat, r.intervalHours)}
          </span>
        </button>
        <Switch on={r.active} label={`Ativar ${r.title}`} onToggle={() => void toggle(r)} />
      </div>
    );
  };

  const doneRow = (c: ReminderCompletion) => {
    const doneDay = relativeDate(dateOfInstantSP(c.doneAt), today);
    return (
      <div key={c.id} className="item task-done">
        <button type="button" className="check on" aria-label={`Desfazer ${c.title}`} onClick={() => void undo(c)}>
          <span className="box">
            <Icon name="check" size={14} strokeWidth={3.5} style={{ color: '#fff' }} />
          </span>
        </button>
        <div className="item-main">
          <span className="item-title">{c.title}</span>
          <span className="item-sub" style={{ textDecoration: 'none' }}>
            Feito {doneDay === 'Hoje' || doneDay === 'Ontem' ? doneDay.toLowerCase() : `em ${doneDay}`} às {timeOfInstantSP(c.doneAt)}
            {c.repeat !== 'once' && ` · horário das ${timeOfInstantSP(c.occurrenceAt)}`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <header className="stack-4">
        <p className="eyebrow">{reminders.data ? `${active} ${active === 1 ? 'lembrete ativo' : 'lembretes ativos'}` : 'Lembretes'}</p>
        <h1 className="h1">Lembretes</h1>
      </header>

      <div className="hero plum" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: '18px 20px' }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="bell" />
        </div>
        <div className="stack-4" style={{ gap: 2, minWidth: 0 }}>
          {next ? (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F9D5E1' }}>
                Próximo lembrete · {dateOfInstantSP(next.nextAt!) === today ? '' : `${relativeDate(dateOfInstantSP(next.nextAt!), today)}, `}
                {timeOfInstantSP(next.nextAt!)}
              </p>
              <p style={{ fontSize: 17, fontWeight: 800 }}>{next.title}</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F9D5E1' }}>Próximo lembrete</p>
              <p style={{ fontSize: 17, fontWeight: 800 }}>Nenhum agendado</p>
            </>
          )}
        </div>
      </div>

      {push && push !== 'on' && (
        <Link to="/notificacoes" className="install" style={{ textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
          <Icon name="bell" size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <strong style={{ display: 'block' }}>Ativar notificações</strong>
            <span className="muted" style={{ fontSize: 14 }}>
              {push === 'needs-install'
                ? 'No iPhone, instale o app na Tela de Início primeiro.'
                : push === 'denied'
                  ? 'As notificações estão bloqueadas neste aparelho.'
                  : push === 'unsupported'
                    ? 'Este navegador não suporta notificações.'
                    : 'Receba os lembretes mesmo com o app fechado.'}
            </span>
          </span>
          <Icon name="chevronRight" size={20} />
        </Link>
      )}

      {reminders.loading && !reminders.data ? (
        <Loading rows={4} />
      ) : reminders.error ? (
        <ErrorState error={reminders.error} onRetry={() => void reminders.reload()} />
      ) : list.length === 0 ? (
        <Empty icon="bell" title="Nenhum lembrete" text="Toque no + para criar o primeiro." />
      ) : (
        <div className="two-col">
          <div className="stack" style={{ gap: 22 }}>
            <section className="stack">
              <h2 className="h2">Hoje</h2>
              {todayList.length ? todayList.map((r) => row(r, false)) : <p className="muted">Nada pendente para hoje.</p>}
            </section>
            {ended.length > 0 && (
              <section className="stack">
                <h2 className="h2">Atrasados</h2>
                {ended.map((r) => row(r, true))}
              </section>
            )}
          </div>
          <div className="stack" style={{ gap: 22 }}>
            <section className="stack">
              <h2 className="h2">Próximos dias</h2>
              {later.length ? later.map((r) => row(r, true)) : <p className="muted">Nenhum lembrete nos próximos dias.</p>}
            </section>
            {doneList.length > 0 && (
              <section className="stack">
                <div className="row-between">
                  <h2 className="h2">Concluídos</h2>
                  <span className="muted" style={{ fontSize: 13 }}>últimos 30 dias</span>
                </div>
                {(showAllDone ? doneList : doneList.slice(0, COMPLETED_PREVIEW)).map(doneRow)}
                {doneList.length > COMPLETED_PREVIEW && (
                  <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAllDone(!showAllDone)}>
                    {showAllDone ? 'Mostrar menos' : `Ver todos (${doneList.length})`}
                  </button>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      <Fab label="Novo lembrete" onClick={() => setEditing('new')} />
      {editing && (
        <ReminderSheet
          reminder={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(r, isNew) => {
            reminders.setData((l) => (isNew ? [...(l ?? []), r] : l?.map((x) => (x.id === r.id ? r : x))));
            setEditing(null);
          }}
          onDeleted={(id) => {
            reminders.setData((l) => l?.filter((x) => x.id !== id));
            void completions.reload();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ReminderSheet({
  reminder,
  onClose,
  onSaved,
  onDeleted,
}: {
  reminder: Reminder | null;
  onClose: () => void;
  onSaved: (r: Reminder, isNew: boolean) => void;
  onDeleted: (id: number) => void;
}) {
  const nowHour = nowTimeSP();
  const [title, setTitle] = useState(reminder?.title ?? '');
  const [date, setDate] = useState(reminder?.date ?? (nowHour > '23:00' ? addDays(todaySP(), 1) : todaySP()));
  const [time, setTime] = useState(reminder?.time ?? `${String((Number(nowHour.slice(0, 2)) + 1) % 24).padStart(2, '0')}:00`);
  const [repeat, setRepeat] = useState<Repeat>(reminder?.repeat ?? 'once');
  const [intervalHours, setIntervalHours] = useState(String(reminder?.intervalHours ?? 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body: ReminderInput = {
      title,
      date,
      time,
      repeat,
      intervalHours: repeat === 'hourly' ? Number(intervalHours) : null,
      // Editar mantém o estado do interruptor; um lembrete encerrado volta a ficar ativo.
      active: reminder ? reminder.active || !reminder.nextAt : true,
    };
    try {
      const saved = reminder ? await patch<Reminder>(`/reminders/${reminder.id}`, body) : await post<Reminder>('/reminders', body);
      if (!saved.nextAt) toast('Esse horário já passou: o lembrete ficou encerrado.');
      onSaved(saved, !reminder);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!reminder) return;
    setSaving(true);
    try {
      await del(`/reminders/${reminder.id}`);
      onDeleted(reminder.id);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet title={reminder ? 'Editar lembrete' : 'Novo lembrete'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <Field label="Título">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <div className="grid-2">
          <Field label={repeat === 'once' ? 'Data' : 'A partir de'}>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Hora">
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        </div>
        <Field label="Repetição">
          <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {REPEAT_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        {repeat === 'hourly' && (
          <Field label="Intervalo (horas)">
            <input className="input" type="number" inputMode="numeric" min={1} max={168} value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} required />
          </Field>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <SheetActions saving={saving} onDelete={reminder ? remove : undefined} />
      </form>
    </Sheet>
  );
}
