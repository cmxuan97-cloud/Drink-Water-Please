// 计算「可被好友看见」的公开 profile 摘要。
// 只包含粗粒度信息：今日 % 进度、解锁动物数、连续达标天数、当前 companion。
// 不包含：具体 ml、饮水时间、容器、照片等细节。

import { ANIMALS } from '../data/animals';
import {
  getCompanionId,
  getCompletedDays,
  getEntries,
  getOrCreateClientId,
  getSettings,
  getUnlockedIds,
} from './storage';
import { calcProgress, dailyGoalMl } from './goal';
import { getCurrentDisplayName, getCurrentUsername } from './auth';

const todayKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** 从 completedDays 算当前连续达标天数（今天/昨天达标都算 streak 起点） */
export const currentStreak = (completedDays: string[]): number => {
  if (completedDays.length === 0) return 0;
  const done = new Set(completedDays);
  // streak 必须从「今天」或「昨天」开始算 — 否则就断了
  let cursor = new Date();
  if (!done.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!done.has(todayKey(cursor))) return 0;
  }
  let count = 0;
  while (done.has(todayKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
};

/** 历史最长连续 streak — 排序后扫一遍找最长连续段 */
export const peakStreak = (completedDays: string[]): number => {
  if (completedDays.length === 0) return 0;
  const sorted = [...completedDays].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
};

export type PublicProfile = {
  username: string;
  displayName: string;
  companionId?: string;
  charId?: string;
  todayPctGoal: number;       // 0..100 (int)
  todayDrunkMl: number;       // 今日已喝 ml
  unlockedCount: number;
  unlockedIds: string[];      // 用于让好友看见你家公园里有谁（访客端会被 server 抹掉）
  totalCompletedDays: number;
  currentStreak: number;
  peakStreak: number;         // 历史最长连续 streak
  updatedAt: number;
};

/** 计算当前 profile 摘要（如果未注册账号返回 null） */
export const buildPublicProfile = (): PublicProfile | null => {
  const username = getCurrentUsername();
  if (!username) return null;
  const displayName = getCurrentDisplayName() ?? username;

  const settings = getSettings();
  const entries = getEntries();
  const goalMl = dailyGoalMl(settings.weightKg, settings.mlPerKg);
  const progress = calcProgress(entries, goalMl);
  const pct = Math.round(Math.min(1, progress.pct) * 100);

  const companionId = getCompanionId() ?? undefined;
  const animal = companionId ? ANIMALS.find(a => a.id === companionId) : undefined;
  const charId = animal?.customArt;

  const unlocked = getUnlockedIds('a-kiwi');
  const completed = getCompletedDays();

  return {
    username,
    displayName,
    companionId,
    charId,
    todayPctGoal: pct,
    todayDrunkMl: progress.drunkMl,
    unlockedCount: unlocked.length,
    unlockedIds: unlocked,
    totalCompletedDays: completed.length,
    currentStreak: currentStreak(completed),
    peakStreak: peakStreak(completed),
    updatedAt: Date.now(),
  };
};

/** 异步把 profile 推到服务端（社交可见用）。失败静默。 */
export const syncProfile = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  const profile = buildPublicProfile();
  if (!profile) return; // 未登录
  const clientId = getOrCreateClientId();
  try {
    await fetch('/api/social/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, profile }),
    });
  } catch {
    // 静默 — 下次 sync 会重试
  }
};
