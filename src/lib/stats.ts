import { Entry } from '../types';

export type DayStat = {
  date: string;        // YYYY-MM-DD
  drunkMl: number;
  entries: Entry[];
};

const dateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

export const getDayStats = (days: number, endDate = new Date()): DayStat[] => {
  const results: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const key = `dw:entries:${dateKey(d)}`;
    const entries = safeParse<Entry[]>(localStorage.getItem(key), []);
    results.push({
      date: dateKey(d),
      drunkMl: entries.reduce((s, e) => s + e.ml, 0),
      entries,
    });
  }
  return results;
};

export const getTodayHourly = (): { hour: number; ml: number }[] => {
  const today = new Date();
  const key = `dw:entries:${dateKey(today)}`;
  const entries = safeParse<Entry[]>(localStorage.getItem(key), []);
  const hourly: number[] = new Array(24).fill(0);
  for (const e of entries) {
    const h = new Date(e.ts).getHours();
    hourly[h] += e.ml;
  }
  return hourly.map((ml, hour) => ({ hour, ml }));
};

export type Summary = {
  totalMl: number;
  daysHit: number;     // 达标天数
  daysTotal: number;
  avgPerDay: number;
  bestDay: { date: string; ml: number } | null;
};

export const summarize = (stats: DayStat[], goalMl: number): Summary => {
  const totalMl = stats.reduce((s, d) => s + d.drunkMl, 0);
  const daysHit = stats.filter((d) => d.drunkMl >= goalMl && d.drunkMl > 0).length;
  const daysWithRecord = stats.filter((d) => d.drunkMl > 0).length;
  const avgPerDay = daysWithRecord > 0 ? Math.round(totalMl / daysWithRecord) : 0;
  let best: { date: string; ml: number } | null = null;
  for (const d of stats) {
    if (!best || d.drunkMl > best.ml) best = { date: d.date, ml: d.drunkMl };
  }
  if (best && best.ml === 0) best = null;
  return { totalMl, daysHit, daysTotal: stats.length, avgPerDay, bestDay: best };
};

/** 格式化日期为「周一」「3/12」这种短形式 */
export const shortDate = (dateStr: string, mode: 'weekday' | 'mmdd'): string => {
  const d = new Date(dateStr);
  if (mode === 'weekday') {
    return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
