// 把整个用户状态快照保存到 Redis，用 clientId 当 key。
// 每次本地状态变化（debounced 5 秒）就会调到这里。
import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const MAX_SIZE = 200_000;          // 200KB 上限（去掉照片足够用）
const TTL_SECONDS = 60 * 60 * 24 * 365; // 1 年没动就过期

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  let body: { clientId?: string; state?: unknown };
  try {
    body = (await req.json()) as { clientId?: string; state?: unknown };
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }
  const { clientId, state } = body;
  if (!clientId || typeof clientId !== 'string' || clientId.length < 8) {
    return Response.json({ error: '缺/无效 clientId' }, { status: 400 });
  }
  if (!state || typeof state !== 'object') {
    return Response.json({ error: '缺 state' }, { status: 400 });
  }
  const serialized = JSON.stringify(state);
  if (serialized.length > MAX_SIZE) {
    return Response.json({ error: `数据过大 (${serialized.length} 字节，限 ${MAX_SIZE})` }, { status: 413 });
  }
  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  await redis.set(`state:${clientId}`, serialized, { ex: TTL_SECONDS });
  return Response.json({ ok: true, size: serialized.length, savedAt: Date.now() });
}
