// 朋友圈排行榜：按当前连续达标天数倒序，并列时按累计天数。
// 包含自己。
import { errResp, getRedis, jsonResp, profileSummary, requireUsername } from './_shared';
import type { PublicProfile } from './_shared';

export const config = { runtime: 'edge' };

type Row = PublicProfile & { clientId: string; isMe: boolean };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errResp('Method not allowed', 405);
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  const friendIds = (await redis.smembers(`friends:${clientId}`)) as string[];
  const all = [clientId, ...friendIds];

  const rows: Row[] = [];
  for (const id of all) {
    const p = await profileSummary(redis, id);
    if (p) rows.push({ ...p, isMe: id === clientId });
  }

  rows.sort((a, b) => {
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.totalCompletedDays !== a.totalCompletedDays) return b.totalCompletedDays - a.totalCompletedDays;
    return b.todayPctGoal - a.todayPctGoal;
  });

  return jsonResp({ rows });
}
