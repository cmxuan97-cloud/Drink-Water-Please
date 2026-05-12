import { Redis } from '@upstash/redis';

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    let body: { clientId?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'JSON 无效' }, { status: 400 });
    }

    const { clientId } = body;
    if (!clientId) {
      return Response.json({ error: '缺 clientId' }, { status: 400 });
    }

    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: 'Redis 未配置' }, { status: 500 });
    }

    await redis.del(`sub:${clientId}`);
    await redis.srem('subs:all', clientId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
