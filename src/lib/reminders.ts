import { pace } from './goal';

let timers: number[] = [];

const clearAll = () => {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
};

const showReminder = (title: string, body: string) => {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'drink-water' });
  } catch {
    // ignore
  }
};

export const requestPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return await Notification.requestPermission();
};

export const reschedule = (opts: {
  drunkMl: number;
  goalMl: number;
  wakeHour: number;
  sleepHour: number;
  enabled: boolean;
}): { count: number; intervalMin: number } => {
  clearAll();
  if (!opts.enabled || Notification.permission !== 'granted') {
    return { count: 0, intervalMin: 0 };
  }

  // 默认 60–90 min 区间：人在专注/空调环境下约 60–120 min 出现轻度脱水倾向，
  // 60–90 是兼顾「跟上节奏」与「不烦」的甜区。
  const { deficitMl, pace: p } = pace(opts.drunkMl, opts.goalMl, opts.wakeHour, opts.sleepHour);
  let intervalMin = 75;
  if (p === 'behind') intervalMin = 60;
  else if (p === 'ahead') intervalMin = 90;
  else intervalMin = 75;

  const now = new Date();
  const sleepTime = new Date(now);
  sleepTime.setHours(opts.sleepHour, 0, 0, 0);
  if (sleepTime.getTime() <= now.getTime()) {
    return { count: 0, intervalMin };
  }

  const remainingMinutes = (sleepTime.getTime() - now.getTime()) / 60000;
  const maxCount = Math.min(8, Math.floor(remainingMinutes / intervalMin));
  if (maxCount <= 0) return { count: 0, intervalMin };

  const remainingMl = Math.max(0, opts.goalMl - opts.drunkMl);
  const perReminderMl = maxCount > 0 ? Math.ceil(remainingMl / maxCount / 50) * 50 : 0;

  for (let i = 1; i <= maxCount; i++) {
    const delayMs = i * intervalMin * 60 * 1000;
    let title: string;
    let body: string;
    if (p === 'behind') {
      title = '💧 该喝水了';
      body = `进度落后约 ${Math.max(50, deficitMl)} ml，喝 ${perReminderMl} ml 跟上节奏`;
    } else if (p === 'ahead') {
      title = '🌊 水分充足';
      body = `节奏不错，再喝一杯保持`;
    } else {
      title = '💧 喝水时间';
      body = `还差 ${Math.max(0, opts.goalMl - opts.drunkMl)} ml，喝 ${perReminderMl} ml`;
    }
    const id = window.setTimeout(() => showReminder(title, body), delayMs);
    timers.push(id);
  }

  return { count: maxCount, intervalMin };
};

export const cancelAll = clearAll;
