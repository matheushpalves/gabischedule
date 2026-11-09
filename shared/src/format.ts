import type { ColorName, Repeat } from './schemas';

export const TIME_ZONE = 'America/Sao_Paulo';

export const COLOR_STYLES: Record<ColorName, { bg: string; fg: string; label: string }> = {
  rosa: { bg: '#FBE3EC', fg: '#8E1F4C', label: 'Rosa' },
  lilas: { bg: '#ECE4FA', fg: '#4F2C8A', label: 'Lilás' },
  verde: { bg: '#DFF3EA', fg: '#1F6B4A', label: 'Verde' },
  pessego: { bg: '#FDECD9', fg: '#8A4A12', label: 'Pêssego' },
  azul: { bg: '#E3EEF9', fg: '#1F4E7A', label: 'Azul' },
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
