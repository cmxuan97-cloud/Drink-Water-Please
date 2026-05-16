// 共用：IP 限流 — 用 Redis fixed-window 计数器
// 在 estimate-fill / auth/login / auth/register 里导入，防止滥用 API 配额或暴力破解。

import { Redis } from '@upstash/redis';

export const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

/** 从 Vercel 的 x-forwarded-for 取真实客户端 IP */
export const clientIp = (req: Request): string =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '0.0.0.0';

/**
 * Fixed-window 限流。
 * ns        : 命名空间，如 'fill' / 'login' / 'reg'
 * ip        : 客户端 IP
 * limit     : 窗口内最多允许几次
 * windowSec : 窗口大小（秒）
 *
 * soft-fail：Redis 挂掉时返回 ok:true，不因基础设施故障阻断正常用户。
 */
export const rateLimit = async (
  redis: Redis,
  ns: string,
  ip: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean }> => {
  try {
    const window = Math.floor(Date.now() / 1000 / windowSec);
    const key = `rl:${ns}:${ip}:${window}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec + 5);
    return { ok: count <= limit };
  } catch {
    return { ok: true };
  }
};
