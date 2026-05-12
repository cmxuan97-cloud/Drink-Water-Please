import { Container, DEFAULT_CONTAINERS, DEFAULT_SETTINGS, Entry, Settings } from '../types';

const K_SETTINGS = 'dw:settings';
const K_CONTAINERS = 'dw:containers';
const K_ENTRY_PREFIX = 'dw:entries:';
const K_COMPLETED = 'dw:completedDays';
const K_COMPANION = 'dw:companionId';
const K_CLIENT_ID = 'dw:clientId';

const todayKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const getSettings = (): Settings => {
  return { ...DEFAULT_SETTINGS, ...safeParse<Partial<Settings>>(localStorage.getItem(K_SETTINGS), {}) };
};

export const saveSettings = (s: Settings): void => {
  localStorage.setItem(K_SETTINGS, JSON.stringify(s));
};

export const getContainers = (): Container[] => {
  const list = safeParse<Container[] | null>(localStorage.getItem(K_CONTAINERS), null);
  if (!list) {
    saveContainers(DEFAULT_CONTAINERS);
    return DEFAULT_CONTAINERS;
  }
  return list;
};

export const saveContainers = (cs: Container[]): void => {
  localStorage.setItem(K_CONTAINERS, JSON.stringify(cs));
};

export const getEntries = (date = new Date()): Entry[] => {
  return safeParse<Entry[]>(localStorage.getItem(K_ENTRY_PREFIX + todayKey(date)), []);
};

export const saveEntries = (entries: Entry[], date = new Date()): void => {
  localStorage.setItem(K_ENTRY_PREFIX + todayKey(date), JSON.stringify(entries));
};

export const addEntry = (entry: Entry, date = new Date()): Entry[] => {
  const list = getEntries(date);
  const next = [entry, ...list];
  saveEntries(next, date);
  return next;
};

export const deleteEntry = (id: string, date = new Date()): Entry[] => {
  const list = getEntries(date).filter((e) => e.id !== id);
  saveEntries(list, date);
  return list;
};

export const newId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const getOrCreateClientId = (): string => {
  let id = localStorage.getItem(K_CLIENT_ID);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    localStorage.setItem(K_CLIENT_ID, id);
  }
  return id;
};

export const getCompletedDays = (): string[] => {
  return safeParse<string[]>(localStorage.getItem(K_COMPLETED), []);
};

export const getCompanionId = (): string | null => {
  return localStorage.getItem(K_COMPANION);
};

export const setCompanionId = (id: string): void => {
  localStorage.setItem(K_COMPANION, id);
};

export const markDayCompleted = (date = new Date()): { added: boolean; days: string[] } => {
  const days = new Set(getCompletedDays());
  const key = todayKey(date);
  const added = !days.has(key);
  if (added) {
    days.add(key);
    const arr = Array.from(days).sort();
    localStorage.setItem(K_COMPLETED, JSON.stringify(arr));
    return { added, days: arr };
  }
  return { added, days: Array.from(days).sort() };
};

export const pruneOldPhotos = (keepDays = 30): void => {
  const cutoff = Date.now() - keepDays * 24 * 3600 * 1000;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(K_ENTRY_PREFIX)) continue;
    const datePart = k.slice(K_ENTRY_PREFIX.length);
    const t = new Date(datePart).getTime();
    if (Number.isFinite(t) && t < cutoff) {
      const entries = safeParse<Entry[]>(localStorage.getItem(k), []);
      const stripped = entries.map((e) => ({ ...e, photoDataUrl: undefined }));
      localStorage.setItem(k, JSON.stringify(stripped));
    }
  }
};
