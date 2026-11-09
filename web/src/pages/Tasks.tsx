import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { COLOR_STYLES, type ColorName, type Task, type TaskCategory, type TaskInput } from '@gabi/shared';
import { del, errorMessage, patch, post, put } from '../lib/api';
import { addDays, longDate, relativeDate, startOfWeek, todaySP } from '../lib/date';
import { useApi, useToday } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { InstallBanner } from '../components/InstallBanner';
import { ColorPicker, Empty, ErrorState, Fab, Field, Loading, SheetActions, Tag, toast } from '../components/ui';

type Filter = 'today' | 'week' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'all', label: 'Todas' },
];

/** Tarefas que contam para "hoje": vencem hoje, atrasadas pendentes, sem data pendentes, ou concluídas hoje. */
function isToday(t: Task, today: string): boolean {
  if (t.done) return t.doneDate === today || t.dueDate === today;
  return t.dueDate === null || t.dueDate <= today;
}
function isThisWeek(t: Task, today: string): boolean {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  if (t.done) return (t.doneDate !== null && t.doneDate >= start) || (t.dueDate !== null && t.dueDate >= start && t.dueDate <= end);
  return t.dueDate === null || t.dueDate <= end;
}

function taskMeta(t: Task, today: string): { text: string; late: boolean } {
  if (!t.dueDate) return { text: t.dueTime ? t.dueTime : 'Sem prazo', late: false };
  const late = !t.done && t.dueDate < today;
  const day = relativeDate(t.dueDate, today);
  if (late) return { text: `Atrasada · ${day}${t.dueTime ? ` · ${t.dueTime}` : ''}`, late };
  if (t.dueDate === today && t.dueTime) return { text: `Até ${t.dueTime}`, late };
  return { text: t.dueTime ? `${day} · ${t.dueTime}` : day, late };
}

