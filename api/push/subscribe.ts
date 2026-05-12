import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

type Body = {
  clientId?: string;
  subscription?: { endpoint: string; keys?: { p256dh: string; auth: string } };
  wakeHour?: number;
  sleepHour?: number;
  tz?: string;
  mode?: 'easy' | 'standard' | 'frequent' | 'smart';
};

const VALID_MODES = ['easy', 'standard', 'frequent', 'smart'] as const;

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

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return Response.json({ error: 'JSON 无效' }, { status: 400 });
    }

    const { clientId, subscription, wakeHour, sleepHour, tz } = body;
    if (!clientId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return Response.json({ error: '订阅参数缺失' }, { status: 400 });
    }
    if (typeof wakeHour !== 'number' || typeof sleepHour !== 'number' || !tz) {
      return Response.json({ error: '设置参数缺失' }, { status: 400 });
    }

    const redis = getRedis();
    if (!redis) {
      return Response.json({ error: 'Redis 未配置 (检查 UPSTASH_REDIS_REST_URL/TOKEN 或 KV_REST_API_URL/TOKEN)' }, { status: 500 });
    }

    const mode = (body.mode && VALID_MODES.includes(body.mode)) ? body.mode : 'standard';
    await redis.hset(`sub:${clientId}`, {
      sub: JSON.stringify(subscription),
      wake: wakeHour,
      sleep: sleepHour,
      tz,
      mode,
      updatedAt: Date.now(),
    });
    await redis.sadd('subs:all', clientId);
    return Response.json({ ok: true, mode });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split('\n').slice(0, 5) : undefined,
      },
      { status: 500 },
    );
  }
}
