// 按 username 前缀搜用户。返回 username + displayName + companion。
// 注意：只有已注册账号能搜。
import { errResp, getRedis, jsonResp, requireUsername, profileSummary } from './_shared';

export const config = { runtime: 'edge' };

const MAX_RESULTS = 12;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errResp('Method not allowed', 405);
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  if (!q || q.length < 1) return jsonResp({ results: [] });

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  // 用 SCAN 找匹配的 user:* keys
  const results: Array<{
    username: string;
    displayName: string;
    clientId: string;
    companionId?: string;
    charId?: string;
  }> = [];

  let cursor: string | number = 0;
  do {
    const [next, batch] = (await redis.scan(cursor, {
      match: `user:${q}*`,
      count: 100,
    })) as [string, string[]];
    cursor = next;
    for (const key of batch) {
      const rec = await redis.get<{ clientId?: string; displayName?: string }>(key);
      if (!rec?.clientId) continue;
      // 排除自己
      if (rec.clientId === clientId) continue;
      const username = key.slice('user:'.length);
      // 拉一下 profile 拿 companion / charId
      const summary = await profileSummary(redis, rec.clientId);
      results.push({
        username,
        displayName: summary?.displayName ?? rec.displayName ?? username,
        clientId: rec.clientId,
        companionId: summary?.companionId,
        charId: summary?.charId,
      });
      if (results.length >= MAX_RESULTS) break;
    }
    if (results.length >= MAX_RESULTS) break;
  } while (cursor !== '0' && cursor !== 0);

  return jsonResp({ results });
}
