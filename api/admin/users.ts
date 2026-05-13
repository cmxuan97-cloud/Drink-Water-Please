// Admin 用户列表 — 每个用户一行，含基础信息 + 最近活动
import { checkAdminAuth, getRedis, scanAll, todayKey } from './_auth';

export const config = { runtime: 'edge' };

type UserRow = {
  clientId: string;
  username: string | null;
  displayName: string | null;
  hasPush: boolean;
  pushMode: string | null;
  companion: string | null;
  tz: string | null;
  lastSentMinAgo: number | null;
  lastAckMinAgo: number | null;
  failedAcks: number;
  todayDrunkMl: number | null;
  todayGoalMl: number | null;
  todayPct: number | null;
  hasState: boolean;
};

export default async function handler(req: Request): Promise<Response> {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return Response.json({ error: auth.reason }, { status: 401 });
  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  const url = new URL(req.url);
  const sortBy = (url.searchParams.get('sort') || 'recent') as 'recent' | 'drunk' | 'fails';
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '100', 10) || 100));

  // 所有有 sub:* 记录的用户（最完整的「用户名册」）
  const subKeys = await scanAll(redis, 'sub:*');
  const subsAll = (await redis.smembers('subs:all')) as string[];
  const subsAllSet = new Set(subsAll);

  // 同时也扫 state:* 找有备份但还没订阅 push 的用户
  const stateKeys = await scanAll(redis, 'state:*');
  const stateClientIds = stateKeys.map((k) => k.slice('state:'.length));

  const allClientIds = new Set<string>();
  for (const k of subKeys) allClientIds.add(k.slice('sub:'.length));
  for (const id of stateClientIds) allClientIds.add(id);

  const today = todayKey();
  const now = Date.now();

  const rows: UserRow[] = await Promise.all(
    Array.from(allClientIds).slice(0, 600).map(async (id) => {
      const [subObj, progObj, username, stateExists] = await Promise.all([
        redis.hgetall(`sub:${id}`).catch(() => null) as Promise<Record<string, string> | null>,
        redis.hgetall(`progress:${id}`).catch(() => null) as Promise<Record<string, string> | null>,
        redis.get(`username:${id}`).catch(() => null) as Promise<string | null>,
        redis.exists(`state:${id}`).then((r) => r > 0).catch(() => false),
      ]);

      let displayName: string | null = null;
      if (username) {
        try {
          const raw = await redis.get(`user:${username}`) as string | null;
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            displayName = parsed.displayName || null;
          }
        } catch { /* ignore */ }
      }

      const lastSentAt = subObj ? Number(subObj.lastSentAt) || 0 : 0;
      const lastAckAt = subObj ? Number(subObj.lastAckAt) || 0 : 0;
      const drunk = progObj?.date === today ? Number(progObj.drunkMl) || 0 : null;
      const goal = progObj?.date === today ? Number(progObj.goalMl) || 0 : null;

      return {
        clientId: id,
        username: username || null,
        displayName,
        hasPush: subsAllSet.has(id),
        pushMode: subObj?.mode || null,
        companion: subObj?.companion || null,
        tz: subObj?.tz || null,
        lastSentMinAgo: lastSentAt ? Math.round((now - lastSentAt) / 60000) : null,
        lastAckMinAgo: lastAckAt ? Math.round((now - lastAckAt) / 60000) : null,
        failedAcks: subObj ? Number(subObj.failedAcks) || 0 : 0,
        todayDrunkMl: drunk,
        todayGoalMl: goal,
        todayPct: drunk !== null && goal && goal > 0
          ? Math.round((drunk / goal) * 100)
          : null,
        hasState: stateExists,
      };
    }),
  );

  // 排序
  rows.sort((a, b) => {
    if (sortBy === 'drunk') return (b.todayDrunkMl ?? -1) - (a.todayDrunkMl ?? -1);
    if (sortBy === 'fails') return b.failedAcks - a.failedAcks;
    // recent 默认 — 用 lastAckAt 或 lastSentAt 倒序（null 排最后）
    const ai = Math.min(a.lastAckMinAgo ?? Infinity, a.lastSentMinAgo ?? Infinity);
    const bi = Math.min(b.lastAckMinAgo ?? Infinity, b.lastSentMinAgo ?? Infinity);
    return ai - bi;
  });

  return Response.json({
    ok: true,
    total: allClientIds.size,
    shown: Math.min(rows.length, limit),
    rows: rows.slice(0, limit),
  });
}