export function TasksPage() {
  const today = useToday(todaySP);
  const tasks = useApi<Task[]>('/tasks');
  const cats = useApi<TaskCategory[]>('/task-categories');
  const [filter, setFilter] = useState<Filter>('today');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [managingCats, setManagingCats] = useState(false);

  const catById = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);
  const all = tasks.data ?? [];
  const todaySet = all.filter((t) => isToday(t, today));
  const doneToday = todaySet.filter((t) => t.done).length;
  const pct = todaySet.length ? Math.round((doneToday / todaySet.length) * 100) : 0;
  const pendingToday = todaySet.length - doneToday;

  const shown = all.filter((t) => (filter === 'today' ? isToday(t, today) : filter === 'week' ? isThisWeek(t, today) : true));
  const pending = shown.filter((t) => !t.done);
  const done = shown.filter((t) => t.done);

  const toggle = async (t: Task) => {
    tasks.setData((list) => list?.map((x) => (x.id === t.id ? { ...x, done: !x.done, doneDate: !x.done ? today : null } : x)));
    try {
      const updated = await patch<Task>(`/tasks/${t.id}`, { done: !t.done });
      tasks.setData((list) => list?.map((x) => (x.id === t.id ? updated : x)));
    } catch (err) {
      toast(errorMessage(err));
      void tasks.reload();
    }
  };

  return (
    <div className="page">
      <header className="page-header" style={{ alignItems: 'flex-start' }}>
        <div className="stack-4">
          <p className="eyebrow">{longDate(today)}</p>
          <h1 className="h1">Oi, Gabriela</h1>
        </div>
        <Link to="/ajustes" className="avatar only-mobile" aria-label="Ajustes">
          G
        </Link>
      </header>

      <InstallBanner />

      <div className="two-col">
        <section className="stack" style={{ gap: 22 }}>
          <div className="hero pink" aria-label="Progresso de hoje">
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <p style={{ fontSize: 15, fontWeight: 700 }}>Progresso de hoje</p>
              <p style={{ fontSize: 15, fontWeight: 800 }}>
                {doneToday} de {todaySet.length}
              </p>
            </div>
            <div
              className="bar"
              style={{ background: 'rgba(255,255,255,0.3)' }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Tarefas de hoje concluídas"
            >
              <span style={{ width: `${pct}%`, background: '#fff' }} />
            </div>
            <p style={{ fontSize: 14 }}>
              {todaySet.length === 0
                ? 'Nada para hoje. Aproveite!'
                : pendingToday === 0
                  ? 'Tudo feito! Hora de descansar.'
                  : `Faltam ${pendingToday} ${pendingToday === 1 ? 'tarefa' : 'tarefas'}. Você consegue!`}
            </p>
          </div>

          <div className="row wrap" role="group" aria-label="Filtrar tarefas">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
            <button type="button" className="link-btn" style={{ marginLeft: 'auto' }} onClick={() => setManagingCats(true)}>
              Categorias
            </button>
          </div>
        </section>

        <section className="stack" style={{ gap: 22 }}>
          {tasks.loading && !tasks.data ? (
            <Loading rows={4} />
          ) : tasks.error ? (
            <ErrorState error={tasks.error} onRetry={() => void tasks.reload()} />
          ) : (
            <>
              <div className="stack">
                <h2 className="h2">Para fazer</h2>
                {pending.length === 0 ? (
                  <Empty
                    title={all.length === 0 ? 'Nenhuma tarefa ainda' : 'Nada pendente aqui'}
                    text={all.length === 0 ? 'Toque no + para criar a primeira.' : 'Que tal descansar um pouco?'}
                  />
                ) : (
                  pending.map((t) => {
                    const c = t.categoryId ? catById.get(t.categoryId) : undefined;
                    const meta = taskMeta(t, today);
                    return (
                      <div key={t.id} className="item" style={{ padding: '14px 14px 14px 10px', gap: 10 }}>
                        <button type="button" className="check" aria-label={`Concluir ${t.title}`} onClick={() => void toggle(t)}>
                          <span className="box" />
                        </button>
                        <button type="button" className="item-main" onClick={() => setEditing(t)} aria-label={`Editar ${t.title}`}>
                          <span className="item-title">{t.title}</span>
                          <span className="item-sub" style={meta.late ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>
                            {meta.text}
                          </span>
                        </button>
                        {c && <Tag color={c.color}>{c.name}</Tag>}
                      </div>
                    );
                  })
                )}
              </div>

              {done.length > 0 && (
                <div className="stack">
                  <h2 className="h2">Concluídas</h2>
                  {done.map((t) => (
                    <div key={t.id} className="item task-done">
                      <button type="button" className="check on" aria-label={`Reabrir ${t.title}`} onClick={() => void toggle(t)}>
                        <span className="box">
                          <Icon name="check" size={14} strokeWidth={3.5} style={{ color: '#fff' }} />
                        </span>
                      </button>
                      <button type="button" className="item-main" onClick={() => setEditing(t)} aria-label={`Editar ${t.title}`}>
                        <span className="item-title">{t.title}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Fab label="Nova tarefa" onClick={() => setEditing('new')} />

      {editing && (
        <TaskSheet
          task={editing === 'new' ? null : editing}
          categories={cats.data ?? []}
          defaultDate={filter === 'today' ? today : null}
          onClose={() => setEditing(null)}
          onSaved={(t, isNew) => {
            tasks.setData((list) => (isNew ? [...(list ?? []), t] : list?.map((x) => (x.id === t.id ? t : x))));
            setEditing(null);
          }}
          onDeleted={(id) => {
            tasks.setData((list) => list?.filter((x) => x.id !== id));
            setEditing(null);
          }}
          onCategoryCreated={(c) => cats.setData((l) => [...(l ?? []), c])}
        />
      )}
      {managingCats && (
        <CategoriesSheet
          categories={cats.data ?? []}
          onClose={() => setManagingCats(false)}
          onChange={() => {
            void cats.reload();
            void tasks.reload();
          }}
        />
      )}
    </div>
  );
}

function TaskSheet({
  task,
  categories,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
  onCategoryCreated,
}: {
  task: Task | null;
  categories: TaskCategory[];
  defaultDate: string | null;
  onClose: () => void;
  onSaved: (t: Task, isNew: boolean) => void;
  onDeleted: (id: number) => void;
  onCategoryCreated: (c: TaskCategory) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(task?.categoryId ?? categories[0]?.id ?? null);
  const [dueDate, setDueDate] = useState(task ? (task.dueDate ?? '') : (defaultDate ?? ''));
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCat, setNewCat] = useState<{ name: string; color: ColorName } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body: TaskInput = {
      title,
      categoryId,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      notes: notes.trim() || null,
    };
    try {
      const saved = task ? await patch<Task>(`/tasks/${task.id}`, body) : await post<Task>('/tasks', body);
      onSaved(saved, !task);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const createCategory = async () => {
    if (!newCat?.name.trim()) return;
    try {
      const c = await post<TaskCategory>('/task-categories', newCat);
      onCategoryCreated(c);
      setCategoryId(c.id);
      setNewCat(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await del(`/tasks/${task.id}`);
      onDeleted(task.id);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet title={task ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <Field label="Título">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>

        <div className="field">
          <span className="label">Categoria</span>
          <div className="row wrap" role="radiogroup" aria-label="Categoria">
            <button type="button" role="radio" aria-checked={categoryId === null} className={`chip${categoryId === null ? ' on' : ''}`} onClick={() => setCategoryId(null)}>
              Nenhuma
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={categoryId === c.id}
                className="chip"
                style={
                  categoryId === c.id
                    ? { background: COLOR_STYLES[c.color].fg, borderColor: COLOR_STYLES[c.color].fg, color: '#fff' }
                    : { background: COLOR_STYLES[c.color].bg, borderColor: 'transparent', color: COLOR_STYLES[c.color].fg }
                }
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
            {!newCat && (
              <button type="button" className="chip" onClick={() => setNewCat({ name: '', color: 'lilas' })}>
                <Icon name="plus" size={16} /> Nova
              </button>
            )}
          </div>
          {newCat && (
            <div className="card stack-12" style={{ padding: 14 }}>
              <Field label="Nome da categoria">
                <input className="input" value={newCat.name} maxLength={40} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              </Field>
              <ColorPicker value={newCat.color} onChange={(color) => setNewCat({ ...newCat, color })} />
              <div className="sheet-actions">
                <button type="button" className="btn secondary" onClick={() => setNewCat(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn" onClick={() => void createCategory()}>
                  Criar categoria
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid-2">
          <Field label="Prazo (opcional)">
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Horário">
            <input className="input" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Observações">
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <SheetActions saving={saving} onDelete={task ? remove : undefined} />
      </form>
    </Sheet>
  );
}

function CategoriesSheet({ categories, onClose, onChange }: { categories: TaskCategory[]; onClose: () => void; onChange: () => void }) {
  const [editing, setEditing] = useState<TaskCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (c: TaskCategory) => {
    setError(null);
    try {
      await put(`/task-categories/${c.id}`, { name: c.name, color: c.color });
      setEditing(null);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const remove = async (c: TaskCategory) => {
    setError(null);
    try {
      await del(`/task-categories/${c.id}`);
      setEditing(null);
      onChange();
      toast(`Categoria “${c.name}” excluída`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet title="Categorias" onClose={onClose}>
      <p className="muted" style={{ fontSize: 14 }}>
        Novas categorias podem ser criadas ao adicionar uma tarefa. Excluir uma categoria não apaga as tarefas.
      </p>
      <div className="stack">
        {categories.map((c) =>
          editing?.id === c.id ? (
            <form
              key={c.id}
              className="card stack-12"
              style={{ padding: 14 }}
              onSubmit={(e) => {
                e.preventDefault();
                void save(editing);
              }}
            >
              <Field label="Nome">
                <input className="input" value={editing.name} maxLength={40} required onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <ColorPicker value={editing.color} onChange={(color) => setEditing({ ...editing, color })} />
              <SheetActions saving={false} onDelete={() => remove(c)} />
            </form>
          ) : (
            <div key={c.id} className="item">
              <Tag color={c.color}>{c.name}</Tag>
              <span style={{ flex: 1 }} />
              <button type="button" className="icon-btn" aria-label={`Editar categoria ${c.name}`} onClick={() => setEditing(c)}>
                <Icon name="edit" size={18} />
              </button>
            </div>
          ),
        )}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
