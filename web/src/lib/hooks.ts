import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export interface Resource<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (fn: (prev: T | undefined) => T | undefined) => void;
}

/** Busca um recurso da API e permite recarregar ou atualizar localmente (otimista). */
export function useApi<T>(path: string | null): Resource<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const current = useRef(path);
  current.current = path;

  const load = useCallback(async () => {
    if (path === null) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api<T>(path);
      if (current.current === path) setDataState(result);
    } catch (err) {
      if (current.current === path) setError(err as Error);
    } finally {
      if (current.current === path) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const setData = useCallback((fn: (prev: T | undefined) => T | undefined) => setDataState(fn), []);
  return { data, error, loading, reload: load, setData };
}

/** Estado persistido em localStorage (preferências locais, como esconder valores). */
export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* armazenamento indisponível */
      }
    },
    [key],
  );
  return [value, set];
}

/** Data de hoje em SP, atualizada quando o dia vira (verifica a cada minuto). */
export function useToday(getToday: () => string): string {
  const [today, setToday] = useState(getToday);
  useEffect(() => {
    const id = setInterval(() => setToday(getToday()), 60_000);
    return () => clearInterval(id);
  }, [getToday]);
  return today;
}
