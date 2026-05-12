import { Entry } from '../types';

export const dailyGoalMl = (weightKg: number, mlPerKg = 35): number =>
  Math.round(weightKg * mlPerKg);

export type Progress = {
  drunkMl: number;
  goalMl: number;
  remainingMl: number;
  pct: number;
  overflowMl: number;
};

export const calcProgress = (entries: Entry[], goalMl: number): Progress => {
  const drunkMl = entries.reduce((s, e) => s + e.ml, 0);
  const pct = goalMl > 0 ? drunkMl / goalMl : 0;
  return {
    drunkMl,
    goalMl,
    remainingMl: Math.max(0, goalMl - drunkMl),
    pct: Math.min(1.2, pct),
    overflowMl: Math.max(0, drunkMl - goalMl),
  };
};

export type Phase = 'leg' | 'belly' | 'chest' | 'neck' | 'done';

export const phaseFor = (pct: number): Phase => {
  if (pct >= 1) return 'done';
  if (pct >= 0.75) return 'neck';
  if (pct >= 0.5) return 'chest';
  if (pct >= 0.25) return 'belly';
  return 'leg';
};

export const phaseLabel = (phase: Phase, overflowMl: number): string => {
  switch (phase) {
    case 'leg': return '小爪子泡水里';
    case 'belly': return '肚皮半湿';
    case 'chest': return '快灌到胸口';
    case 'neck': return '小奇异鸟要被淹啦';
    case 'done': return overflowMl > 0 ? `🎉 喝饱啦，超出 ${overflowMl} ml` : '🎉 今天喝够啦';
  }
};

export type Pace = 'behind' | 'on-track' | 'ahead';

export const pace = (
  drunkMl: number,
  goalMl: number,
  wakeHour: number,
  sleepHour: number,
  now = new Date(),
): { idealMl: number; deficitMl: number; pace: Pace } => {
  const hour = now.getHours() + now.getMinutes() / 60;
  const awakeHours = Math.max(1, sleepHour - wakeHour);
  const elapsed = Math.max(0, Math.min(awakeHours, hour - wakeHour));
  const idealPct = elapsed / awakeHours;
  const idealMl = Math.round(goalMl * idealPct);
  const deficitMl = idealMl - drunkMl;
  const ratio = deficitMl / goalMl;
  let p: Pace = 'on-track';
  if (ratio > 0.25) p = 'behind';
  else if (ratio < -0.05) p = 'ahead';
  return { idealMl, deficitMl, pace: p };
};
