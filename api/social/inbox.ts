// GET 我的收件箱（最新 50 条）。也返回未读数。
import { errResp, getRedis, jsonResp, requireUsername } from './_shared';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errResp('Method not allowed', 405);
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  const raw = (await redis.lrange(`inbox:${clientId}`, 0, 49)) as string[];
  const events = raw
    .map((s) => {
      // Upstash 有时会 auto-parse，有时给 string — 都兼容
      if (typeof s === 'object') return s as Record<string, unknown>;
      try { return JSON.parse(s) as Record<string, unknown>; }
      catch { return null; }
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const lastReadAt = Number((await redis.get<string>(`inbox:readAt:${clientId}`)) ?? 0);
  const unread = events.filter((e) => Number(e.createdAt) > lastReadAt).length;

  return jsonResp({ events, unread, lastReadAt });
}
