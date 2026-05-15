// 按 username 前缀搜用户。q 为空时返回所有未添加用户。
// 注意：只有已注册账号能搜。
import { errResp, getRedis, jsonResp, requireUsername, profileSummary } from './_shared';

export const config = { runtime: 'edge' };

const MAX_RESULTS = 20;

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'GET') return errResp('Method not allowed', 405);
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId') ?? '';
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

    const redis = getRedis();
    if (!redis) return errResp('Redis 未配置', 500);

    const auth = await requireUsername(redis, clientId);
    if (!auth.ok) return errResp(auth.error, auth.status);

    // 已好友列表，用于过滤
    const friendIds = new Set((await redis.smembers(`friends:${clientId}`)) as string[]);

    const pattern = q ? `user:${q}*` : 'user:*';

    // 先收集所有候选 key（上限 MAX_RESULTS * 5 避免扫太多）
    const candidateKeys: string[] = [];
    let cursor: string | number = 0;
    do {
      const [next, batch] = (await redis.scan(cursor, {
        match: pattern,
        count: 100,
      })) as [string, string[]];
      cursor = next;
      for (const key of batch) {
        candidateKeys.push(key);
        if (candidateKeys.length >= MAX_RESULTS * 5) break;
      }
      if (candidateKeys.length >= MAX_RESULTS * 5) break;
    } while (cursor !== '0' && cursor !== 0);

    // 并行获取所有候选记录
    const recs = await Promise.all(
      candidateKeys.map(key =>
        redis.get<{ clientId?: string; displayName?: string }>(key)
          .then(rec => ({ key, rec }))
          .catch(() => ({ key, rec: null }))
      )
    );

    // 过滤：排除自己、已好友、无 clientId
    const filtered = recs.filter(
      ({ rec }) => rec?.clientId && rec.clientId !== clientId && !friendIds.has(rec.clientId)
    ).slice(0, MAX_RESULTS);

    // 并行获取 profile 摘要
    const profiles = await Promise.all(
      filtered.map(({ key, rec }) =>
        profileSummary(redis, rec!.clientId!)
          .then(summary => ({
            username: key.slice('user:'.length),
            displayName: summary?.displayName ?? rec!.displayName ?? key.slice('user:'.length),
            clientId: rec!.clientId!,
            companionId: summary?.companionId,
            charId: summary?.charId,
          }))
          .catch(() => null)
      )
    );

    const results = profiles.filter((p): p is NonNullable<typeof p> => p !== null);

    return jsonResp({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errResp(`搜索出错: ${msg}`, 500);
  }
}
