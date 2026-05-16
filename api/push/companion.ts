// Lightweight endpoint — only updates the companion field in sub:{clientId}.
// Called whenever the user picks a new companion animal (Collection / Home backfill).
// Does NOT require the full push subscription object, so it works even when the
// browser subscription is absent or stale.

import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method not allowed' }, { status: 405 });
  }

  let body: { clientId?: string; companionId?: string };
  try {
    body = (await req.json()) as { clientId?: string; companionId?: string };
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }

  const { clientId, companionId } = body;
  if (!clientId || !companionId) {
    return Response.json({ error: 'clientId 和 companionId 为必填项' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return Response.json({ error: 'Redis 未配置' }, { status: 500 });
  }

  // Only update if the user already has a push subscription in Redis.
  // This avoids creating orphaned keys for users who never enabled push.
  const hasSub = await redis.hexists(`sub:${clientId}`, 'sub');
  if (!hasSub) {
    return Response.json({ ok: false, reason: 'no subscription' });
  }

  await redis.hset(`sub:${clientId}`, { companion: companionId });
  return Response.json({ ok: true, companion: companionId });
}
