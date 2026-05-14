// 客户端在 sync 时顺便推一份公开 profile 摘要上来。
import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../_shared';
import type { PublicProfile } from '../_shared';

export const config = { runtime: 'edge' };

type Body = { clientId?: string; profile?: PublicProfile };

const TTL = 60 * 60 * 24 * 60; // 60 天没活动就过期

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);

  const p = body.profile;
  if (!p || typeof p !== 'object') return errResp('缺 profile', 400);

  // 用服务端记的 username 覆盖（防客户端伪造）
  const ids = Array.isArray(p.unlockedIds)
    ? p.unlockedIds.filter((x): x is string => typeof x === 'string').slice(0, 100).map((s) => s.slice(0, 30))
    : [];
  const safe: PublicProfile = {
    username: auth.username,
    displayName: String(p.displayName ?? auth.username).slice(0, 30),
    companionId: p.companionId ? String(p.companionId).slice(0, 50) : undefined,
    charId: p.charId ? String(p.charId).slice(0, 50) : undefined,
    todayPctGoal: Math.max(0, Math.min(100, Math.round(Number(p.todayPctGoal) || 0))),
    todayDrunkMl: Math.max(0, Math.min(999999, Math.round(Number(p.todayDrunkMl) || 0))),
    unlockedCount: Math.max(0, Math.min(999, Math.round(Number(p.unlockedCount) || 0))),
    unlockedIds: ids,
    totalCompletedDays: Math.max(0, Math.min(99999, Math.round(Number(p.totalCompletedDays) || 0))),
    currentStreak: Math.max(0, Math.min(9999, Math.round(Number(p.currentStreak) || 0))),
    peakStreak: Math.max(0, Math.min(9999, Math.round(Number(p.peakStreak) || 0))),
    updatedAt: Date.now(),
  };

  await redis.set(`profile:${body.clientId}`, JSON.stringify(safe), { ex: TTL });
  return jsonResp({ ok: true });
}
