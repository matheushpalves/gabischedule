import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  COLOR_STYLES,
  EVENT_REPEATS,
  EVENT_REPEAT_LABELS,
  NOTIFY_OPTIONS,
  endsNextDay,
  notifyLabel,
  type CalendarEvent,
  type ColorName,
  type EventInput,
  type EventRepeat,
} from '@gabi/shared';
import { del, errorMessage, patch, post } from '../lib/api';
import { MONTHS, WEEKDAYS, WEEKDAYS_SHORT, addDays, dayNum, monthLabel, monthOf, startOfWeek, todaySP, weekday } from '../lib/date';
import { useApi, useToday } from '../lib/hooks';
import { getPushState, type PushState } from '../lib/pwa';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { ColorPicker, Empty, ErrorState, Fab, Field, Loading, SheetActions } from '../components/ui';

export function AgendaPage() {
  const today = useToday(todaySP);
  const [selected, setSelected] = useState(today);
  const weekStart = startOfWeek(selected);
  const weekEnd = addDays(weekStart, 6);
  const events = useApi<CalendarEvent[]>(`/events?from=${weekStart}&to=${weekEnd}`);
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const list = events.data ?? [];
  /** Compromissos do dia: os que começam nele e os que vieram da noite anterior (atravessam a meia-noite). */
  const eventsOn = (d: string) => {
    const carried = list.filter((e) => e.date === addDays(d, -1) && endsNextDay(e)).map((e) => ({ e, carried: true }));
    const own = list.filter((e) => e.date === d).map((e) => ({ e, carried: false }));
    return [...carried, ...own];
  };
  const ofDay = eventsOn(selected);
  const count = ofDay.length;
  const title = `${selected === today ? 'Hoje' : WEEKDAYS[weekday(selected)]}, ${dayNum(selected)} de ${MONTHS[Number(selected.slice(5, 7)) - 1]}`;

  return (
    <div className="page">
      <header className="page-header">
        <div className="stack-4">
          <p className="eyebrow">{monthLabel(monthOf(selected))}</p>
          <h1 className="h1">Agenda</h1>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {!days.includes(today) && (
            <button type="button" className="chip" onClick={() => setSelected(today)}>
              Hoje
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Semana anterior" onClick={() => setSelected(addDays(selected, -7))}>
            <Icon name="chevronLeft" size={18} strokeWidth={2.5} />
          </button>
          <button type="button" className="icon-btn" aria-label="Próxima semana" onClick={() => setSelected(addDays(selected, 7))}>
            <Icon name="chevronRight" size={18} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <div className="week" role="group" aria-label="Dias da semana">
        {days.map((d) => {
          const has = eventsOn(d).length > 0;
          const on = d === selected;
          return (
            <button
              key={d}
              type="button"
              className={`day-btn${on ? ' on' : ''}${d === today ? ' today' : ''}`}
              aria-pressed={on}
              aria-label={`${WEEKDAYS[weekday(d)]}, ${dayNum(d)} de ${MONTHS[Number(d.slice(5, 7)) - 1]}${has ? ', com compromissos' : ''}`}
              onClick={() => setSelected(d)}
            >
              <span style={{ fontSize: 12, fontWeight: 700 }}>{WEEKDAYS_SHORT[weekday(d)]}</span>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{dayNum(d)}</span>
              <span className={`dot${has ? ' has' : ''}`} />
            </button>
          );
        })}
      </div>

      <div className="stack-4">
        <h2 className="h2">{title}</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          {events.loading && !events.data ? 'Carregando…' : count === 0 ? 'Sem compromissos' : `${count} ${count === 1 ? 'compromisso' : 'compromissos'}`}
        </p>
      </div>

      {events.loading && !events.data ? (
        <Loading rows={3} height={80} />
      ) : events.error ? (
        <ErrorState error={events.error} onRetry={() => void events.reload()} />
      ) : count === 0 ? (
        <Empty title="Dia livre" text="Nenhum compromisso marcado." />
      ) : (
        <div className="stack-12">
          {ofDay.map(({ e, carried }) => {
            const s = COLOR_STYLES[e.color];
            const overnight = endsNextDay(e);
            return (
              <div key={`${e.id}-${e.date}-${carried ? 'c' : 'o'}`} className="event-row">
                <div className="event-time">
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{carried ? '00:00' : e.startTime}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {e.endTime}
                    {overnight && !carried && (
                      <sup title="Termina no dia seguinte" aria-label="do dia seguinte">
                        {' '}
                        +1
                      </sup>
                    )}
                  </span>
                </div>
                <button type="button" className="event-card" style={{ background: s.bg }} onClick={() => setEditing(e)} aria-label={`Editar ${e.title}`}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: s.fg }}>{e.title}</span>
                  {carried && (
                    <span style={{ fontSize: 13, color: s.fg }}>Continua de ontem · começou às {e.startTime}</span>
                  )}
                  {e.place && (
                    <span className="row" style={{ gap: 6, fontSize: 13, color: s.fg }}>
                      <Icon name="pin" size={14} strokeWidth={2.2} />
                      {e.place}
                    </span>
                  )}
                  {(e.repeat !== 'once' || e.notifyMinutes !== null) && (
                    <span className="row wrap" style={{ gap: 12, fontSize: 13, color: s.fg }}>
                      {e.repeat !== 'once' && (
                        <span className="row" style={{ gap: 6 }}>
                          <Icon name="repeat" size={14} strokeWidth={2.2} />
                          {EVENT_REPEAT_LABELS[e.repeat]}
                        </span>
                      )}
                      {e.notifyMinutes !== null && (
                        <span className="row" style={{ gap: 6 }}>
                          <Icon name="bell" size={14} strokeWidth={2.2} />
                          {notifyLabel(e.notifyMinutes)}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Fab label="Novo compromisso" onClick={() => setEditing('new')} />

      {editing && (
        <EventSheet
          event={editing === 'new' ? null : editing}
          defaultDate={selected}
          onClose={() => setEditing(null)}
          onSaved={() => {
            // Séries repetidas são expandidas no servidor: recarrega a semana.
            void events.reload();
            setEditing(null);
          }}
          onDeleted={(id) => {
            events.setData((l) => l?.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EventSheet({
  event,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: CalendarEvent | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: (e: CalendarEvent) => void;
  onDeleted: (id: number) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [place, setPlace] = useState(event?.place ?? '');
  // Ao editar uma repetição, o formulário mostra a série (data de início da série).
  const [date, setDate] = useState(event?.seriesDate ?? defaultDate);
  const [startTime, setStart] = useState(event?.startTime ?? '09:00');
  const [endTime, setEnd] = useState(event?.endTime ?? '10:00');
  const [color, setColor] = useState<ColorName>(event?.color ?? 'rosa');
  const [repeat, setRepeat] = useState<EventRepeat>(event?.repeat ?? 'once');
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil ?? '');
  const [notifyMinutes, setNotifyMinutes] = useState<number | null>(event?.notifyMinutes ?? null);
  const [push, setPush] = useState<PushState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushState().then(setPush, () => setPush('unsupported'));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (repeat !== 'once' && repeatUntil && repeatUntil < date) {
      setError('A repetição deve terminar depois do início');
      return;
    }
    if (endTime === startTime) {
      setError('O fim deve ser diferente do início');
      return;
    }
    setSaving(true);
    setError(null);
    const body: EventInput = {
      title,
      place,
      date,
      startTime,
      endTime,
      color,
      repeat,
      repeatUntil: repeat !== 'once' && repeatUntil ? repeatUntil : null,
      notifyMinutes,
    };
    try {
      onSaved(event ? await patch<CalendarEvent>(`/events/${event.id}`, body) : await post<CalendarEvent>('/events', body));
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    setSaving(true);
    try {
      await del(`/events/${event.id}`);
      onDeleted(event.id);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet title={event ? 'Editar compromisso' : 'Novo compromisso'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <Field label="Título">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <Field label="Local">
          <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder="Opcional" />
        </Field>
        <Field label={repeat === 'once' ? 'Data' : 'Começa em'}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <div className="grid-2">
          <Field label="Início">
            <input className="input" type="time" value={startTime} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Fim">
            <input className="input" type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
        {endTime < startTime && (
          <p className="muted" style={{ fontSize: 14, marginTop: -4 }} aria-live="polite">
            Termina no dia seguinte ({dayNum(addDays(date, 1))} de {MONTHS[Number(addDays(date, 1).slice(5, 7)) - 1]}) às {endTime}.
          </p>
        )}
        <div className="grid-2">
          <Field label="Repetição">
            <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as EventRepeat)}>
              {EVENT_REPEATS.map((r) => (
                <option key={r} value={r}>
                  {EVENT_REPEAT_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          {repeat !== 'once' ? (
            <Field label="Repetir até (opcional)">
              <input className="input" type="date" value={repeatUntil} min={date} onChange={(e) => setRepeatUntil(e.target.value)} />
            </Field>
          ) : (
            <span />
          )}
        </div>
        <Field label="Notificação">
          <select
            className="input"
            value={notifyMinutes === null ? '' : String(notifyMinutes)}
            onChange={(e) => setNotifyMinutes(e.target.value === '' ? null : Number(e.target.value))}
          >
            {NOTIFY_OPTIONS.map((m) => (
              <option key={String(m)} value={m === null ? '' : String(m)}>
                {notifyLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        {notifyMinutes !== null && push !== null && push !== 'on' && (
          <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
            As notificações ainda não estão ativas neste aparelho.{' '}
            <Link to="/notificacoes" style={{ fontWeight: 800 }}>
              Ativar notificações
            </Link>
          </p>
        )}
        <ColorPicker value={color} onChange={setColor} />
        {event && event.repeat !== 'once' && (
          <p className="muted" style={{ fontSize: 14 }}>
            Alterar ou excluir vale para todas as repetições.
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <SheetActions saving={saving} onDelete={event ? remove : undefined} />
      </form>
    </Sheet>
  );
}
