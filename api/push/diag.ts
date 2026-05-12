// 诊断 endpoint — 看哪些 env / KV 配齐了。不返回 secret 值，只返回 true/false。
// GET /api/push/diag

import { isRedisConfigured, redis } from '../_lib/redis';

export default async function handler(_req: Request): Promise<Response> {
  const env = {
    VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: !!process.env.VAPID_SUBJECT,
    CRON_SECRET: !!process.env.CRON_SECRET,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
  };

  let kvPing: { ok: boolean; error?: string; subCount?: number } = { ok: false };
  if (isRedisConfigured() && redis) {
    try {
      const ids = (await redis.smembers('subs:all')) as string[];
      kvPing = { ok: true, subCount: ids?.length ?? 0 };
    } catch (e) {
      kvPing = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    kvPing = { ok: false, error: 'Redis 未配置' };
  }

  const allConfigured =
    env.VAPID_PUBLIC_KEY &&
    env.VAPID_PRIVATE_KEY &&
    env.VAPID_SUBJECT &&
    env.CRON_SECRET &&
    isRedisConfigured() &&
    kvPing.ok;

  return Response.json({
    ok: allConfigured,
    env,
    kv: kvPing,
    nextSteps: allConfigured ? '全部就绪 ✅' : [
      !env.VAPID_PUBLIC_KEY && '在 Vercel env 加 VAPID_PUBLIC_KEY',
      !env.VAPID_PRIVATE_KEY && '在 Vercel env 加 VAPID_PRIVATE_KEY',
      !env.VAPID_SUBJECT && '在 Vercel env 加 VAPID_SUBJECT (mailto:你的邮箱)',
      !env.CRON_SECRET && '在 Vercel env 加 CRON_SECRET',
      !isRedisConfigured() && 'Vercel Storage → 安装 Upstash for Redis 集成',
      isRedisConfigured() && !kvPing.ok && `KV ping 失败: ${kvPing.error}`,
    ].filter(Boolean),
  });
}
