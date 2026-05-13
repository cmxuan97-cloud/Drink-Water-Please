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

export const getHourlyForDate = (date: Date): { hour: number; ml: number }[] => {
  const key = `dw:entries:${dateKey(date)}`;
  const entries = safeParse<Entry[]>(localStorage.getItem(key), []);
  const hourly: number[] = new Array(24).fill(0);
  for (const e of entries) {
    const h = new Date(e.ts).getHours();
    hourly[h] += e.ml;
  }
  return hourly.map((ml, hour) => ({ hour, ml }));
};

export const getTodayHourly = (): { hour: number; ml: number }[] => getHourlyForDate(new Date());

/** 当前周的 7 天 (周日开头) — 用于横向选择条 */
export const getCurrentWeekDates = (): Date[] => {
  const today = new Date();
  const dow = today.getDay(); // 0=日
  const start = new Date(today);
  start.setDate(today.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const toDateKey = dateKey;

export type Summary = {
  totalMl: number;
  daysHit: number;     // 达标天数
  daysTotal: number;
  daysWithRecord: number;
  avgPerDay: number;
  bestDay: { date: string; ml: number } | null;
  currentStreak: number;     // 从最近一天往回数的连续达标天
  longestStreak: number;     // 整段时间内最长连击
};

export const summarize = (stats: DayStat[], goalMl: number): Summary => {
  const totalMl = stats.reduce((s, d) => s + d.drunkMl, 0);
  const isHit = (d: DayStat): boolean => d.drunkMl >= goalMl && d.drunkMl > 0;
  const daysHit = stats.filter(isHit).length;
  const daysWithRecord = stats.filter((d) => d.drunkMl > 0).length;
  const avgPerDay = daysWithRecord > 0 ? Math.round(totalMl / daysWithRecord) : 0;
  let best: { date: string; ml: number } | null = null;
  for (const d of stats) {
    if (!best || d.drunkMl > best.ml) best = { date: d.date, ml: d.drunkMl };
  }
  if (best && best.ml === 0) best = null;

  // 当前连击：从最后一天往回数
  let currentStreak = 0;
  for (let i = stats.length - 1; i >= 0; i--) {
    if (isHit(stats[i])) currentStreak++;
    else break;
  }
  // 最长连击
  let longestStreak = 0;
  let run = 0;
  for (const d of stats) {
    if (isHit(d)) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  return {
    totalMl,
    daysHit,
    daysTotal: stats.length,
    daysWithRecord,
    avgPerDay,
    bestDay: best,
    currentStreak,
    longestStreak,
  };
};

/** 拿前一段同长度的 stats 用作环比 */
export const getPreviousPeriodStats = (days: number, endDate = new Date()): DayStat[] => {
  const end = new Date(endDate);
  end.setDate(end.getDate() - days);
  return getDayStats(days, end);
};

/** 拿当月所有日期（1 号到月末） */
export const getCurrentMonthDates = (today = new Date()): Date[] => {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1));
};

/** 拿当月所有日期的 stats（按日期 key 索引） */
export const getCurrentMonthStats = (today = new Date()): Map<string, number> => {
  const dates = getCurrentMonthDates(today);
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = `dw:entries:${dateKey(d)}`;
    const entries = safeParse<Entry[]>(localStorage.getItem(key), []);
    map.set(dateKey(d), entries.reduce((s, e) => s + e.ml, 0));
  }
  return map;
};

/** 格式化日期为「周一」「3/12」这种短形式 */
export const shortDate = (dateStr: string, mode: 'weekday' | 'mmdd'): string => {
  const d = new Date(dateStr);
  if (mode === 'weekday') {
    return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
