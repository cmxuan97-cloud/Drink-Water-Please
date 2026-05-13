// Admin 仪表盘聚合数据 — 一次 fetch 拿到所有摘要
import { checkAdminAuth, getRedis, scanAll, todayKey } from './_auth';

export const config = { runtime: 'edge' };

const DAY = 24 * 60 * 60 * 1000;

export default async function handler(req: Request): Promise<Response> {
  const auth = checkAdminAuth(req);
  if (!auth.ok) {
    return Response.json({ error: auth.reason }, { status: 401 });
  }
  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  // ===== 并行扫所有 namespace =====
  const [
    subsAll,
    subKeys,
    stateKeys,
    progressKeys,
    userKeys,
    aliasKeys,
  ] = await Promise.all([
    redis.smembers('subs:all') as Promise<string[]>,
    scanAll(redis, 'sub:*'),
    scanAll(redis, 'state:*'),
    scanAll(redis, 'progress:*'),
    scanAll(redis, 'user:*'),
    scanAll(redis, 'alias:*'),
  ]);

  // 24h 内活跃推送 / 进度
  const now = Date.now();
  const today = todayKey();
  let activePush24h = 0;
  let activePush1h = 0;
  let totalFailedAcks = 0;
  // 抽样最近一些 sub 看 lastAckAt / failedAcks（防止扫太多 hgetall 卡顿）
  const SAMPLE_SUB_LIMIT = 200;
  const sampleSubs = subKeys.slice(0, SAMPLE_SUB_LIMIT);
  await Promise.all(sampleSubs.map(async (k) => {
    try {
      const obj = await redis.hgetall(k) as Record<string, string> | null;
      if (!obj) return;
      const lastSentAt = Number(obj.lastSentAt) || 0;
      const lastAckAt = Number(obj.lastAckAt) || 0;
      const recent = Math.max(lastSentAt, lastAckAt);
      if (recent && now - recent < DAY) activePush24h++;
      if (recent && now - recent < 60 * 60 * 1000) activePush1h++;
      totalFailedAcks += Number(obj.failedAcks) || 0;
    } catch { /* skip */ }
  }));

  // 今日进度聚合
  let totalDrunkTodayMl = 0;
  let usersDrunkToday = 0;
  let goalHitToday = 0;
  const SAMPLE_PROG = Math.min(progressKeys.length, 500);
  await Promise.all(progressKeys.slice(0, SAMPLE_PROG).map(async (k) => {
    try {
      const obj = await redis.hgetall(k) as Record<string, string> | null;
      if (!obj) return;
      if (obj.date !== today) return;
      const drunk = Number(obj.drunkMl) || 0;
      const goal = Number(obj.goalMl) || 0;
      if (drunk > 0) {
        usersDrunkToday++;
        totalDrunkTodayMl += drunk;
        if (goal > 0 && drunk >= goal) goalHitToday++;
      }
    } catch { /* skip */ }
  }));

  // companion 分布
  const companionCounts: Record<string, number> = {};
  await Promise.all(sampleSubs.map(async (k) => {
    try {
      const obj = await redis.hgetall(k) as Record<string, string> | null;
      const id = obj?.companion || 'a-kiwi';
      companionCounts[id] = (companionCounts[id] || 0) + 1;
    } catch { /* skip */ }
  }));
  const topCompanions = Object.entries(companionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // mode 分布
  const modeCounts: Record<string, number> = {};
  await Promise.all(sampleSubs.map(async (k) => {
    try {
      const obj = await redis.hgetall(k) as Record<string, string> | null;
      const m = obj?.mode || 'standard';
      modeCounts[m] = (modeCounts[m] || 0) + 1;
    } catch { /* skip */ }
  }));

  return Response.json({
    ok: true,
    asOf: new Date().toISOString(),
    counts: {
      pushSubscriptions: subsAll.length,
      subscriptionRecords: subKeys.length,    // 包含可能未在 subs:all 集合里的
      stateBackups: stateKeys.length,         // 有 state:* 快照的用户
      registeredAccounts: userKeys.length,    // 注册了用户名密码的
      backupCodes: aliasKeys.length,
      progressRecords: progressKeys.length,
    },
    activity: {
      activeLastHour: activePush1h,
      activeLast24h: activePush24h,
      sampleSize: sampleSubs.length,
    },
    today: {
      date: today,
      usersWithDrink: usersDrunkToday,
      goalHit: goalHitToday,
      totalLitres: Math.round(totalDrunkTodayMl / 100) / 10,
      sampleSize: SAMPLE_PROG,
    },
    health: {
      totalFailedAcks,
      avgFailedAcksPerSub: sampleSubs.length > 0
        ? Math.round((totalFailedAcks / sampleSubs.length) * 10) / 10
        : 0,
    },
    distribution: {
      topCompanions,
      pushModeBreakdown: modeCounts,
    },
  });
}
