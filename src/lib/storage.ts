import { Container, DEFAULT_CONTAINERS, DEFAULT_SETTINGS, Entry, Settings } from '../types';

// 注意：sync.ts 也 import 这个文件 (getOrCreateClientId)，所以这里用 lazy import
// 避免 ESM 循环 import 的尴尬。triggerSync 只在浏览器环境会真的跑。
const triggerSync = (): void => {
  if (typeof window === 'undefined') return;
  // 异步 import 让循环引用不会卡住模块加载
  void import('./sync').then(({ triggerSync: t }) => t()).catch(() => {});
};

const K_SETTINGS = 'dw:settings';
const K_CONTAINERS = 'dw:containers';
const K_ENTRY_PREFIX = 'dw:entries:';
const K_COMPLETED = 'dw:completedDays';
const K_COMPANION = 'dw:companionId';
const K_CLIENT_ID = 'dw:clientId';
const K_USER_NAME = 'dw:userName';
const K_UNLOCKED_IDS = 'dw:unlockedIds';
const K_SEEN_TOKENS = 'dw:seenEarnedTokens';

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
  triggerSync();
};

// 老 default 值 → 新 default 值的迁移表。只在用户没自己改过的情况下更新。
const CAPACITY_MIGRATIONS: Array<{ id: string; oldCap: number; newCap: number }> = [
  { id: 'c-glass', oldCap: 250, newCap: 300 },
  { id: 'c-mug', oldCap: 350, newCap: 300 },
];

export const getContainers = (): Container[] => {
  const list = safeParse<Container[] | null>(localStorage.getItem(K_CONTAINERS), null);
  if (!list) {
    saveContainers(DEFAULT_CONTAINERS);
    return DEFAULT_CONTAINERS;
  }
  let changed = false;
  // 迁移 1：自动补上用户没有的默认容器（新加的 ID）
  const existingIds = new Set(list.map((c) => c.id));
  const missing = DEFAULT_CONTAINERS.filter((c) => !existingIds.has(c.id));
  let merged: Container[] = [...list, ...missing];
  if (missing.length > 0) changed = true;
  // 迁移 2：把仍是旧 default 的容量更新到新 default（用户自己改过的不动）
  merged = merged.map((c) => {
    const m = CAPACITY_MIGRATIONS.find((x) => x.id === c.id && c.capacityMl === x.oldCap);
    if (m) {
      changed = true;
      return { ...c, capacityMl: m.newCap };
    }
    return c;
  });
  // 迁移 3：给玻璃杯补上 maxCapacityMl（AI 测百分比用满杯容量 320ml）
  merged = merged.map((c) => {
    if (c.id === 'c-glass' && c.capacityMl === 300 && c.maxCapacityMl === undefined) {
      changed = true;
      return { ...c, maxCapacityMl: 320 };
    }
    return c;
  });
  if (changed) {
    saveContainers(merged);
    return merged;
  }
  return list;
};

export const saveContainers = (cs: Container[]): void => {
  localStorage.setItem(K_CONTAINERS, JSON.stringify(cs));
  triggerSync();
};

export const getEntries = (date = new Date()): Entry[] => {
  return safeParse<Entry[]>(localStorage.getItem(K_ENTRY_PREFIX + todayKey(date)), []);
};

export const saveEntries = (entries: Entry[], date = new Date()): void => {
  localStorage.setItem(K_ENTRY_PREFIX + todayKey(date), JSON.stringify(entries));
  triggerSync();
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

export const getUserName = (): string | null => {
  return localStorage.getItem(K_USER_NAME);
};

export const setUserName = (name: string): void => {
  localStorage.setItem(K_USER_NAME, name.trim());
  triggerSync();
};

/**
 * 已解锁动物的 ID 集合。第一个 ID 默认是 a-kiwi（起始角色）。
 * 后续每次得到解锁机会，用户可以选择一只新动物加入。
 */
export const getUnlockedIds = (defaultStarterId: string): string[] => {
  const raw = localStorage.getItem(K_UNLOCKED_IDS);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.every((s) => typeof s === 'string')) return arr;
    } catch { /* fallthrough */ }
  }
  // 首次：只解锁起始角色
  const init = [defaultStarterId];
  localStorage.setItem(K_UNLOCKED_IDS, JSON.stringify(init));
  return init;
};

export const addUnlockedId = (id: string, defaultStarterId: string): string[] => {
  const cur = getUnlockedIds(defaultStarterId);
  if (cur.includes(id)) return cur;
  const next = [...cur, id];
  localStorage.setItem(K_UNLOCKED_IDS, JSON.stringify(next));
  triggerSync();
  return next;
};

/** 旧用户迁移：如果用户有 completedDays 但没 K_UNLOCKED_IDS，
 *  按旧的「前 N 只自动解锁」逻辑生成一份初始列表，避免回退。 */
export const ensureUnlockedMigration = (
  completedDays: number,
  orderedIds: string[],
): string[] => {
  if (localStorage.getItem(K_UNLOCKED_IDS)) {
    return JSON.parse(localStorage.getItem(K_UNLOCKED_IDS)!) as string[];
  }
  // 旧公式：1 (starter) + floor(days/2)
  const n = Math.min(orderedIds.length, 1 + Math.floor(completedDays / 2));
  const migrated = orderedIds.slice(0, n);
  localStorage.setItem(K_UNLOCKED_IDS, JSON.stringify(migrated));
  return migrated;
};

export const getCompletedDays = (): string[] => {
  return safeParse<string[]>(localStorage.getItem(K_COMPLETED), []);
};

// 新用户首次读取时自动设为 starter (奇异鸟)，保证 profile 有 companionId
// 这样朋友看到的头像就是奇异鸟而不是 "?"
const DEFAULT_COMPANION_ID = 'a-kiwi';
export const getCompanionId = (): string => {
  const v = localStorage.getItem(K_COMPANION);
  if (v) return v;
  localStorage.setItem(K_COMPANION, DEFAULT_COMPANION_ID);
  return DEFAULT_COMPANION_ID;
};

export const setCompanionId = (id: string): void => {
  localStorage.setItem(K_COMPANION, id);
  triggerSync();
};

export const markDayCompleted = (date = new Date()): { added: boolean; days: string[] } => {
  const days = new Set(getCompletedDays());
  const key = todayKey(date);
  const added = !days.has(key);
  if (added) {
    days.add(key);
    const arr = Array.from(days).sort();
    localStorage.setItem(K_COMPLETED, JSON.stringify(arr));
    triggerSync();
    return { added, days: arr };
  }
  return { added, days: Array.from(days).sort() };
};

// 用户最后一次「看过」的累计钥匙数 — 当 earnedTokens > 这个值时，进入主页弹通知
export const getSeenEarnedTokens = (): number => {
  const raw = localStorage.getItem(K_SEEN_TOKENS);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

export const setSeenEarnedTokens = (n: number): void => {
  localStorage.setItem(K_SEEN_TOKENS, String(Math.max(0, Math.floor(n))));
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
