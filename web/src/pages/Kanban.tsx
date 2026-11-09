import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { COLOR_STYLES, KANBAN_COLUMNS, type Board, type Card, type CardInput, type ColorName } from '@gabi/shared';
import { del, errorMessage, patch, post, put } from '../lib/api';
import { relativeDate, todaySP } from '../lib/date';
import { useApi, useLocalState } from '../lib/hooks';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { ColorPicker, Empty, ErrorState, Field, Loading, SheetActions, toast } from '../components/ui';

const COL_STYLE = [
  { bg: '#FBE9EF', dot: '#C2336A' },
  { bg: '#F1EAFB', dot: '#6B44B0' },
  { bg: '#E6F4ED', dot: '#2E8A60' },
];

/** Alvo sob o dedo/ponteiro (cartão tem prioridade sobre a coluna); no teclado, sobreposição de retângulos. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const pool = hits.length ? hits : rectIntersection(args);
  const card = pool.find((h) => String(h.id).startsWith('card-') && h.id !== args.active.id);
  return card ? [card] : pool.filter((h) => String(h.id).startsWith('col-')).slice(0, 1);
};

/** Aplica um movimento localmente (mesma regra do backend) para resposta imediata. */
function applyMove(cards: Card[], id: number, column: number, index: number): Card[] {
  const moving = cards.find((c) => c.id === id);
  if (!moving) return cards;
  const others = cards.filter((c) => c.id !== id);
  const target = others.filter((c) => c.column === column).sort((a, b) => a.position - b.position);
  target.splice(Math.min(index, target.length), 0, { ...moving, column });
  const reindexed = new Map(target.map((c, i) => [c.id, { ...c, position: i }]));
  const source = others.filter((c) => c.column === moving.column && c.column !== column).sort((a, b) => a.position - b.position);
  source.forEach((c, i) => reindexed.set(c.id, { ...c, position: i }));
  return [...others.filter((c) => !reindexed.has(c.id)), ...reindexed.values()];
}

