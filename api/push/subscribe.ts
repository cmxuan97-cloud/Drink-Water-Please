import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

type Body = {
  clientId?: string;
  subscription?: { endpoint: string; keys?: { p256dh: string; auth: string } };
  wakeHour?: number;
  sleepHour?: number;
  tz?: string;
  mode?: 'easy' | 'standard' | 'frequent' | 'smart';
  companionId?: string;  // 用户主页当前的小伙伴 — push 文案会以它的口吻说话
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
    const fields: Record<string, string | number> = {
      sub: JSON.stringify(subscription),
      wake: wakeHour,
      sleep: sleepHour,
      tz,
      mode,
      updatedAt: Date.now(),
    };
    // 只在客户端真的传了 companionId 才覆盖（不然每次 progress sync 会清掉之前的设置）
    if (typeof body.companionId === 'string' && body.companionId.length > 0) {
      fields.companion = body.companionId;
    }
    await redis.hset(`sub:${clientId}`, fields);
    await redis.sadd('subs:all', clientId);
    return Response.json({ ok: true, mode, companion: fields.companion ?? null });
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
