// 保存用户名到 KV — POST { clientId, name }
import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

type Body = { clientId?: string; name?: string };

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'JSON 无效' }, { status: 400 });
    }

    const clientId = body.clientId?.trim();
    const name = body.name?.trim();
    if (!clientId || !name) {
      return Response.json({ error: '缺 clientId 或 name' }, { status: 400 });
    }
    if (name.length > 30) {
      return Response.json({ error: '名字过长 (最多 30 字符)' }, { status: 400 });
    }

    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: 'Redis 未配置' }, { status: 500 });
    }

    await redis.hset(`user:${clientId}`, {
      name,
      updatedAt: Date.now(),
    });

    return Response.json({ ok: true, name });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