export function KanbanPage() {
  const boards = useApi<Board[]>('/boards');
  const [boardId, setBoardId] = useLocalState<number | null>('gabi:board', null);
  const board = boards.data?.find((b) => b.id === boardId) ?? boards.data?.[0] ?? null;
  const cards = useApi<Card[]>(board ? `/cards?boardId=${board.id}` : null);
  const [editing, setEditing] = useState<Card | { column: number } | null>(null);
  const [boardSheet, setBoardSheet] = useState<Board | 'new' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // No toque, segurar 200 ms inicia o arraste (assim a rolagem continua funcionando).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const list = cards.data ?? [];
  const columns = KANBAN_COLUMNS.map((name, i) => ({
    name,
    index: i,
    cards: list.filter((c) => c.column === i).sort((a, b) => a.position - b.position),
  }));

  const move = async (id: number, column: number, index: number) => {
    const before = cards.data;
    cards.setData((l) => (l ? applyMove(l, id, column, index) : l));
    try {
      await post(`/cards/${id}/move`, { column, index });
    } catch (err) {
      cards.setData(() => before);
      toast(errorMessage(err));
    }
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(String(e.active.id).slice(5)));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = Number(String(e.active.id).slice(5));
    const overId = String(e.over.id);
    const card = list.find((c) => c.id === id);
    if (!card) return;
    let column: number;
    let index: number;
    if (overId.startsWith('col-')) {
      column = Number(overId.slice(4));
      index = columns[column]!.cards.filter((c) => c.id !== id).length;
    } else {
      const target = list.find((c) => c.id === Number(overId.slice(5)));
      if (!target || target.id === id) return;
      column = target.column;
      const colCards = columns[column]!.cards.filter((c) => c.id !== id);
      index = colCards.findIndex((c) => c.id === target.id);
    }
    const current = columns[card.column]!.cards.findIndex((c) => c.id === id);
    if (column === card.column && index === current) return;
    void move(id, column, index);
  };

  const activeCard = activeId ? list.find((c) => c.id === activeId) : undefined;

  return (
    <div className="page">
      <header className="page-header align-end">
        <div className="stack-4">
          <p className="eyebrow">Projeto</p>
          <h1 className="h1">Kanban</h1>
        </div>
        {board && (
          <BoardMenu
            open={menuOpen}
            setOpen={setMenuOpen}
            boards={boards.data ?? []}
            current={board}
            onPick={(b) => setBoardId(b.id)}
            onNew={() => setBoardSheet('new')}
            onRename={() => setBoardSheet(board)}
          />
        )}
      </header>

      {boards.loading && !boards.data ? (
        <Loading rows={3} height={120} />
      ) : boards.error ? (
        <ErrorState error={boards.error} onRetry={() => void boards.reload()} />
      ) : !board ? (
        <Empty
          icon="kanban"
          title="Nenhum quadro"
          text="Crie um quadro para organizar um projeto."
          action={
            <button type="button" className="btn" onClick={() => setBoardSheet('new')}>
              <Icon name="plus" size={18} /> Novo quadro
            </button>
          }
        />
      ) : cards.error ? (
        <ErrorState error={cards.error} onRetry={() => void cards.reload()} />
      ) : cards.loading && !cards.data ? (
        <Loading rows={3} height={120} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="board">
            {columns.map((col) => (
              <Column key={col.index} index={col.index} name={col.name} count={col.cards.length} onAdd={() => setEditing({ column: col.index })}>
                {col.cards.length === 0 && (
                  <p className="muted" style={{ fontSize: 14, textAlign: 'center', padding: '12px 0' }}>
                    Arraste cartões para cá
                  </p>
                )}
                {col.cards.map((c) => (
                  <KanbanCard key={c.id} card={c} dragging={activeId === c.id} onEdit={() => setEditing(c)} onNext={() => void move(c.id, c.column + 1, Number.MAX_SAFE_INTEGER)} />
                ))}
              </Column>
            ))}
          </div>
          <DragOverlay>{activeCard ? <CardBody card={activeCard} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      {editing && board && (
        <CardSheet
          card={'id' in editing ? editing : null}
          boardId={board.id}
          column={'id' in editing ? editing.column : editing.column}
          onClose={() => setEditing(null)}
          onSaved={(c, isNew) => {
            cards.setData((l) => (isNew ? [...(l ?? []), c] : l?.map((x) => (x.id === c.id ? c : x))));
            setEditing(null);
          }}
          onDeleted={(id) => {
            cards.setData((l) => l?.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
      {boardSheet && (
        <BoardSheet
          board={boardSheet === 'new' ? null : boardSheet}
          onClose={() => setBoardSheet(null)}
          onSaved={(b, isNew) => {
            boards.setData((l) => (isNew ? [...(l ?? []), b] : l?.map((x) => (x.id === b.id ? b : x))));
            setBoardId(b.id);
            setBoardSheet(null);
          }}
          onDeleted={(id) => {
            boards.setData((l) => l?.filter((x) => x.id !== id));
            setBoardId(null);
            setBoardSheet(null);
          }}
        />
      )}
    </div>
  );
}

function BoardMenu({
  open,
  setOpen,
  boards,
  current,
  onPick,
  onNew,
  onRename,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  boards: Board[];
  current: Board;
  onPick: (b: Board) => void;
  onNew: () => void;
  onRename: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open, setOpen]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ minHeight: 44 }}>
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.name}</span>
        <Icon name="chevronDown" size={16} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {boards.map((b) => (
            <button key={b.id} type="button" role="menuitemradio" aria-checked={b.id === current.id} aria-current={b.id === current.id} onClick={pick(() => onPick(b))}>
              {b.id === current.id ? <Icon name="check" size={16} strokeWidth={3} /> : <span style={{ width: 16 }} />}
              {b.name}
            </button>
          ))}
          <hr />
          <button type="button" role="menuitem" onClick={pick(onNew)}>
            <Icon name="plus" size={16} /> Novo quadro
          </button>
          <button type="button" role="menuitem" onClick={pick(onRename)}>
            <Icon name="edit" size={16} /> Renomear ou excluir
          </button>
        </div>
      )}
    </div>
  );
}

function Column({ index, name, count, onAdd, children }: { index: number; name: string; count: number; onAdd: () => void; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${index}` });
  return (
    <section ref={setNodeRef} className={`column${isOver ? ' over' : ''}`} style={{ background: COL_STYLE[index]!.bg }} aria-label={`${name}, ${count} cartões`}>
      <div className="row-between" style={{ padding: '2px 4px' }}>
        <div className="row">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: COL_STYLE[index]!.dot }} />
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{name}</h2>
        </div>
        <span style={{ minWidth: 26, height: 26, borderRadius: 13, background: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
      </div>
      {children}
      <button type="button" className="add-card" onClick={onAdd}>
        + Adicionar cartão
      </button>
    </section>
  );
}

function CardBody({
  card,
  overlay,
  onEdit,
  onNext,
  handle,
}: {
  card: Card;
  overlay?: boolean;
  onEdit?: () => void;
  onNext?: () => void;
  handle?: ReactNode;
}) {
  const s = COLOR_STYLES[card.color];
  const isDone = card.column === 2;
  const late = !isDone && card.dueDate && card.dueDate < todaySP();
  return (
    <>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        {card.tag ? (
          <span className="tag" style={{ padding: '3px 10px', background: s.bg, color: s.fg }}>
            {card.tag}
          </span>
        ) : (
          <span style={{ width: 12, height: 12, borderRadius: 6, background: s.fg, marginTop: 4 }} aria-hidden="true" />
        )}
        {handle}
      </div>
      <button type="button" className="kcard-title" onClick={onEdit} tabIndex={overlay ? -1 : 0} aria-label={`Editar ${card.title}`}>
        {card.title}
      </button>
      <div className="row-between">
        <div className="row" style={{ gap: 5, fontSize: 13, color: late ? 'var(--danger)' : 'var(--ink-2)', fontWeight: late ? 700 : 400 }}>
          {card.dueDate && (
            <>
              <Icon name="calendar" size={14} strokeWidth={2.2} />
              <span>{relativeDate(card.dueDate)}</span>
            </>
          )}
        </div>
        {isDone ? (
          <span className="row" style={{ gap: 4, fontSize: 12, fontWeight: 800, color: 'var(--ok)', minHeight: 44 }}>
            <Icon name="check" size={14} strokeWidth={3} /> Feito
          </span>
        ) : (
          <button type="button" className="move-btn" onClick={onNext} tabIndex={overlay ? -1 : 0} aria-label={`Mover ${card.title} para ${KANBAN_COLUMNS[card.column + 1]}`}>
            {KANBAN_COLUMNS[card.column + 1]}
            <Icon name="arrowRight" size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </>
  );
}

function KanbanCard({ card, dragging, onEdit, onNext }: { card: Card; dragging: boolean; onEdit: () => void; onNext: () => void }) {
  const drag = useDraggable({ id: `card-${card.id}` });
  const drop = useDroppable({ id: `card-${card.id}` });
  return (
    <article
      ref={(n) => {
        drag.setNodeRef(n);
        drop.setNodeRef(n);
      }}
      className={`kcard${dragging ? ' dragging' : ''}${drop.isOver && !dragging ? ' drop-target' : ''}`}
    >
      <CardBody
        card={card}
        onEdit={onEdit}
        onNext={onNext}
        handle={
          <button type="button" className="drag-handle" aria-label={`Arrastar ${card.title}`} {...drag.listeners} {...drag.attributes}>
            <Icon name="grip" size={20} strokeWidth={2.5} />
          </button>
        }
      />
    </article>
  );
}

function CardSheet({
  card,
  boardId,
  column,
  onClose,
  onSaved,
  onDeleted,
}: {
  card: Card | null;
  boardId: number;
  column: number;
  onClose: () => void;
  onSaved: (c: Card, isNew: boolean) => void;
  onDeleted: (id: number) => void;
}) {
  const [title, setTitle] = useState(card?.title ?? '');
  const [tag, setTag] = useState(card?.tag ?? '');
  const [color, setColor] = useState<ColorName>(card?.color ?? 'rosa');
  const [dueDate, setDueDate] = useState(card?.dueDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (card) {
        onSaved(await patch<Card>(`/cards/${card.id}`, { title, tag, color, dueDate: dueDate || null }), false);
      } else {
        const body: CardInput = { boardId, column, title, tag, color, dueDate: dueDate || null };
        onSaved(await post<Card>('/cards', body), true);
      }
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!card) return;
    setSaving(true);
    try {
      await del(`/cards/${card.id}`);
      onDeleted(card.id);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet title={card ? 'Editar cartão' : `Novo cartão · ${KANBAN_COLUMNS[column]}`} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <Field label="Título">
          <textarea className="input" style={{ minHeight: 72 }} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </Field>
        <div className="grid-2">
          <Field label="Etiqueta">
            <input className="input" value={tag} onChange={(e) => setTag(e.target.value)} maxLength={30} placeholder="Ex.: Compras" />
          </Field>
          <Field label="Prazo">
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <ColorPicker value={color} onChange={setColor} label="Cor da etiqueta" />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <SheetActions saving={saving} onDelete={card ? remove : undefined} />
      </form>
    </Sheet>
  );
}

function BoardSheet({
  board,
  onClose,
  onSaved,
  onDeleted,
}: {
  board: Board | null;
  onClose: () => void;
  onSaved: (b: Board, isNew: boolean) => void;
  onDeleted: (id: number) => void;
}) {
  const [name, setName] = useState(board?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      onSaved(board ? await put<Board>(`/boards/${board.id}`, { name }) : await post<Board>('/boards', { name }), !board);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!board) return;
    setSaving(true);
    try {
      await del(`/boards/${board.id}`);
      onDeleted(board.id);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };
  return (
    <Sheet title={board ? 'Quadro' : 'Novo quadro'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <Field label="Nome do quadro">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
        </Field>
        {board && <p className="muted" style={{ fontSize: 14 }}>Excluir o quadro apaga todos os cartões dele.</p>}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <SheetActions saving={saving} onDelete={board ? remove : undefined} />
      </form>
    </Sheet>
  );
}
