import { errResp, getRedis, jsonResp, profileSummary, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errResp('Method not allowed', 405);

  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';
  const lat = parseFloat(url.searchParams.get('lat') ?? '');
  const lng = parseFloat(url.searchParams.get('lng') ?? '');

  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return errResp('经纬度无效', 400);
  }

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  // 查找 5km 内的用户
  let candidates: string[] = [];
  try {
    candidates = (await redis.geosearch(
      'geo:nearby',
      { type: 'FROMLONLAT', coordinate: { lon: lng, lat } },
      { type: 'BYRADIUS', radius: 5, radiusType: 'KM' },
      'ASC',
      { count: { limit: 50 } },
    )) as string[];
  } catch {
    return errResp('地理查询失败', 500);
  }

  // 排除自己
  candidates = candidates.filter(id => id !== clientId);
  if (candidates.length === 0) return jsonResp({ users: [] });

  // 过滤已过期（30min TTL）的用户
  const activeChecks = await Promise.all(
    candidates.map(id => redis.exists(`nearby:active:${id}`)),
  );
  const activeCandidates = candidates.filter((_, i) => activeChecks[i] === 1);
  if (activeCandidates.length === 0) return jsonResp({ users: [] });

  // 排除已是好友的用户
  const friendSet = new Set((await redis.smembers(`friends:${clientId}`)) as string[]);
  const nonFriends = activeCandidates.filter(id => !friendSet.has(id));
  if (nonFriends.length === 0) return jsonResp({ users: [] });

  // 获取 profile 摘要（不含坐标）
  const profiles = await Promise.all(nonFriends.map(id => profileSummary(redis, id)));
  const users = profiles
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map(p => ({
      clientId: p.clientId,
      username: p.username,
      displayName: p.displayName,
      companionId: p.companionId,
      charId: p.charId,
      todayPctGoal: p.todayPctGoal,
      currentStreak: p.currentStreak,
      unlockedCount: p.unlockedCount,
    }));

  return jsonResp({ users });
}
