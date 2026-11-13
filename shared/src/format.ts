import type { ColorName, EventRepeat, Repeat } from './schemas';

export const TIME_ZONE = 'America/Sao_Paulo';

/** Cores das etiquetas: variáveis CSS do tema ativo (o nome visível vem de `theme.tagLabels`). */
export const COLOR_STYLES: Record<ColorName, { bg: string; fg: string; label: string }> = {
  rosa: { bg: 'var(--tag-rosa-bg)', fg: 'var(--tag-rosa-fg)', label: 'Rosa' },
  lilas: { bg: 'var(--tag-lilas-bg)', fg: 'var(--tag-lilas-fg)', label: 'Lilás' },
  verde: { bg: 'var(--tag-verde-bg)', fg: 'var(--tag-verde-fg)', label: 'Verde' },
  pessego: { bg: 'var(--tag-pessego-bg)', fg: 'var(--tag-pessego-fg)', label: 'Pêssego' },
  azul: { bg: 'var(--tag-azul-bg)', fg: 'var(--tag-azul-fg)', label: 'Azul' },
};

export const REPEAT_LABELS: Record<Repeat, string> = {
  once: 'Uma vez',
  daily: 'Todo dia',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
  yearly: 'Todo ano',
  hourly: 'A cada N horas',
};

export function repeatLabel(repeat: Repeat, intervalHours: number | null): string {
  if (repeat === 'hourly') {
    const n = intervalHours ?? 1;
    return n === 1 ? 'A cada hora' : `A cada ${n} horas`;
  }
  return REPEAT_LABELS[repeat];
}

/** Formata centavos em BRL: 123456 → "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cts = (abs % 100).toString().padStart(2, '0');
  return `${neg ? '−' : ''}R$ ${reais},${cts}`;
}

/** Converte texto digitado ("1.234,56", "12,5", "30") em centavos. Retorna null se inválido. */
export function parseBRL(text: string): number | null {
  const clean = text.replace(/R\$|\s/g, '');
  if (!/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(clean)) return null;
  const [int, dec = ''] = clean.replace(/\./g, '').split(',');
  return Number(int) * 100 + Number(dec.padEnd(2, '0'));
}

/** Centavos → texto editável ("1234,56"). */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)},${(cents % 100).toString().padStart(2, '0')}`;
}

export const EVENT_REPEAT_LABELS: Record<EventRepeat, string> = {
  once: 'Não repete',
  daily: 'Todo dia',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
  yearly: 'Todo ano',
};

/** Antecedência em texto curto: 5 → "5 min", 60 → "1 hora", 1440 → "1 dia". */
export function leadShort(minutes: number): string {
  if (minutes % 1440 === 0) return minutes === 1440 ? '1 dia' : `${minutes / 1440} dias`;
  if (minutes % 60 === 0) return minutes === 60 ? '1 hora' : `${minutes / 60} horas`;
  return `${minutes} min`;
}

/** Texto de uma opção: 0 → "Na hora", 15 → "15 min antes". */
export function notifyLabel(minutes: number): string {
  return minutes === 0 ? 'Na hora' : `${leadShort(minutes)} antes`;
}

/** Resumo de várias notificações: [1440, 60] → "1 dia e 1 hora antes"; [60, 0] → "1 hora antes e na hora". */
export function notifyListLabel(list: number[]): string {
  if (list.length === 0) return 'Sem notificação';
  const before = [...list].filter((m) => m > 0).sort((a, b) => b - a).map(leadShort);
  const joined = before.length > 1 ? `${before.slice(0, -1).join(', ')} e ${before[before.length - 1]}` : (before[0] ?? '');
  const text = before.length ? `${joined} antes` : '';
  if (!list.includes(0)) return text;
  return text ? `${text} e na hora` : 'Na hora';
}
